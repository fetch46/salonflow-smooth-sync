
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo,
} from 'react'
import { supabase } from '@/integrations/supabase/client'
import {
  OrganizationService,
  SubscriptionService,
  UserService,
  SuperAdminService,
  SystemSettingsService,
} from './services'
import type {
  Organization,
  OrganizationUser,
  OrganizationSubscription,
  SubscriptionPlan,
  SubscriptionStatus,
  UsageMetrics,
  UserInvitation,
  CreateOrganizationData,
  SaasContextType,
  UserRole,
} from './types'
import { PLAN_FEATURES } from '@/lib/features'
import {
  calculateFeatureAccess,
  canPerformAction as canPerformActionUtil,
  hasMinimumRole,
} from './utils'

const SaasContext = createContext<SaasContextType | undefined>(undefined)

interface SaasProviderProps {
  children: React.ReactNode
}

export const useSaas = () => {
  const context = useContext(SaasContext)
  if (!context) {
    throw new Error('useSaas must be used within a SaasProvider')
  }
  return context
}

export const SaasProvider: React.FC<SaasProviderProps> = ({ children }) => {
  const [organizations, setOrganizations] = useState<OrganizationUser[]>([])
  const [currentOrganization, setCurrentOrganization] =
    useState<Organization | null>(null)
  const [subscription, setSubscription] =
    useState<OrganizationSubscription | null>(null)
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan | null>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false)
  const [systemSettings, setSystemSettings] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [organizationRole, setOrganizationRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics>({})
  const [locale, setLocale] = useState<string>('en-US')

  const isSubscriptionActive = useMemo(() => subscriptionStatus === 'active', [subscriptionStatus])

  const isTrialing = useMemo(() => subscriptionStatus === 'trial', [subscriptionStatus])

  const daysLeftInTrial = useMemo(() => {
    if (!subscription || !subscription.trial_end) return null
    const end = new Date(subscription.trial_end).getTime()
    const now = Date.now()
    const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
    return Math.max(diffDays, 0)
  }, [subscription])

  const isOrganizationOwner = useMemo(() => organizationRole === 'owner', [organizationRole])
  const isOrganizationAdmin = useMemo(
    () => organizationRole === 'owner' || organizationRole === 'admin',
    [organizationRole]
  )
  const canManageUsers = useMemo(() => hasMinimumRole(organizationRole, 'manager'), [organizationRole])
  const canManageSettings = useMemo(() => hasMinimumRole(organizationRole, 'admin'), [organizationRole])
  const canManageSystem = useMemo(() => isSuperAdmin, [isSuperAdmin])

  const organizationsList = useMemo(() => {
    return organizations
      .map((m) => m.organizations)
      .filter(Boolean) as Organization[]
  }, [organizations])

  const userRoles = useMemo(() => {
    const mapping: Record<string, UserRole> = {}
    organizations.forEach((m) => {
      if (m.organizations) mapping[m.organizations.id] = m.role
    })
    return mapping
  }, [organizations])

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch (error) {
        console.error('Failed to get current user:', error)
      }
    }

    getCurrentUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user || null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const loadUserOrganizations = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      const orgs = await OrganizationService.getUserOrganizations(user.id)
      setOrganizations(orgs)

      if (orgs.length > 0 && !currentOrganization) {
        setCurrentOrganization(orgs[0].organizations)
      }
    } catch (error) {
      console.error('Failed to load organizations:', error)
      setError('Failed to load organizations')
    } finally {
      setLoading(false)
    }
  }, [user, currentOrganization])

  // Keep organizationRole in sync with the selected organization
  useEffect(() => {
    if (!currentOrganization || organizations.length === 0) {
      setOrganizationRole(null)
      return
    }
    const membership = organizations.find(
      (ou) => ou.organization_id === currentOrganization.id
    )
    setOrganizationRole((membership?.role as UserRole) || null)
  }, [currentOrganization, organizations])

  const loadSubscription = useCallback(async () => {
    if (!currentOrganization) return

    try {
      setLoading(true)
      const sub = await SubscriptionService.getOrganizationSubscription(
        currentOrganization.id
      )
      setSubscription(sub)
      setSubscriptionPlan(sub?.subscription_plans || null)
      setSubscriptionStatus(sub?.status || null)
    } catch (error) {
      console.error('Failed to load subscription:', error)
      setError('Failed to load subscription')
    } finally {
      setLoading(false)
    }
  }, [currentOrganization])

  const updateSubscription = async (planId: string) => {
    if (!currentOrganization) return

    try {
      setLoading(true)
      const sub = await SubscriptionService.updateSubscription(
        currentOrganization.id,
        planId
      )
      setSubscription(sub)
      setSubscriptionPlan(sub.subscription_plans)
      setSubscriptionStatus(sub.status)
    } catch (error) {
      console.error('Failed to update subscription:', error)
      setError('Failed to update subscription')
    } finally {
      setLoading(false)
    }
  }

  const cancelSubscription = async () => {
    if (!currentOrganization) return

    try {
      setLoading(true)
      await SubscriptionService.cancelSubscription(currentOrganization.id)
      setSubscription(null)
      setSubscriptionPlan(null)
      setSubscriptionStatus(null)
    } catch (error) {
      console.error('Failed to cancel subscription:', error)
      setError('Failed to cancel subscription')
    } finally {
      setLoading(false)
    }
  }

  const inviteUser = async (email: string, role: UserRole): Promise<UserInvitation> => {
    if (!currentOrganization || !user) return

    try {
      const invitation = await UserService.inviteUser(
        currentOrganization.id,
        email,
        role,
        user.id
      )
      return invitation
    } catch (error) {
      console.error('Failed to invite user:', error)
      setError('Failed to invite user')
      throw error
    }
  }

  const removeUser = async (userId: string) => {
    if (!currentOrganization) return

    try {
      await UserService.removeUser(currentOrganization.id, userId)
    } catch (error) {
      console.error('Failed to remove user:', error)
      setError('Failed to remove user')
    }
  }

  const updateUserRole = async (userId: string, role: UserRole) => {
    if (!currentOrganization) return

    try {
      await UserService.updateUserRole(
        currentOrganization.id,
        userId,
        role
      )
    } catch (error) {
      console.error('Failed to update user role:', error)
      setError('Failed to update user role')
    }
  }

  const switchOrganization = async (organizationId: string) => {
    try {
      const target = organizations.find((ou) => ou.organization_id === organizationId)
      setCurrentOrganization(target?.organizations || null)
    } catch (error) {
      console.error('Failed to switch organization:', error)
    }
  }

  const checkSuperAdminStatus = useCallback(async () => {
    if (!user) return

    try {
      const isAdmin = await SuperAdminService.checkSuperAdminStatus(user.id)
      setIsSuperAdmin(isAdmin)
    } catch (error) {
      console.error('Failed to check super admin status:', error)
    }
  }, [user])

  const loadSystemSettings = useCallback(async () => {
    try {
      const settings = await SystemSettingsService.getSystemSettings()
      setSystemSettings(settings || {
        maintenance_mode: false,
        support_email: 'support@example.com',
        default_plan_slug: 'starter',
        features: {
          allow_signups: true,
          allow_public_booking: true,
        },
        metadata: {},
        regional_formats_enabled: false,
        app_name: 'AURA OS',
      })
      if (settings?.regional_formats_enabled && (settings as any)?.default_locale) {
        setLocale((settings as any).default_locale)
      }
    } catch (error) {
      console.warn('Failed to load system settings:', error)
      // Set default settings on error
      setSystemSettings({
        maintenance_mode: false,
        support_email: 'support@example.com',
        default_plan_slug: 'starter',
        features: {
          allow_signups: true,
          allow_public_booking: true,
        },
        metadata: {},
        regional_formats_enabled: false,
        app_name: 'AURA OS',
      })
    }
  }, [])

  const refreshUsage = useCallback(async () => {
    if (!currentOrganization) return
    try {
      setLoading(true)
      // Placeholder: usage tracking integration
      // For now, keep empty metrics
      setUsageMetrics({})
    } catch (error) {
      console.error('Failed to refresh usage metrics:', error)
    } finally {
      setLoading(false)
    }
  }, [currentOrganization])

  const refreshOrganization = useCallback(async () => {
    await loadUserOrganizations()
  }, [loadUserOrganizations])

  useEffect(() => {
    if (currentOrganization) {
      loadSubscription()
      refreshUsage()
    } else {
      setSubscription(null)
      setSubscriptionPlan(null)
      setSubscriptionStatus(null)
      setUsageMetrics({})
    }
  }, [currentOrganization, loadSubscription, refreshUsage])

  useEffect(() => {
    // Load system settings on mount
    loadSystemSettings()
    
    // Load user data if authenticated
    if (user) {
      loadUserOrganizations()
      checkSuperAdminStatus()
    } else {
      setOrganizations([])
      setCurrentOrganization(null)
      setIsSuperAdmin(false)
    }
  }, [user, loadUserOrganizations, checkSuperAdminStatus, loadSystemSettings])

  const hasFeature = useCallback((feature: string): boolean => {
    if (!subscriptionPlan) return false
    const planFeatures = PLAN_FEATURES[subscriptionPlan.slug] || PLAN_FEATURES['starter']
    const config = planFeatures?.[feature as keyof typeof planFeatures]
    return !!config?.enabled
  }, [subscriptionPlan])

  const getFeatureAccess = useCallback((feature: string) => {
    if (!subscriptionPlan) return calculateFeatureAccess(false)
    const planFeatures = PLAN_FEATURES[subscriptionPlan.slug] || PLAN_FEATURES['starter']
    const config: any = planFeatures?.[feature as keyof typeof planFeatures]
    const usage = usageMetrics[feature] || 0
    return calculateFeatureAccess(!!config?.enabled, config?.max, usage)
  }, [subscriptionPlan, usageMetrics])

  const canPerformAction = useCallback((action: string, resource: string): boolean => {
    return canPerformActionUtil(organizationRole, action, resource)
  }, [organizationRole])

  const clearError = useCallback(() => setError(null), [])

  const value: SaasContextType = {
    // State
    user,
    loading,
    organization: currentOrganization,
    organizations: organizationsList,
    organizationRole,
    userRoles,
    subscription,
    subscriptionPlan,
    subscriptionStatus,
    isSuperAdmin,
    superAdminPermissions: null,
    usageMetrics,
    error,
    systemSettings,
    // Actions
    switchOrganization,
    refreshOrganization,
    createOrganization: async (data: CreateOrganizationData) => {
      if (!user) throw new Error('Not authenticated')
      const org = await OrganizationService.createOrganization(data, user.id)
      await loadUserOrganizations()
      return org
    },
    updateOrganization: async (id: string, data: Partial<Organization>) => {
      const org = await OrganizationService.updateOrganization(id, data)
      await loadUserOrganizations()
      return org
    },
    inviteUser,
    removeUser,
    updateUserRole,
    updateSubscription,
    cancelSubscription,
    refreshUsage,
    clearError,
    // Computed
    isOrganizationOwner,
    isOrganizationAdmin,
    canManageUsers,
    canManageSettings,
    canManageSystem,
    isTrialing,
    isSubscriptionActive,
    daysLeftInTrial,
    hasFeature,
    getFeatureAccess,
    canPerformAction,
    locale,
  }

  return <SaasContext.Provider value={value}>{children}</SaasContext.Provider>
}

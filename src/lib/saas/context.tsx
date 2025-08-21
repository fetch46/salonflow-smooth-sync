import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
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
  SubscriptionPlan,
  UserRole,
  CreateOrganizationData,
} from './types'

interface SaasContextType {
  organizations: OrganizationUser[]
  currentOrganization: Organization | null
  setCurrentOrganization: (org: Organization | null) => void
  // Expose selected organization using common key expected by consumers
  organization: Organization | null
  // Current user's role within the selected organization
  organizationRole: UserRole | null
  // Simple organization switcher by id
  switchOrganization: (organizationId: string) => Promise<void>
  // Organization CRUD used by hooks
  createOrganization: (data: CreateOrganizationData) => Promise<Organization>
  updateOrganization: (id: string, data: Partial<Organization>) => Promise<Organization>
  subscriptionPlan: SubscriptionPlan | null
  isSubscriptionActive: boolean
  updateSubscription: (planId: string) => Promise<void>
  cancelSubscription: () => Promise<void>
  organizationUsers: OrganizationUser[]
  inviteUser: (email: string, role: string) => Promise<void>
  removeUser: (userId: string) => Promise<void>
  updateUserRole: (userId: string, role: string) => Promise<void>
  isSuperAdmin: boolean
  systemSettings: any
  user: any
  loading: boolean
  subscription: any
  isTrialing: boolean
  daysLeftInTrial: number | null
  isOrganizationOwner: boolean
  isOrganizationAdmin: boolean
}

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
  const [subscriptionPlan, setSubscriptionPlan] =
    useState<SubscriptionPlan | null>(null)
  const [organizationUsers, setOrganizationUsers] = useState<OrganizationUser[]>(
    []
  )
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false)
  const [systemSettings, setSystemSettings] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [organizationRole, setOrganizationRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<any>(null)

  const isSubscriptionActive = subscription?.status === 'active'
  
  // Compute trial information
  const isTrialing = subscription?.status === 'trial' || false
  const daysLeftInTrial = subscription?.trial_end ? 
    Math.max(0, Math.ceil((new Date(subscription.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null
  
  // Role checks
  const isOrganizationOwner = organizationRole === 'owner'
  const isOrganizationAdmin = organizationRole === 'admin'

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch (error) {
        console.error('Failed to get current user:', error)
      } finally {
        setLoading(false)
      }
    }

    getCurrentUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user || null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const loadUserOrganizations = useCallback(async () => {
    if (!user) return

    try {
      const orgs = await OrganizationService.getUserOrganizations(user.id)
      setOrganizations(orgs)

      if (orgs.length > 0 && !currentOrganization) {
        setCurrentOrganization(orgs[0].organizations)
      }
    } catch (error) {
      console.error('Failed to load organizations:', error)
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
    setOrganizationRole((membership?.role as any) || null)
  }, [currentOrganization, organizations])

  const loadSubscription = useCallback(async () => {
    if (!currentOrganization) return

    try {
      const subscriptionData =
        await SubscriptionService.getOrganizationSubscription(
          currentOrganization.id
        )
      setSubscription(subscriptionData)
      setSubscriptionPlan(subscriptionData?.subscription_plans || null)
    } catch (error) {
      console.error('Failed to load subscription:', error)
    }
  }, [currentOrganization])

  const updateSubscription = async (planId: string) => {
    if (!currentOrganization) return

    try {
      const subscription = await SubscriptionService.updateSubscription(
        currentOrganization.id,
        planId
      )
      setSubscription(subscription)
      setSubscriptionPlan(subscription.subscription_plans)
    } catch (error) {
      console.error('Failed to update subscription:', error)
    }
  }

  const cancelSubscription = async () => {
    if (!currentOrganization) return

    try {
      await SubscriptionService.cancelSubscription(currentOrganization.id)
      setSubscription(null)
      setSubscriptionPlan(null)
    } catch (error) {
      console.error('Failed to cancel subscription:', error)
    }
  }

  const createOrganization = async (data: CreateOrganizationData): Promise<Organization> => {
    if (!user) {
      throw new Error('User must be authenticated')
    }
    const org = await OrganizationService.createOrganization(data, user.id)
    await loadUserOrganizations()
    setCurrentOrganization(org)
    return org
  }

  const updateOrganization = async (id: string, data: Partial<Organization>): Promise<Organization> => {
    const updated = await OrganizationService.updateOrganization(id, data)
    setCurrentOrganization((prev) => (prev && prev.id === id ? { ...prev, ...updated } : prev))
    return updated
  }

  const loadOrganizationUsers = useCallback(async () => {
    if (!currentOrganization) return

    try {
      const users = await UserService.getOrganizationUsers(
        currentOrganization.id
      )
      setOrganizationUsers(users)
    } catch (error) {
      console.error('Failed to load organization users:', error)
    }
  }, [currentOrganization])

  const inviteUser = async (email: string, role: string) => {
    if (!currentOrganization || !user) return

    try {
      await UserService.inviteUser(
        currentOrganization.id,
        email,
        role as UserRole,
        user.id
      )
      await loadOrganizationUsers()
    } catch (error) {
      console.error('Failed to invite user:', error)
    }
  }

  const removeUser = async (userId: string) => {
    if (!currentOrganization) return

    try {
      await UserService.removeUser(currentOrganization.id, userId)
      await loadOrganizationUsers()
    } catch (error) {
      console.error('Failed to remove user:', error)
    }
  }

  const updateUserRole = async (userId: string, role: string) => {
    if (!currentOrganization) return

    try {
      await UserService.updateUserRole(
        currentOrganization.id,
        userId,
        role as UserRole
      )
      await loadOrganizationUsers()
    } catch (error) {
      console.error('Failed to update user role:', error)
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

  useEffect(() => {
    if (currentOrganization) {
      loadSubscription()
      loadOrganizationUsers()
    } else {
      setSubscriptionPlan(null)
      setOrganizationUsers([])
    }
  }, [currentOrganization, loadSubscription, loadOrganizationUsers])

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

  const value: SaasContextType = {
    organizations,
    currentOrganization,
    setCurrentOrganization,
    organization: currentOrganization,
    organizationRole,
    switchOrganization,
    createOrganization,
    updateOrganization,
    subscriptionPlan: subscriptionPlan || null,
    isSubscriptionActive,
    updateSubscription,
    cancelSubscription,
    organizationUsers,
    inviteUser,
    removeUser,
    updateUserRole,
    isSuperAdmin,
    systemSettings,
    user,
    loading,
    subscription,
    isTrialing,
    daysLeftInTrial,
    isOrganizationOwner,
    isOrganizationAdmin,
  }

  return <SaasContext.Provider value={value}>{children}</SaasContext.Provider>
}
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

import type {
  SaasContextType,
  SaasState,
  Organization,
  OrganizationUser,
  OrganizationSubscription,
  SubscriptionPlan,
  UserRole,
  FeatureAccess,
  UsageMetrics,
  CreateOrganizationData,
  UserInvitation,
} from './types'

import {
   OrganizationService,
   SubscriptionService,
   UserService,
   SuperAdminService,
   UsageService,
   AnalyticsService,
   CacheService,
} from './services'

 import {
   hasMinimumRole,
   canPerformAction,
   isSubscriptionActive,
   isSubscriptionTrialing,
   calculateTrialDaysRemaining,
   calculateFeatureAccess,
   getErrorMessage,
   createCacheKey,
   createSlugFromName,
 } from './utils'

import { PLAN_FEATURES } from '@/lib/features'
import { STORAGE_KEYS, CACHE_KEYS } from './constants'

// Action types for the reducer
type SaasAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_ORGANIZATION'; payload: Organization | null }
  | { type: 'SET_ORGANIZATIONS'; payload: Organization[] }
  | { type: 'SET_ORGANIZATION_ROLE'; payload: UserRole | null }
  | { type: 'SET_USER_ROLES'; payload: Record<string, UserRole> }
  | { type: 'SET_SUBSCRIPTION'; payload: OrganizationSubscription | null }
  | { type: 'SET_SUBSCRIPTION_PLAN'; payload: SubscriptionPlan | null }
  | { type: 'SET_SUPER_ADMIN'; payload: boolean }
  | { type: 'SET_USAGE_METRICS'; payload: UsageMetrics }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET_STATE' }
  | { type: 'SET_SYSTEM_SETTINGS'; payload: any | null }

// Initial state
const initialState: SaasState = {
  user: null,
  loading: true,
  organization: null,
  organizations: [],
  organizationRole: null,
  userRoles: {},
  subscription: null,
  subscriptionPlan: null,
  subscriptionStatus: null,
  isSuperAdmin: false,
  superAdminPermissions: null,
  usageMetrics: {},
  error: null,
  systemSettings: null,
}

// Reducer function
function saasReducer(state: SaasState, action: SaasAction): SaasState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    
    case 'SET_USER':
      return { ...state, user: action.payload }
    
    case 'SET_ORGANIZATION':
      return { ...state, organization: action.payload }
    
    case 'SET_ORGANIZATIONS':
      return { ...state, organizations: action.payload }
    
    case 'SET_ORGANIZATION_ROLE':
      return { ...state, organizationRole: action.payload }
    
    case 'SET_USER_ROLES':
      return { ...state, userRoles: action.payload }
    
    case 'SET_SUBSCRIPTION':
      return { 
        ...state, 
        subscription: action.payload,
        subscriptionStatus: action.payload?.status || null
      }
    
    case 'SET_SUBSCRIPTION_PLAN':
      return { ...state, subscriptionPlan: action.payload }
    
    case 'SET_SUPER_ADMIN':
      return { ...state, isSuperAdmin: action.payload }
    
    case 'SET_USAGE_METRICS':
      return { ...state, usageMetrics: action.payload }
    
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    
    case 'CLEAR_ERROR':
      return { ...state, error: null }
    
    case 'RESET_STATE':
      return { ...initialState, loading: false }
    
    case 'SET_SYSTEM_SETTINGS':
      return { ...state, systemSettings: action.payload }
    
    default:
      return state
  }
}

// Create context
const SaasContext = createContext<SaasContextType | undefined>(undefined)

// Provider component
export const SaasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(saasReducer, initialState)

  // Error handling
  const handleError = useCallback((error: unknown, context?: string) => {
    const message = getErrorMessage(error)
    console.error(`SaaS Context Error${context ? ` (${context})` : ''}:`, error)
    dispatch({ type: 'SET_ERROR', payload: message })
    
    // Show user-friendly error message
    if (context) {
      toast.error(`${context}: ${message}`)
    }
  }, [])

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' })
  }, [])

  // Set active organization
  async function setActiveOrganization(
    organization: Organization,
    role: UserRole,
    silent = false
  ) {
    try {
      dispatch({ type: 'SET_ORGANIZATION', payload: organization })
      dispatch({ type: 'SET_ORGANIZATION_ROLE', payload: role })
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ORGANIZATION, organization.id)

      // Load subscription data
      try {
        const subscription = await SubscriptionService.getOrganizationSubscription(organization.id)
        dispatch({ type: 'SET_SUBSCRIPTION', payload: subscription })
        
        if (subscription?.subscription_plans) {
          dispatch({ type: 'SET_SUBSCRIPTION_PLAN', payload: subscription.subscription_plans })
        }
      } catch (error) {
        console.error('Error loading subscription:', error)
        // Don't throw, just set null
        dispatch({ type: 'SET_SUBSCRIPTION', payload: null })
        dispatch({ type: 'SET_SUBSCRIPTION_PLAN', payload: null })
      }

      // Load usage metrics
      if (!silent) {
        try {
          const metrics = await UsageService.getUsageMetrics(organization.id)
          dispatch({ type: 'SET_USAGE_METRICS', payload: metrics })
        } catch (error) {
          console.error('Error loading usage metrics:', error)
        }
      }

      // Track organization switch
      AnalyticsService.trackEvent(organization.id, 'organization_switched', {
        organization_name: organization.name,
        user_role: role,
      })
    } catch (error) {
      handleError(error, 'Failed to switch organization')
    }
  }

  // Load user organizations
  const loadUserOrganizations = useCallback(async (userId: string, silent = false) => {
    try {
      if (!silent) {
        dispatch({ type: 'SET_LOADING', payload: true })
      }

      // Check cache first
      const cacheKey = createCacheKey(CACHE_KEYS.USER_ORGANIZATIONS, userId)
      const cachedData = CacheService.get<OrganizationUser[]>(cacheKey)
      
      if (cachedData && silent) {
        const orgs = cachedData.map(ou => ou.organizations).filter(Boolean) as Organization[]
        const roles: Record<string, UserRole> = {}
        
        cachedData.forEach(ou => {
          if (ou.organizations) {
            roles[ou.organization_id] = ou.role
          }
        })

        dispatch({ type: 'SET_ORGANIZATIONS', payload: orgs })
        dispatch({ type: 'SET_USER_ROLES', payload: roles })
        return
      }

      // Check super admin status
      try {
        const isSuperAdmin = await SuperAdminService.checkSuperAdminStatus(userId)
        dispatch({ type: 'SET_SUPER_ADMIN', payload: isSuperAdmin })
      } catch (error) {
        console.error('Error checking super admin status:', error)
      }

      // Get user organizations
      const orgUsers = await OrganizationService.getUserOrganizations(userId)
      
      // Cache the result
      CacheService.set(cacheKey, orgUsers)

       if (orgUsers.length > 0) {
         const orgs = orgUsers.map(ou => ou.organizations).filter(Boolean) as Organization[]
         const roles: Record<string, UserRole> = {}
         
         orgUsers.forEach(ou => {
           if (ou.organizations) {
             roles[ou.organization_id] = ou.role
           }
         })
 
         dispatch({ type: 'SET_ORGANIZATIONS', payload: orgs })
         dispatch({ type: 'SET_USER_ROLES', payload: roles })
 
         // Set active organization
         const savedOrgId = localStorage.getItem(STORAGE_KEYS.ACTIVE_ORGANIZATION)
         const activeOrg = savedOrgId 
           ? orgs.find(org => org.id === savedOrgId) || orgs[0]
           : orgs[0]
 
         if (activeOrg) {
           await setActiveOrganization(activeOrg, roles[activeOrg.id], silent)
         }
       } else {
         // User has no organizations - try auto-creating from pending registration info
         const pending = localStorage.getItem('pendingBusinessInfo')
         if (pending) {
           try {
             const info = JSON.parse(pending)
             const orgName: string = info.businessName || 'My Business'
             const slug = createSlugFromName(orgName)
             await OrganizationService.createOrganization({
               name: orgName,
               slug,
               settings: {
                 business_type: info.businessType,
                 description: info.businessDescription,
                 address: info.address,
                 city: info.city,
                 state: info.state,
                 zip_code: info.zipCode,
                 country: info.country,
               }
             }, userId)
             localStorage.removeItem('pendingBusinessInfo')
 
             // Fetch again after creation
             const createdOrgUsers = await OrganizationService.getUserOrganizations(userId)
             if (createdOrgUsers.length > 0) {
               const orgs = createdOrgUsers.map(ou => ou.organizations).filter(Boolean) as Organization[]
               const roles: Record<string, UserRole> = {}
               createdOrgUsers.forEach(ou => {
                 if (ou.organizations) {
                   roles[ou.organization_id] = ou.role
                 }
               })
               dispatch({ type: 'SET_ORGANIZATIONS', payload: orgs })
               dispatch({ type: 'SET_USER_ROLES', payload: roles })
               const activeOrg = orgs[0]
               if (activeOrg) {
                 await setActiveOrganization(activeOrg, roles[activeOrg.id], silent)
               }
               return
             }
           } catch (e) {
             console.error('Auto-organization setup failed:', e)
           }
         }
 
         // Fallback to empty state
         dispatch({ type: 'SET_ORGANIZATIONS', payload: [] })
         dispatch({ type: 'SET_USER_ROLES', payload: {} })
         dispatch({ type: 'SET_ORGANIZATION', payload: null })
         dispatch({ type: 'SET_ORGANIZATION_ROLE', payload: null })
       }
    } catch (error) {
      handleError(error, 'Failed to load organizations')
      
      // Set empty state to prevent infinite loading
      dispatch({ type: 'SET_ORGANIZATIONS', payload: [] })
      dispatch({ type: 'SET_USER_ROLES', payload: {} })
      dispatch({ type: 'SET_ORGANIZATION', payload: null })
      dispatch({ type: 'SET_ORGANIZATION_ROLE', payload: null })
    } finally {
      if (!silent) {
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    }
        }, [handleError, setActiveOrganization])
  
  // Organization actions
  const switchOrganization = useCallback(async (organizationId: string) => {
    const targetOrg = state.organizations.find(org => org.id === organizationId)
    const targetRole = state.userRoles[organizationId]
    
    if (targetOrg && targetRole) {
      await setActiveOrganization(targetOrg, targetRole)
    }
  }, [state.organizations, state.userRoles, setActiveOrganization])

  const createOrganization = useCallback(async (data: CreateOrganizationData): Promise<Organization> => {
    try {
      if (!state.user) {
        throw new Error('User not authenticated')
      }

      const organization = await OrganizationService.createOrganization(data, state.user.id)
      
      // Refresh organizations
      await loadUserOrganizations(state.user.id)
      
      // Track organization creation
      AnalyticsService.trackEvent(organization.id, 'organization_created', {
        organization_name: organization.name,
      })

      toast.success('Organization created successfully!')
      return organization
    } catch (error) {
      handleError(error, 'Failed to create organization')
      throw error
    }
  }, [state.user, loadUserOrganizations, handleError])

  const updateOrganization = useCallback(async (id: string, data: Partial<Organization>): Promise<Organization> => {
    try {
      const updatedOrg = await OrganizationService.updateOrganization(id, data)
      
      // Update local state
      if (state.organization?.id === id) {
        dispatch({ type: 'SET_ORGANIZATION', payload: updatedOrg })
      }
      
      // Update organizations list
      const updatedOrgs = state.organizations.map(org => 
        org.id === id ? updatedOrg : org
      )
      dispatch({ type: 'SET_ORGANIZATIONS', payload: updatedOrgs })

      // Invalidate cached organizations so fresh data (including currency/country) is fetched next time
      try {
        if (state.user) {
          const cacheKey = createCacheKey(CACHE_KEYS.USER_ORGANIZATIONS, state.user.id)
          CacheService.delete(cacheKey)
        }
      } catch (e) {
        console.warn('Failed to invalidate organizations cache:', e)
      }

      toast.success('Organization updated successfully!')
      return updatedOrg
    } catch (error) {
      handleError(error, 'Failed to update organization')
      throw error
    }
  }, [state.organization, state.organizations, state.user, handleError])

  // User management actions
  const inviteUser = useCallback(async (email: string, role: UserRole): Promise<UserInvitation> => {
    try {
      if (!state.organization || !state.user) {
        throw new Error('Organization or user not available')
      }

      const invitation = await UserService.inviteUser(
        state.organization.id,
        email,
        role,
        state.user.id
      )

      // Track user invitation
      AnalyticsService.trackEvent(state.organization.id, 'user_invited', {
        invited_email: email,
        invited_role: role,
      })

      toast.success(`Invitation sent to ${email}`)
      return invitation
    } catch (error) {
      handleError(error, 'Failed to invite user')
      throw error
    }
  }, [state.organization, state.user, handleError])

  const removeUser = useCallback(async (userId: string): Promise<void> => {
    try {
      if (!state.organization) {
        throw new Error('Organization not available')
      }

      await UserService.removeUser(state.organization.id, userId)
      
      toast.success('User removed successfully')
    } catch (error) {
      handleError(error, 'Failed to remove user')
      throw error
    }
  }, [state.organization, handleError])

  const updateUserRole = useCallback(async (userId: string, role: UserRole): Promise<void> => {
    try {
      if (!state.organization) {
        throw new Error('Organization not available')
      }

      await UserService.updateUserRole(state.organization.id, userId, role)
      
      toast.success('User role updated successfully')
    } catch (error) {
      handleError(error, 'Failed to update user role')
      throw error
    }
  }, [state.organization, handleError])

  // Subscription actions
  const updateSubscription = useCallback(async (planId: string): Promise<void> => {
    try {
      if (!state.organization) {
        throw new Error('Organization not available')
      }

      const subscription = await SubscriptionService.updateSubscription(state.organization.id, planId)
      dispatch({ type: 'SET_SUBSCRIPTION', payload: subscription })
      
      if (subscription.subscription_plans) {
        dispatch({ type: 'SET_SUBSCRIPTION_PLAN', payload: subscription.subscription_plans })
      }

      // Track subscription update
      AnalyticsService.trackEvent(state.organization.id, 'subscription_updated', {
        plan_id: planId,
      })

      toast.success('Subscription updated successfully!')
    } catch (error) {
      handleError(error, 'Failed to update subscription')
      throw error
    }
  }, [state.organization, handleError])

  const cancelSubscription = useCallback(async (): Promise<void> => {
    try {
      if (!state.organization) {
        throw new Error('Organization not available')
      }

      await SubscriptionService.cancelSubscription(state.organization.id)
      
      // Update local state
      if (state.subscription) {
        dispatch({ 
          type: 'SET_SUBSCRIPTION', 
          payload: { ...state.subscription, status: 'canceled' } 
        })
      }

      toast.success('Subscription canceled')
    } catch (error) {
      handleError(error, 'Failed to cancel subscription')
      throw error
    }
  }, [state.organization, state.subscription, handleError])

  // Refresh functions
  const refreshOrganization = useCallback(async (): Promise<void> => {
    if (state.user) {
      await loadUserOrganizations(state.user.id)
    }
  }, [state.user, loadUserOrganizations])

  const loadSystemSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('settings')
        .eq('slug', 'system')
        .maybeSingle()
      if (error) throw error
      dispatch({ type: 'SET_SYSTEM_SETTINGS', payload: data?.settings || null })
    } catch (e) {
      console.warn('Failed to load system settings', e)
      dispatch({ type: 'SET_SYSTEM_SETTINGS', payload: null })
    }
  }, [])

  const refreshUsage = useCallback(async (): Promise<void> => {
    try {
      if (!state.organization) return

      const metrics = await UsageService.getUsageMetrics(state.organization.id)
      dispatch({ type: 'SET_USAGE_METRICS', payload: metrics })
    } catch (error) {
      console.error('Error refreshing usage metrics:', error)
    }
  }, [state.organization])

  // Feature access functions
  const hasFeature = useCallback((feature: string): boolean => {
    if (!state.subscriptionPlan || !isSubscriptionActive(state.subscriptionStatus)) {
      // During trial or if no subscription, allow basic features
      if (isSubscriptionTrialing(state.subscriptionStatus)) {
        const trialFeatures = ['appointments', 'clients', 'staff', 'services', 'reports', 'invoices']
        return trialFeatures.includes(feature)
      }
      return false
    }

    const planFeatures = PLAN_FEATURES[state.subscriptionPlan.slug] || PLAN_FEATURES['starter']
    const featureConfig = planFeatures?.[feature as keyof typeof planFeatures]
    
    return featureConfig?.enabled || false
  }, [state.subscriptionPlan, state.subscriptionStatus])

  const getFeatureAccess = useCallback((feature: string): FeatureAccess => {
    if (!state.subscriptionPlan || !isSubscriptionActive(state.subscriptionStatus)) {
      if (isSubscriptionTrialing(state.subscriptionStatus)) {
        const trialFeatures = ['appointments', 'clients', 'staff', 'services', 'reports', 'invoices']
        const enabled = trialFeatures.includes(feature)
        return calculateFeatureAccess(enabled)
      }
      return calculateFeatureAccess(false)
    }

    const planFeatures = PLAN_FEATURES[state.subscriptionPlan.slug] || PLAN_FEATURES['starter']
    const featureConfig = planFeatures?.[feature as keyof typeof planFeatures]
    
    if (!featureConfig) {
      return calculateFeatureAccess(false)
    }

    const usage = state.usageMetrics[feature] || 0
    return calculateFeatureAccess(featureConfig.enabled, featureConfig.max, usage)
  }, [state.subscriptionPlan, state.subscriptionStatus, state.usageMetrics])

  const canPerformActionCheck = useCallback((action: string, resource: string): boolean => {
    const overrides = (state.organization?.settings as any)?.role_permissions as
      | Record<string, { action: string; resource: string; conditions?: Record<string, any> }[]>
      | undefined
    if (overrides) {
      // Lazy import to avoid circular issues if any
      try {
        const { canPerformActionWithOverrides } = require('./utils') as typeof import('./utils')
        return canPerformActionWithOverrides(state.organizationRole, action, resource, overrides)
      } catch {
        return canPerformAction(state.organizationRole, action, resource)
      }
    }
    return canPerformAction(state.organizationRole, action, resource)
  }, [state.organizationRole, state.organization])

  // Set up auth listener
  useEffect(() => {
    let mounted = true

     const initializeAuth = async () => {
       try {
         // Get initial session
         const { data: { session } } = await supabase.auth.getSession()
         
         if (!mounted) return
 
         if (session?.user) {
           dispatch({ type: 'SET_USER', payload: session.user })
           // Defer data fetching to avoid potential deadlocks
           setTimeout(() => {
             loadUserOrganizations(session.user!.id, true)
               .finally(() => dispatch({ type: 'SET_LOADING', payload: false }))
           }, 0)
         } else {
           dispatch({ type: 'SET_LOADING', payload: false })
         }

         // Load system settings in parallel
         setTimeout(() => {
           loadSystemSettings()
         }, 0)
       } catch (error) {
         if (mounted) {
           handleError(error, 'Failed to initialize authentication')
           dispatch({ type: 'SET_LOADING', payload: false })
         }
       }
     }

    initializeAuth()

    // Listen for auth changes
     const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
       (event, session) => {
         if (!mounted) return
 
         if (session?.user) {
           dispatch({ type: 'SET_USER', payload: session.user })
           // Defer supabase calls to prevent deadlocks
           setTimeout(() => {
             loadUserOrganizations(session.user!.id, true)
           }, 0)
         } else {
           dispatch({ type: 'RESET_STATE' })
           // Clear cache on logout
           CacheService.clear()
           localStorage.removeItem(STORAGE_KEYS.ACTIVE_ORGANIZATION)
         }
       }
     )

    // Cleanup timeout
    const timeoutId = setTimeout(() => {
      if (mounted && state.loading) {
        console.warn('Auth initialization timeout reached')
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    }, 10000) // 10 second timeout

    return () => {
      mounted = false
      authSubscription.unsubscribe()
      clearTimeout(timeoutId)
    }
  }, [loadUserOrganizations, handleError, state.loading, loadSystemSettings])

  // Computed properties
  const isOrganizationOwner = state.organizationRole === 'owner'
  const isOrganizationAdmin = hasMinimumRole(state.organizationRole, 'admin')
  const canManageUsers = hasMinimumRole(state.organizationRole, 'admin')
  const canManageSettings = hasMinimumRole(state.organizationRole, 'admin')
  const canManageSystem = state.isSuperAdmin
  const isTrialing = isSubscriptionTrialing(state.subscriptionStatus)
  const isSubscriptionActiveCheck = isSubscriptionActive(state.subscriptionStatus)
  const daysLeftInTrial = calculateTrialDaysRemaining(state.subscription)
 
  const locale = (state.systemSettings as any)?.regional_formats_enabled ? (navigator?.language || 'en-US') : 'en-US'
  const regionalSettings = (() => {
    const org = state.organization
    const s = (org?.settings as any) || {}
    return s.regional_settings || null
  })()
 
  // Context value
  const contextValue: SaasContextType = {
    // State
    ...state,
    
    // Computed properties
    isOrganizationOwner,
    isOrganizationAdmin,
    canManageUsers,
    canManageSettings,
    canManageSystem,
    isTrialing,
    isSubscriptionActive: isSubscriptionActiveCheck,
    daysLeftInTrial,
    
    // Actions
    switchOrganization,
    refreshOrganization,
    createOrganization,
    updateOrganization,
    inviteUser,
    removeUser,
    updateUserRole,
    updateSubscription,
    cancelSubscription,
    refreshUsage,
    clearError,
    
    // Feature checking
    hasFeature,
    getFeatureAccess,
    canPerformAction: canPerformActionCheck,
 
    // Formatting/Locale
    locale,
    // @ts-expect-error expose regional settings for consumers without typing explosion
    regionalSettings,
  }

  return (
    <SaasContext.Provider value={contextValue}>
      {children}
    </SaasContext.Provider>
  )
}

// Hook to use SaaS context
export const useSaas = (): SaasContextType => {
  const context = useContext(SaasContext)
  if (context === undefined) {
    throw new Error('useSaas must be used within a SaasProvider')
  }
  return context
}
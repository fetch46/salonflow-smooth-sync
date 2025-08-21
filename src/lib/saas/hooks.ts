// SaaS Hooks for React components
import { useState, useCallback } from 'react'
import { useSaas } from './context'
import type {
  Organization,
  UserRole,
  SubscriptionStatus,
  OrganizationSubscription,
  SubscriptionPlan,
  FeatureAccess,
  UsageMetrics,
  CreateOrganizationData,
  UseOrganizationResult,
  UseSubscriptionResult,
  UseFeatureGatingResult,
  UsePermissionsResult,
} from './types'

/**
 * Hook for organization management
 */
export const useOrganization = (): UseOrganizationResult => {
  const {
    organization,
    organizations,
    loading,
    switchOrganization,
    createOrganization,
    updateOrganization,
  } = useSaas()

  return {
    organization,
    organizations: organizations.map(ou => ou.organizations).filter(Boolean) as Organization[],
    loading,
    error: null,
    switchOrganization,
    createOrganization,
    updateOrganization,
  }
}

/**
 * Hook for organization switcher UI
 */
export const useOrganizationSwitcher = () => {
  const { organizations, organization, switchOrganization } = useSaas()
  const [isLoading, setIsLoading] = useState(false)

  const handleSwitch = async (orgId: string) => {
    setIsLoading(true)
    try {
      await switchOrganization(orgId)
    } finally {
      setIsLoading(false)
    }
  }

  return {
    organizations: organizations.map(ou => ou.organizations).filter(Boolean) as Organization[],
    currentOrganization: organization,
    switchOrganization: handleSwitch,
    isLoading,
  }
}

/**
 * Hook for subscription management
 */
export const useSubscription = (): UseSubscriptionResult => {
  const { subscription, subscriptionPlan, isSubscriptionActive, updateSubscription, cancelSubscription } = useSaas()

  return {
    subscription,
    plan: subscriptionPlan,
    status: (subscription?.status as SubscriptionStatus) || null,
    loading: false,
    error: null,
    updateSubscription,
    cancelSubscription,
  }
}

/**
 * Hook for trial status management
 */
export const useTrialStatus = () => {
  const { isTrialing, daysLeftInTrial } = useSaas()

  const upgradeSubscription = async (planId: string) => {
    // Implementation would go here
    console.log('Upgrading to plan:', planId)
  }

  return {
    isTrialing,
    daysLeftInTrial,
    upgradeSubscription,
  }
}

/**
 * Hook for feature gating
 */
export const useFeatureGating = (): UseFeatureGatingResult => {
  const mockUsageMetrics = {}

  const refreshUsage = async () => {
    console.log('Refreshing usage metrics...')
  }

  const hasFeature = (feature: string): boolean => {
    // Mock implementation
    return true
  }

  const getFeatureAccess = (feature: string): FeatureAccess => {
    return {
      enabled: true,
      unlimited: true,
      canCreate: true,
      upgradeRequired: false,
    }
  }

  const enforceLimit = (feature: string): boolean => {
    return false
  }

  return {
    hasFeature,
    getFeatureAccess,
    enforceLimit,
    usageMetrics: mockUsageMetrics,
    loading: false,
    refreshUsage,
  }
}

/**
 * Hook for specific feature access
 */
export const useFeatureAccess = (feature: string) => {
  const { getFeatureAccess } = useFeatureGating()
  
  const access = getFeatureAccess(feature)
  
  return {
    ...access,
    isLoading: false,
    canUpgrade: access.upgradeRequired,
  }
}

/**
 * Hook for usage monitoring
 */
export const useUsageMonitoring = () => {
  const mockUsageMetrics = {}

  const refreshUsage = async () => {
    console.log('Refreshing usage metrics...')
  }

  const getUsagePercentage = (feature: string) => {
    return 0
  }

  const getUsageStatus = (feature: string): 'low' | 'medium' | 'high' | 'exceeded' => {
    return 'low'
  }

  return {
    usageMetrics: mockUsageMetrics,
    refreshUsage,
    getUsagePercentage,
    getUsageStatus,
  }
}

/**
 * Hook for permissions checking
 */
export const usePermissions = (): UsePermissionsResult => {
  const { organizationRole } = useSaas()

  const canPerformAction = (action: string, resource: string): boolean => {
    // Mock implementation - you would implement actual permission logic here
    return organizationRole === 'owner' || organizationRole === 'admin'
  }

  const hasRole = (role: UserRole): boolean => {
    return organizationRole === role
  }

  const hasMinimumRole = (minRole: UserRole): boolean => {
    const roleHierarchy: UserRole[] = ['viewer', 'member', 'staff', 'accountant', 'manager', 'admin', 'owner']
    const userRoleIndex = roleHierarchy.indexOf(organizationRole as UserRole)
    const minRoleIndex = roleHierarchy.indexOf(minRole)
    return userRoleIndex >= minRoleIndex
  }

  return {
    canPerformAction,
    hasRole,
    hasMinimumRole,
    userRole: organizationRole,
  }
}

/**
 * Hook for role-based rendering guard
 */
export const useRoleGuard = (requiredRole: UserRole) => {
  const { hasMinimumRole } = usePermissions()
  
  return {
    canRender: hasMinimumRole(requiredRole),
    isLoading: false,
  }
}

/**
 * Hook for feature-based rendering guard
 */
export const useFeatureGuard = (feature: string) => {
  const { hasFeature } = useFeatureGating()
  
  return {
    canRender: hasFeature(feature),
    isLoading: false,
  }
}

/**
 * Hook for user invitations
 */
export const useUserInvitations = () => {
  const { inviteUser, removeUser, updateUserRole, isOrganizationAdmin } = useSaas()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendInvitation = async (email: string, role: UserRole) => {
    try {
      setLoading(true)
      setError(null)
      await inviteUser(email, role)
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation')
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    sendInvitation,
    loading,
    error,
    canInvite: isOrganizationAdmin,
  }
}

/**
 * Hook for subscription plan comparison
 */
export const useSubscriptionPlans = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(false)

  const comparePlans = (featureKey: string) => {
    return plans.reduce((acc, plan) => {
      acc[plan.id] = plan.features as any
      return acc
    }, {} as Record<string, any>)
  }

  return {
    plans,
    loading,
    comparePlans,
  }
}

/**
 * Hook for organization currency management
 */
export const useOrganizationCurrency = () => {
  const { organization } = useSaas()
  const [currency, setCurrency] = useState({ code: 'USD', symbol: '$' })
  const [loading, setLoading] = useState(false)

  const formatAmount = useCallback(
    (amount: number): string => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.code,
      }).format(amount)
    },
    [currency.code]
  )

  // Backward-compatible helpers used across the app
  const formatUsdCents = useCallback(
    (cents: number): string => {
      const safeCents = Number.isFinite(cents as any) ? (cents as number) : 0
      return formatAmount(safeCents / 100)
    },
    [formatAmount]
  )

  return {
    currency,
    loading,
    // Modern API
    formatAmount,
    // Common consumers expect these
    symbol: currency.symbol,
    format: formatAmount,
    formatUsdCents,
  }
}

/**
 * Hook for organization tax rate
 */
export const useOrganizationTaxRate = () => {
  const { organization } = useSaas()
  
  return {
    taxRate: 0.1, // 10% default
    loading: false,
  }
}

/**
 * Hook for regional settings
 */
export const useRegionalSettings = () => {
  const { organization } = useSaas()
  
  return {
    settings: {
      dateFormat: 'MM/dd/yyyy',
      timeFormat: '12h',
      numberFormat: 'en-US',
      currency: 'USD',
    },
    loading: false,
  }
}

/**
 * Hook for regional number formatting
 */
export const useRegionalNumberFormatter = () => {
  const locale = 'en-US'

  return useCallback(
    (number: number, options?: Intl.NumberFormatOptions): string => {
      return new Intl.NumberFormat(locale, options).format(number)
    },
    [locale]
  )
}

/**
 * Hook for regional currency formatting
 */
export const useRegionalCurrencyFormatter = () => {
  const locale = 'en-US'

  return useCallback(
    (amount: number, currencyCode?: string): string => {
      const currency = currencyCode || 'USD'
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
      }).format(amount)
    },
    [locale]
  )
}

/**
 * Hook for regional date formatting
 */
export const useRegionalDateFormatter = () => {
  const locale = 'en-US'

  return useCallback(
    (date: Date, options?: Intl.DateTimeFormatOptions): string => {
      return date.toLocaleDateString(locale, options)
    },
    [locale]
  )
}
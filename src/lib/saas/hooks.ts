import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSaas } from './context'
import type {
  UseOrganizationResult,
  UseSubscriptionResult,
  UseFeatureGatingResult,
  UsePermissionsResult,
  Organization,
  CreateOrganizationData,
  FeatureAccess,
  UserRole,
} from './types'
import { PLAN_FEATURES } from '@/lib/features'
import { 
  isSubscriptionActive, 
  isSubscriptionTrialing, 
  calculateFeatureAccess,
  hasMinimumRole,
  canPerformAction,
} from './utils'

/**
 * Hook for organization management
 */
export const useOrganization = (): UseOrganizationResult => {
  const {
    organization,
    organizations,
    loading,
    error,
    switchOrganization,
    createOrganization,
    updateOrganization,
  } = useSaas()

  return {
    organization,
    organizations,
    loading,
    error,
    switchOrganization,
    createOrganization,
    updateOrganization,
  }
}

/**
 * Hook for subscription management
 */
export const useSubscription = (): UseSubscriptionResult => {
  const {
    subscription,
    subscriptionPlan: plan,
    subscriptionStatus: status,
    loading,
    error,
    updateSubscription,
    cancelSubscription,
  } = useSaas()

  return {
    subscription,
    plan,
    status,
    loading,
    error,
    updateSubscription,
    cancelSubscription,
  }
}

/**
 * Enhanced feature gating hook
 */
export const useFeatureGating = (): UseFeatureGatingResult => {
  const {
    subscriptionPlan,
    subscriptionStatus,
    usageMetrics,
    refreshUsage,
    loading,
  } = useSaas()

  const hasFeature = useCallback((feature: string): boolean => {
    if (!subscriptionPlan || !isSubscriptionActive(subscriptionStatus)) {
      // During trial or if no subscription, allow basic features
      if (isSubscriptionTrialing(subscriptionStatus)) {
        const trialFeatures = ['appointments', 'clients', 'staff', 'services', 'reports', 'invoices']
        return trialFeatures.includes(feature)
      }
      return false
    }

    const planFeatures = PLAN_FEATURES[subscriptionPlan.slug] || PLAN_FEATURES['starter']
    const featureConfig = planFeatures?.[feature as keyof typeof planFeatures]
    
    return featureConfig?.enabled || false
  }, [subscriptionPlan, subscriptionStatus])

  const getFeatureAccess = useCallback((feature: string): FeatureAccess => {
    if (!subscriptionPlan || !isSubscriptionActive(subscriptionStatus)) {
      if (isSubscriptionTrialing(subscriptionStatus)) {
        const trialFeatures = ['appointments', 'clients', 'staff', 'services', 'reports', 'invoices']
        const enabled = trialFeatures.includes(feature)
        return calculateFeatureAccess(enabled)
      }
      return calculateFeatureAccess(false)
    }

    const planFeatures = PLAN_FEATURES[subscriptionPlan.slug] || PLAN_FEATURES['starter']
    const featureConfig = planFeatures?.[feature as keyof typeof planFeatures]
    
    if (!featureConfig) {
      return calculateFeatureAccess(false)
    }

    const usage = usageMetrics[feature] || 0
    return calculateFeatureAccess(featureConfig.enabled, featureConfig.max, usage)
  }, [subscriptionPlan, subscriptionStatus, usageMetrics])

  const enforceLimit = useCallback((feature: string): boolean => {
    const access = getFeatureAccess(feature)
    return access.canCreate
  }, [getFeatureAccess])

  return {
    hasFeature,
    getFeatureAccess,
    enforceLimit,
    usageMetrics,
    loading,
    refreshUsage,
  }
}

/**
 * Hook for permissions and role checking
 */
export const usePermissions = (): UsePermissionsResult => {
  const { organizationRole, organization } = useSaas()

  const canPerformActionCheck = useCallback((action: string, resource: string): boolean => {
    const overrides = (organization?.settings as any)?.role_permissions
    if (overrides) {
      try {
        const { canPerformActionWithOverrides } = require('./utils') as typeof import('./utils')
        return canPerformActionWithOverrides(organizationRole, action, resource, overrides)
      } catch (error) {
        // Fallback to default check if override helper is unavailable
        return canPerformAction(organizationRole, action, resource)
      }
    }
    return canPerformAction(organizationRole, action, resource)
    }, [organizationRole, organization])
 
   const hasRole = useCallback((role: UserRole): boolean => {
    return organizationRole === role
  }, [organizationRole])

  const hasMinimumRoleCheck = useCallback((minRole: UserRole): boolean => {
    return hasMinimumRole(organizationRole, minRole)
  }, [organizationRole])

  return {
    canPerformAction: canPerformActionCheck,
    hasRole,
    hasMinimumRole: hasMinimumRoleCheck,
    userRole: organizationRole,
  }
}

/**
 * Hook for checking specific feature access
 */
export const useFeatureAccess = (feature: string) => {
  const { getFeatureAccess, hasFeature } = useFeatureGating()
  
  const access = useMemo(() => getFeatureAccess(feature), [getFeatureAccess, feature])
  const enabled = useMemo(() => hasFeature(feature), [hasFeature, feature])

  return {
    access,
    enabled,
    canCreate: access.canCreate,
    isApproachingLimit: access.warningThreshold && access.usage !== undefined 
      ? access.usage >= access.warningThreshold 
      : false,
    isAtLimit: !access.canCreate && access.enabled,
    upgradeRequired: access.upgradeRequired,
  }
}

/**
 * Hook for organization switching with loading state
 */
export const useOrganizationSwitcher = () => {
  const { organizations, organization, switchOrganization } = useSaas()
  const [switching, setSwitching] = useState(false)

  const handleSwitch = useCallback(async (organizationId: string) => {
    if (organization?.id === organizationId) return
    
    setSwitching(true)
    try {
      await switchOrganization(organizationId)
    } finally {
      setSwitching(false)
    }
  }, [organization, switchOrganization])

  return {
    organizations,
    currentOrganization: organization,
    switching,
    switchTo: handleSwitch,
  }
}

/**
 * Hook for user invitation management
 */
export const useUserInvitations = () => {
  const { inviteUser, canManageUsers } = useSaas()
  const [inviting, setInviting] = useState(false)

  const sendInvitation = useCallback(async (email: string, role: UserRole) => {
    if (!canManageUsers) {
      throw new Error('Insufficient permissions to invite users')
    }

    setInviting(true)
    try {
      const invitation = await inviteUser(email, role)
      return invitation
    } finally {
      setInviting(false)
    }
  }, [inviteUser, canManageUsers])

  return {
    sendInvitation,
    inviting,
    canInvite: canManageUsers,
  }
}

/**
 * Hook for subscription plan comparison
 */
export const useSubscriptionPlans = () => {
  const { subscriptionPlan } = useSaas()
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // This would typically fetch from an API
    // For now, using the static PLAN_FEATURES
    setPlans(Object.entries(PLAN_FEATURES).map(([slug, features]) => ({
      slug,
      features,
    })))
  }, [])

  const currentPlan = useMemo(() => {
    return subscriptionPlan ? plans.find(p => p.slug === subscriptionPlan.slug) : null
  }, [subscriptionPlan, plans])

  const compareFeatures = useCallback((feature: string) => {
    return plans.map(plan => ({
      plan: plan.slug,
      enabled: plan.features[feature]?.enabled || false,
      limit: plan.features[feature]?.max,
    }))
  }, [plans])

  return {
    plans,
    currentPlan,
    loading,
    compareFeatures,
  }
}

/**
 * Hook for usage monitoring
 */
export const useUsageMonitoring = () => {
  const { usageMetrics, refreshUsage, subscriptionPlan } = useSaas()
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refreshUsage()
    } finally {
      setRefreshing(false)
    }
  }, [refreshUsage])

  const getUsagePercentage = useCallback((feature: string): number => {
    if (!subscriptionPlan) return 0
    
    const planFeatures = PLAN_FEATURES[subscriptionPlan.slug] || PLAN_FEATURES['starter']
    const featureConfig = planFeatures?.[feature as keyof typeof planFeatures]
    const usage = usageMetrics[feature] || 0
    const limit = featureConfig?.max
    
    if (!limit) return 0
    return Math.min(100, (usage / limit) * 100)
  }, [usageMetrics, subscriptionPlan])

  const getUsageStatus = useCallback((feature: string): 'normal' | 'warning' | 'danger' => {
    const percentage = getUsagePercentage(feature)
    if (percentage >= 95) return 'danger'
    if (percentage >= 80) return 'warning'
    return 'normal'
  }, [getUsagePercentage])

  return {
    usageMetrics,
    refreshing,
    refresh,
    getUsagePercentage,
    getUsageStatus,
  }
}

/**
 * Hook for trial management
 */
export const useTrialStatus = () => {
  const { 
    subscription, 
    isTrialing, 
    daysLeftInTrial, 
    subscriptionPlan,
    updateSubscription 
  } = useSaas()

  const [upgrading, setUpgrading] = useState(false)

  const upgradeToPlan = useCallback(async (planId: string) => {
    setUpgrading(true)
    try {
      await updateSubscription(planId)
    } finally {
      setUpgrading(false)
    }
  }, [updateSubscription])

  const trialStatus = useMemo(() => {
    if (!isTrialing) return null
    
    if (daysLeftInTrial === null) return null
    
    if (daysLeftInTrial <= 0) return 'expired'
    if (daysLeftInTrial <= 3) return 'critical'
    if (daysLeftInTrial <= 7) return 'warning'
    return 'active'
  }, [isTrialing, daysLeftInTrial])

  return {
    isTrialing,
    daysLeftInTrial,
    trialStatus,
    upgradeToPlan,
    upgrading,
    hasActivePlan: !!subscriptionPlan,
  }
}

/**
 * Hook for role-based component rendering
 */
export const useRoleGuard = (requiredRole: UserRole) => {
  const { hasMinimumRole } = usePermissions()
  
  return hasMinimumRole(requiredRole)
}

/**
 * Hook for feature-based component rendering
 */
export const useFeatureGuard = (feature: string) => {
  const { hasFeature } = useFeatureGating()
  
  return hasFeature(feature)
}

export const useOrganizationCurrency = () => {
  const { organization } = useSaas()
  const { locale } = useSaas()
  // Pull regional settings from org
  const regional = (organization?.settings as any)?.regional_settings || null
  const [currency, setCurrency] = useState<{ id: string; code: string; symbol: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [rate, setRate] = useState<number>(1)

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      if (!organization || !(organization as any).currency_id) {
        if (isMounted) {
          setCurrency(null)
          setRate(1)
        }
        return
      }
      try {
        setLoading(true)
        const { supabase } = await import('@/integrations/supabase/client')
        const { data: cur, error: curErr } = await supabase
          .from('currencies')
          .select('id, code, symbol')
          .eq('id', (organization as any).currency_id)
          .maybeSingle()
        if (curErr) throw curErr
        if (isMounted) setCurrency(cur as any)

        // Fetch FX rate relative to USD (plans are stored/priced in USD cents)
        if (cur?.code) {
          const { data: rateRow } = await supabase
            .from('currency_rates')
            .select('rate')
            .eq('code', cur.code)
            .maybeSingle()
          if (isMounted) setRate(rateRow?.rate ? Number(rateRow.rate) : 1)
        } else if (isMounted) {
          setRate(1)
        }
      } catch (_) {
        if (isMounted) {
          setCurrency(null)
          setRate(1)
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    })()
    return () => {
      isMounted = false
    }
  }, [organization])

  const format = useCallback(
    (amount: number | null | undefined, opts?: { decimals?: number }) => {
      const n = typeof amount === 'number' ? amount : 0
      const decimals = opts?.decimals ?? (regional?.currency_decimals ?? 2)
      const sym = currency?.symbol ?? '$'
      // Build a formatter respecting custom separators if provided
      const parts = new Intl.NumberFormat(locale || 'en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).formatToParts(n)
      const ts = regional?.thousand_separator ?? undefined
      const ds = regional?.decimal_separator ?? undefined
      const formatted = parts.map(p => {
        if (p.type === 'group' && ts) return ts
        if (p.type === 'decimal' && ds) return ds
        return p.value
      }).join('')
      return `${sym}${formatted}`
    },
    [currency, locale, regional]
  )

  // Convert a USD amount expressed in cents to the organization currency (major units)
  const convertUsdCentsToOrgMajor = useCallback(
    (usdCents: number | null | undefined): number => {
      const cents = typeof usdCents === 'number' ? usdCents : 0
      const usdMajor = cents / 100
      return usdMajor * (Number.isFinite(rate) && rate > 0 ? rate : 1)
    },
    [rate]
  )

  // Format a USD amount (in cents) into the organization currency string
  const formatUsdCents = useCallback(
    (usdCents: number | null | undefined) => {
      const code = currency?.code ?? 'USD'
      // Default decimals: 0 for truly zero-decimal currencies only
      const zeroDecimalCodes = new Set(['JPY', 'KRW'])
      const decimals = zeroDecimalCodes.has(code) ? 0 : (regional?.currency_decimals ?? 2)
      const major = convertUsdCentsToOrgMajor(usdCents)
      return format(major, { decimals })
    },
    [currency, convertUsdCentsToOrgMajor, format, regional]
  )

  return { 
    currency, 
    symbol: currency?.symbol ?? '$', 
    code: currency?.code ?? 'USD', 
    rate, 
    loading, 
    format, 
    convertUsdCentsToOrgMajor, 
    formatUsdCents,
  }
}

export const useOrganizationTaxRate = () => {
  const { organization } = useSaas()
  const taxRate = useMemo(() => {
    const settings = (organization?.settings as any) || {}
    const raw = settings.tax_rate_percent
    const parsed = typeof raw === 'string' ? parseFloat(raw) : typeof raw === 'number' ? raw : NaN
    return Number.isFinite(parsed) ? parsed : 0
  }, [organization])
  return taxRate
}

export const useRegionalSettings = () => {
  const { organization } = useSaas()
  const settings = (organization?.settings as any) || {}
  return settings.regional_settings || null
}

export const useRegionalNumberFormatter = () => {
  const { locale } = useSaas()
  const regional = useRegionalSettings()

  return useCallback(
    (value: number | null | undefined, opts?: { decimals?: number }) => {
      const num = typeof value === 'number' ? value : 0
      const decimals = typeof opts?.decimals === 'number' ? opts.decimals : (regional?.currency_decimals ?? 2)

      const parts = new Intl.NumberFormat(locale || 'en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).formatToParts(num)

      const thousandSep = regional?.thousand_separator ?? undefined
      const decimalSep = regional?.decimal_separator ?? undefined

      return parts
        .map((p) => {
          if (p.type === 'group' && thousandSep) return thousandSep
          if (p.type === 'decimal' && decimalSep) return decimalSep
          return p.value
        })
        .join('')
    },
    [locale, regional]
  )
}

export const useRegionalDateFormatter = () => {
  const regional = useRegionalSettings()

  const formatDateByPattern = useCallback((date: Date, pattern: string) => {
    const d = date.getDate()
    const m = date.getMonth() + 1
    const y = date.getFullYear()

    const pad2 = (n: number) => String(n).padStart(2, '0')
    const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    let result = pattern
    result = result.replace(/yyyy/g, String(y))
    result = result.replace(/MMM/g, monthNamesShort[m - 1])
    result = result.replace(/MM/g, pad2(m))
    result = result.replace(/dd/g, pad2(d))

    return result
  }, [])

  return useCallback(
    (input: string | Date, opts?: { includeTime?: boolean }) => {
      if (!input) return ''
      const date = new Date(input)
      const pattern = regional?.date_format || 'yyyy-MM-dd'
      let formatted = formatDateByPattern(date, pattern)

      if (opts?.includeTime) {
        const hours = date.getHours()
        const minutes = String(date.getMinutes()).padStart(2, '0')
        const tf = regional?.time_format || '24h'
        if (tf === '12h') {
          const ampm = hours >= 12 ? 'PM' : 'AM'
          const h12 = hours % 12 === 0 ? 12 : hours % 12
          formatted += ` ${h12}:${minutes} ${ampm}`
        } else {
          formatted += ` ${String(hours).padStart(2, '0')}:${minutes}`
        }
      }

      return formatted
    },
    [regional, formatDateByPattern]
  )
}
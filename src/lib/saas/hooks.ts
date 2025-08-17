
import { useContext, useEffect, useMemo, useState } from 'react';
import { SaasContext } from './context';
import { supabase } from '@/integrations/supabase/client';

// Import feature gating hooks from the correct location
export {
  useFeatureGating,
  useFeatureAccess,
  useFeatures
} from '@/hooks/useFeatureGating';

// Re-export the useSaas hook for backward compatibility
export { useSaas } from './context';

// Organization-specific hook
export function useOrganization() {
  const context = useContext(SaasContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within a SaasProvider');
  }
  
  return {
    organization: context.organization,
    loading: context.loading,
    refreshOrganization: context.refreshOrganization
  };
}

// System settings hook
export function useSystemSettings() {
  const context = useContext(SaasContext);
  if (context === undefined) {
    throw new Error('useSystemSettings must be used within a SaasProvider');
  }
  
  return {
    systemSettings: context.systemSettings,
    refreshSystemSettings: context.refreshSystemSettings
  };
}

// Subscription hook
export function useSubscription() {
  const context = useContext(SaasContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SaasProvider');
  }
  
  return {
    subscriptionPlan: context.subscriptionPlan,
    loading: context.loading
  };
}

// Placeholder hooks for exports that are expected by the index file
// These can be implemented later as needed
export function usePermissions() {
  throw new Error('usePermissions is not yet implemented');
}

export function useOrganizationSwitcher() {
  throw new Error('useOrganizationSwitcher is not yet implemented');
}

export function useUserInvitations() {
  throw new Error('useUserInvitations is not yet implemented');
}

export function useSubscriptionPlans() {
  throw new Error('useSubscriptionPlans is not yet implemented');
}

export function useUsageMonitoring() {
  throw new Error('useUsageMonitoring is not yet implemented');
}

export function useTrialStatus() {
  throw new Error('useTrialStatus is not yet implemented');
}

export function useRoleGuard() {
  throw new Error('useRoleGuard is not yet implemented');
}

export function useFeatureGuard() {
  throw new Error('useFeatureGuard is not yet implemented');
}

export function useRegionalNumberFormatter() {
  // Basic numeric formatter; could be enhanced with locale from context
  const context = useContext(SaasContext);
  if (context === undefined) {
    throw new Error('useRegionalNumberFormatter must be used within a SaasProvider');
  }
  const locale = context.locale || 'en-US';
  return useMemo(() => {
    return (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat(locale, options).format(value);
  }, [locale]);
}

export function useRegionalDateFormatter() {
  // Basic date formatter; could be enhanced with locale from context
  const context = useContext(SaasContext);
  if (context === undefined) {
    throw new Error('useRegionalDateFormatter must be used within a SaasProvider');
  }
  const locale = context.locale || 'en-US';
  return useMemo(() => {
    return (value: string | Date, options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, options || { year: 'numeric', month: 'short', day: '2-digit' }).format(new Date(value));
  }, [locale]);
}

export function useOrganizationCurrency() {
  const context = useContext(SaasContext);
  if (context === undefined) {
    throw new Error('useOrganizationCurrency must be used within a SaasProvider');
  }
  
  const formatCurrency = (amount: number, options?: { 
    showSymbol?: boolean; 
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }) => {
    const { 
      showSymbol = true, 
      minimumFractionDigits = 2,
      maximumFractionDigits = 2 
    } = options || {};
    
    const formattedAmount = new Intl.NumberFormat(context.locale || 'en-US', {
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(amount);
    
    return showSymbol ? `${currency.symbol}${formattedAmount}` : formattedAmount;
  };
  
  return {
    currency,
    formatCurrency,
    format,
    formatUsdCents,
    currencyCode: currency.code,
    currencySymbol: currency.symbol,

  };
}

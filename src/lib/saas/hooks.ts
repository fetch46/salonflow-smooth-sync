
import { useContext } from 'react';
import { SaasContext } from './context';

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
  throw new Error('useRegionalNumberFormatter is not yet implemented');
}

export function useRegionalDateFormatter() {
  throw new Error('useRegionalDateFormatter is not yet implemented');
}

export function useOrganizationCurrency() {
  throw new Error('useOrganizationCurrency is not yet implemented');
}

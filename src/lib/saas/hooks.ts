
import { useContext } from 'react';
import { SaasContext } from './context';

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

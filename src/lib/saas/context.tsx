import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { systemSettingsService, SystemSettings } from './services';
import type { Organization, SubscriptionPlan } from './types';

interface SaasContextType {
  organization: Organization | null;
  subscriptionPlan: SubscriptionPlan | null;
  systemSettings: SystemSettings;
  loading: boolean;
  refreshOrganization: () => Promise<void>;
  refreshSystemSettings: () => Promise<void>;
}

const SaasContext = createContext<SaasContextType | undefined>(undefined);

interface SaasProviderProps {
  children: ReactNode;
}

export function SaasProvider({ children }: SaasProviderProps) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    maintenance_mode: false,
    feature_flags: {},
    api_version: '1.0.0'
  });
  const [loading, setLoading] = useState(true);

  const refreshSystemSettings = async () => {
    try {
      const settings = await systemSettingsService.loadSystemSettings();
      setSystemSettings(settings);
    } catch (error) {
      console.warn('Failed to refresh system settings:', error);
      // Keep existing settings on error
    }
  };

  const refreshOrganization = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setOrganization(null);
        setSubscriptionPlan(null);
        return;
      }

      // Get user's organization
      const { data: orgUser } = await supabase
        .from('organization_users')
        .select(`
          organization_id,
          organizations (
            id,
            name,
            slug,
            status,
            settings,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (orgUser?.organizations) {
        const org = orgUser.organizations as Organization;
        setOrganization(org);

        // Get subscription plan if organization exists
        const { data: subscription } = await supabase
          .from('organization_subscriptions')
          .select(`
            *,
            subscription_plans (
              id,
              name,
              description,
              price,
              interval,
              features,
              is_active
            )
          `)
          .eq('organization_id', org.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (subscription?.subscription_plans) {
          setSubscriptionPlan(subscription.subscription_plans as SubscriptionPlan);
        } else {
          setSubscriptionPlan(null);
        }
      } else {
        setOrganization(null);
        setSubscriptionPlan(null);
      }
    } catch (error) {
      console.error('Error refreshing organization:', error);
      setOrganization(null);
      setSubscriptionPlan(null);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      try {
        // Load system settings and organization data in parallel
        await Promise.all([
          refreshSystemSettings(),
          refreshOrganization()
        ]);
      } catch (error) {
        console.error('Error initializing SaaS data:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeData();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        refreshOrganization();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value: SaasContextType = {
    organization,
    subscriptionPlan,
    systemSettings,
    loading,
    refreshOrganization,
    refreshSystemSettings
  };

  return (
    <SaasContext.Provider value={value}>
      {children}
    </SaasContext.Provider>
  );
}

export function useSaas(): SaasContextType {
  const context = useContext(SaasContext);
  if (context === undefined) {
    throw new Error('useSaas must be used within a SaasProvider');
  }
  return context;
}

export { SaasContext };

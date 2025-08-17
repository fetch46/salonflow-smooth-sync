import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { systemSettingsService, SystemSettings } from './services';
import type { 
  Organization, 
  SubscriptionPlan, 
  SaasContextType, 
  OrganizationSubscription, 
  UserRole, 
  UsageMetrics, 
  CreateOrganizationData 
} from './types';

const SaasContext = createContext<SaasContextType | undefined>(undefined);

interface SaasProviderProps {
  children: ReactNode;
}

export function SaasProvider({ children }: SaasProviderProps) {
  const [user, setUser] = useState<any | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationRole, setOrganizationRole] = useState<UserRole | null>(null);
  const [userRoles, setUserRoles] = useState<Record<string, UserRole>>({});

  const [subscription, setSubscription] = useState<OrganizationSubscription | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan | null>(null);

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    maintenance_mode: false,
    feature_flags: {},
    api_version: '1.0.0'
  });

  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSystemSettings = async () => {
    try {
      const settings = await systemSettingsService.loadSystemSettings();
      setSystemSettings(settings);
    } catch (err) {
      console.warn('Failed to refresh system settings:', err);
    }
  };

  const refreshOrganization = async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      setUser(auth?.user || null);

      if (!auth?.user) {
        setOrganization(null);
        setOrganizations([]);
        setOrganizationRole(null);
        setUserRoles({});
        setSubscription(null);
        setSubscriptionPlan(null);
        setIsSuperAdmin(false);
        return;
      }

      // Fetch all organizations for the user
      const { data: orgUsers, error: orgUserErr } = await supabase
        .from('organization_users')
        .select(`
          organization_id,
          role,
          organizations (
            id,
            name,
            slug,
            status,
            settings,
            metadata,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', auth.user.id)
        .eq('is_active', true);

      if (orgUserErr) throw orgUserErr;

      const availableOrganizations = (orgUsers || [])
        .map((ou: any) => ou.organizations)
        .filter(Boolean) as Organization[];

      setOrganizations(availableOrganizations);

      // Build role map
      const rolesMap: Record<string, UserRole> = {};
      (orgUsers || []).forEach((ou: any) => {
        if (ou.organizations?.id && ou.role) rolesMap[ou.organizations.id] = ou.role as UserRole;
      });
      setUserRoles(rolesMap);

      // Determine selected organization
      const preferredOrgId = localStorage.getItem('selected_org_id');
      const selected = availableOrganizations.find(o => o.id === preferredOrgId) || availableOrganizations[0] || null;

      setOrganization(selected || null);
      setOrganizationRole(selected ? rolesMap[selected.id] || null : null);

      if (selected) {
        // Fetch subscription with joined plan
        const { data: sub, error: subErr } = await supabase
          .from('organization_subscriptions')
          .select(`
            *,
            subscription_plans (
              id,
              name,
              slug,
              description,
              price_monthly,
              price_yearly,
              features,
              is_active,
              max_users,
              max_locations,
              sort_order,
              created_at,
              updated_at
            )
          `)
          .eq('organization_id', selected.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (subErr) {
          // Not fatal; proceed without subscription
          setSubscription(null);
          setSubscriptionPlan(null);
        } else {
          setSubscription((sub as any) || null);
          const plan = (sub as any)?.subscription_plans || null;
          setSubscriptionPlan(plan);
        }

        // Super admin flag
        try {
          const { data: isSa } = await supabase.rpc('is_super_admin', { uid: auth.user.id });
          setIsSuperAdmin(Boolean(isSa));
        } catch {
          setIsSuperAdmin(false);
        }
      } else {
        setSubscription(null);
        setSubscriptionPlan(null);
        setIsSuperAdmin(false);
      }

      setError(null);
    } catch (err: any) {
      console.error('Error refreshing organization:', err);
      setOrganization(null);
      setOrganizations([]);
      setOrganizationRole(null);
      setUserRoles({});
      setSubscription(null);
      setSubscriptionPlan(null);
      setIsSuperAdmin(false);
      setError(err?.message || 'Failed to refresh organization');
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          refreshSystemSettings(),
          refreshOrganization(),
        ]);
      } catch (err) {
        console.error('Error initializing SaaS data:', err);
      } finally {
        setLoading(false);
      }
    };

    initializeData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        refreshOrganization();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Actions
  const switchOrganization = async (organizationId: string) => {
    localStorage.setItem('selected_org_id', organizationId);
    await refreshOrganization();
  };

  const clearError = () => setError(null);

  const refreshUsage = async () => {
    // Placeholder: usage collection happens in feature gating hooks
    setUsageMetrics((prev) => ({ ...prev }));
  };

  const createOrganization = async (data: CreateOrganizationData): Promise<Organization> => {
    // Basic implementation: call RPC to create org with current user
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const { data: newOrgId, error: rpcErr } = await supabase.rpc('create_organization_with_user', {
      org_name: data.name,
      org_settings: data.settings as any,
      org_slug: slug,
      plan_id: data.planId || null,
    } as any);
    if (rpcErr) throw rpcErr;

    // Re-fetch organizations to include the new one
    await refreshOrganization();

    // Try to find the created org
    const newlyCreated = organizations.find(o => o.id === newOrgId);
    return newlyCreated || (organization as Organization);
  };

  const updateOrganization = async (id: string, data: Partial<Organization>): Promise<Organization> => {
    const { data: updated, error: updErr } = await supabase
      .from('organizations')
      .update(data as any)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (updErr) throw updErr;
    await refreshOrganization();
    return (updated as any) as Organization;
  };

  const inviteUser = async (_email: string, _role: UserRole) => {
    throw new Error('inviteUser is not implemented');
  };

  const removeUser = async (_userId: string) => {
    throw new Error('removeUser is not implemented');
  };

  const updateUserRole = async (_userId: string, _role: UserRole) => {
    throw new Error('updateUserRole is not implemented');
  };

  const updateSubscription = async (planId: string) => {
    if (!organization?.id) return;
    await supabase
      .from('organization_subscriptions')
      .update({ plan_id: planId })
      .eq('organization_id', organization.id);
    await refreshOrganization();
  };

  const cancelSubscription = async () => {
    if (!organization?.id) return;
    await supabase
      .from('organization_subscriptions')
      .update({ status: 'canceled' })
      .eq('organization_id', organization.id);
    await refreshOrganization();
  };

  // Computed properties
  const isTrialing = Boolean(
    subscription?.status === 'trial' || (subscription?.trial_end && new Date(subscription.trial_end) > new Date())
  );

  const isSubscriptionActive = subscription?.status === 'active';

  const daysLeftInTrial = subscription?.trial_end
    ? Math.max(0, Math.ceil((new Date(subscription.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const isOrganizationOwner = organizationRole === 'owner';
  const isOrganizationAdmin = organizationRole === 'admin' || organizationRole === 'owner';
  const canManageUsers = isOrganizationAdmin || isOrganizationOwner;
  const canManageSettings = isOrganizationAdmin || isOrganizationOwner;
  const canManageSystem = isSuperAdmin;

  const hasFeature = (_feature: string) => true;
  const getFeatureAccess = (_feature: string) => ({
    enabled: true,
    unlimited: true,
    canCreate: true,
    upgradeRequired: false,
  } as any);
  const canPerformAction = (_action: string, _resource: string) => true;

  const value: SaasContextType = {
    // State
    user,
    loading,
    organization,
    organizations,
    organizationRole,
    userRoles,
    subscription,
    subscriptionPlan,
    isSuperAdmin,
    usageMetrics,
    error,
    systemSettings,

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

    // Locale
    locale: 'en-US',

    // System settings
    refreshSystemSettings,
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

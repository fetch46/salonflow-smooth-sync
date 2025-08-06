import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Database, user_role, subscription_status } from '@/integrations/supabase/types';

type Organization = Database['public']['Tables']['organizations']['Row'];
type OrganizationUser = Database['public']['Tables']['organization_users']['Row'];
type OrganizationSubscription = Database['public']['Tables']['organization_subscriptions']['Row'];
type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row'];

interface SaasContextType {
  // User and Auth
  user: User | null;
  loading: boolean;
  
  // Organization
  organization: Organization | null;
  organizationRole: user_role | null;
  isOrganizationOwner: boolean;
  isOrganizationAdmin: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
  
  // Subscription
  subscription: OrganizationSubscription | null;
  subscriptionPlan: SubscriptionPlan | null;
  subscriptionStatus: subscription_status | null;
  isTrialing: boolean;
  isSubscriptionActive: boolean;
  daysLeftInTrial: number | null;
  
  // Feature Flags
  hasFeature: (feature: string) => boolean;
  canAddUsers: () => boolean;
  canAddLocations: () => boolean;
  
  // Actions
  switchOrganization: (organizationId: string) => Promise<void>;
  refreshOrganizationData: () => Promise<void>;
  
  // Organization Management
  organizations: Organization[];
  userRoles: Record<string, user_role>;
}

const SaasContext = createContext<SaasContextType | undefined>(undefined);

export const useSaas = () => {
  const context = useContext(SaasContext);
  if (context === undefined) {
    throw new Error('useSaas must be used within a SaasProvider');
  }
  return context;
};

export const SaasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Core state
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizationRole, setOrganizationRole] = useState<user_role | null>(null);
  const [subscription, setSubscription] = useState<OrganizationSubscription | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, user_role>>({});

  // Define functions before useEffect

  const loadUserOrganizations = useCallback(async (userId: string) => {
    try {
      setLoading(true);

      // Get user's organizations and roles
      const { data: orgUsers, error: orgUsersError } = await supabase
        .from('organization_users')
        .select(`
          role,
          is_active,
          organization_id,
          organizations (*)
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (orgUsersError) throw orgUsersError;

      if (orgUsers && orgUsers.length > 0) {
        const orgs = orgUsers.map(ou => ou.organizations as Organization);
        const roles: Record<string, user_role> = {};
        
        orgUsers.forEach(ou => {
          if (ou.organizations) {
            roles[ou.organization_id] = ou.role;
          }
        });

        setOrganizations(orgs);
        setUserRoles(roles);

        // Set active organization (prioritize saved preference)
        const savedOrgId = localStorage.getItem('activeOrganizationId');
        const activeOrg = savedOrgId 
          ? orgs.find(org => org.id === savedOrgId) || orgs[0]
          : orgs[0];

        if (activeOrg) {
          // Set active organization directly to avoid circular dependency
          setOrganization(activeOrg);
          setOrganizationRole(roles[activeOrg.id]);
          localStorage.setItem('activeOrganizationId', activeOrg.id);
          
          // Load subscription data
          try {
            const { data: subData, error: subError } = await supabase
              .from('organization_subscriptions')
              .select(`
                *,
                subscription_plans (*)
              `)
              .eq('organization_id', activeOrg.id)
              .single();

            if (subError && subError.code !== 'PGRST116') { // Not found error is OK
              throw subError;
            }

            if (subData) {
              setSubscription(subData);
              setSubscriptionPlan(subData.subscription_plans as SubscriptionPlan);
            } else {
              setSubscription(null);
              setSubscriptionPlan(null);
            }
          } catch (error) {
            console.error('Error loading subscription data:', error);
          }
        }
      } else {
        // User has no organizations - they need to create one or be invited
        setOrganizations([]);
        setUserRoles({});
      }
    } catch (error) {
      console.error('Error loading user organizations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const switchOrganization = useCallback(async (organizationId: string) => {
    const newOrg = organizations.find(org => org.id === organizationId);
    const newRole = userRoles[organizationId];
    
    if (newOrg && newRole) {
      // Set active organization directly to avoid circular dependency
      setOrganization(newOrg);
      setOrganizationRole(newRole);
      localStorage.setItem('activeOrganizationId', newOrg.id);
      
      // Load subscription data
      try {
        const { data: subData, error: subError } = await supabase
          .from('organization_subscriptions')
          .select(`
            *,
            subscription_plans (*)
          `)
          .eq('organization_id', newOrg.id)
          .single();

        if (subError && subError.code !== 'PGRST116') { // Not found error is OK
          throw subError;
        }

        if (subData) {
          setSubscription(subData);
          setSubscriptionPlan(subData.subscription_plans as SubscriptionPlan);
        } else {
          setSubscription(null);
          setSubscriptionPlan(null);
        }
      } catch (error) {
        console.error('Error loading subscription data:', error);
      }
    }
  }, [organizations, userRoles]);

  const refreshOrganizationData = useCallback(async () => {
    if (user) {
      await loadUserOrganizations(user.id);
    }
  }, [user, loadUserOrganizations]);

  // Set up auth listener
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserOrganizations(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadUserOrganizations(session.user.id);
        } else {
          // Clear all state when user logs out
          setOrganization(null);
          setOrganizationRole(null);
          setSubscription(null);
          setSubscriptionPlan(null);
          setOrganizations([]);
          setUserRoles({});
          setLoading(false);
        }
      }
    );

    return () => authSubscription.unsubscribe();
  }, [loadUserOrganizations]);

  // Create context value inside the provider to ensure proper initialization order
  const contextValue: SaasContextType = React.useMemo(() => {
    // Computed properties
    const isOrganizationOwner = organizationRole === 'owner';
    const isOrganizationAdmin = organizationRole === 'owner' || organizationRole === 'admin';
    const canManageUsers = ['owner', 'admin'].includes(organizationRole || '');
    const canManageSettings = ['owner', 'admin'].includes(organizationRole || '');

    const subscriptionStatus = subscription?.status || null;
    const isTrialing = subscriptionStatus === 'trial';
    const isSubscriptionActive = ['trial', 'active'].includes(subscriptionStatus || '');

    const daysLeftInTrial = subscription?.trial_end 
      ? Math.max(0, Math.ceil((new Date(subscription.trial_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    // Feature checking
    const hasFeature = (feature: string): boolean => {
      if (!subscriptionPlan || !isSubscriptionActive) {
        // During trial or if no subscription, allow basic features
        const basicFeatures = ['appointments', 'clients', 'staff', 'services', 'reports'];
        return basicFeatures.includes(feature);
      }

      const features = subscriptionPlan.features as Record<string, boolean>;
      return features[feature] === true;
    };

    const canAddUsers = (): boolean => {
      if (!subscriptionPlan || !organization) return false;
      
      // Get current user count for the organization
      const currentUserCount = organizations.length; // This would need to be fetched properly
      return !subscriptionPlan.max_users || currentUserCount < subscriptionPlan.max_users;
    };

    const canAddLocations = (): boolean => {
      if (!subscriptionPlan || !organization) return false;
      
      // Get current location count for the organization
      const currentLocationCount = 1; // This would need to be fetched properly
      return !subscriptionPlan.max_locations || currentLocationCount < subscriptionPlan.max_locations;
    };

    return {
      // User and Auth
      user,
      loading,
      
      // Organization
      organization,
      organizationRole,
      isOrganizationOwner,
      isOrganizationAdmin,
      canManageUsers,
      canManageSettings,
      
      // Subscription
      subscription,
      subscriptionPlan,
      subscriptionStatus,
      isTrialing,
      isSubscriptionActive,
      daysLeftInTrial,
      
      // Feature Flags
      hasFeature,
      canAddUsers,
      canAddLocations,
      
      // Actions
      switchOrganization,
      refreshOrganizationData,
      
      // Organization Management
      organizations,
      userRoles,
    };
  }, [
    user,
    loading,
    organization,
    organizationRole,
    subscription,
    subscriptionPlan,
    organizations,
    userRoles,
    switchOrganization,
    refreshOrganizationData
  ]);

  return <SaasContext.Provider value={contextValue}>{children}</SaasContext.Provider>;
};
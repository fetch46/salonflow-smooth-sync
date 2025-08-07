import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Minimal runtime-safe types to avoid build issues
type Organization = any;
type OrganizationUser = any;
type OrganizationSubscription = any;
type SubscriptionPlan = any;

// Define types locally since they may not be in the generated types
type UserRole = 'owner' | 'admin' | 'manager' | 'staff' | 'member';
type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'unpaid';

interface SaasContextType {
  // User and Auth
  user: User | null;
  loading: boolean;
  
  // Organization
  organization: Organization | null;
  organizationRole: UserRole | null;
  isOrganizationOwner: boolean;
  isOrganizationAdmin: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
  
  // Super Admin
  isSuperAdmin: boolean;
  canManageSystem: boolean;
  
  // Subscription
  subscription: OrganizationSubscription | null;
  subscriptionPlan: SubscriptionPlan | null;
  subscriptionStatus: SubscriptionStatus | null;
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
  refreshOrganizationDataSilently: () => Promise<void>;
  
  // Organization Management
  organizations: Organization[];
  userRoles: Record<string, UserRole>;
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
  const [organizationRole, setOrganizationRole] = useState<UserRole | null>(null);
  const [subscription, setSubscription] = useState<OrganizationSubscription | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, UserRole>>({});
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Define functions before useEffect
  const checkSuperAdminStatus = useCallback(async (userId: string) => {
    try {
      // For now, just set to false since we don't have the super admin function
      setIsSuperAdmin(false);
    } catch (error) {
      console.error('Error checking super admin status:', error);
      setIsSuperAdmin(false);
    }
  }, []);

  const loadUserOrganizations = useCallback(async (userId: string) => {
    try {
      console.log('Loading user organizations for:', userId);
      setLoading(true);



      // Check super admin status first
      try {
        await checkSuperAdminStatus(userId);
      } catch (error) {
        console.error('Error checking super admin status:', error);
        // Continue anyway, don't let this block the flow
      }

      // Get user's organizations and roles
      console.log('Fetching organization users...');
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

      if (orgUsersError) {
        console.error('Error fetching organization users:', orgUsersError);
        throw orgUsersError;
      }

      console.log('Organization users found:', orgUsers?.length || 0);

        if (orgUsers && orgUsers.length > 0) {
          const orgs = orgUsers.map(ou => ou.organizations).filter(Boolean).flat() as Organization[];
          const roles: Record<string, UserRole> = {};
        
          orgUsers.forEach(ou => {
            if (ou.organizations) {
              roles[ou.organization_id] = ou.role as UserRole;
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
          console.log('Setting active organization:', activeOrg.name);
          // Set active organization directly to avoid circular dependency
          setOrganization(activeOrg);
          setOrganizationRole(roles[activeOrg.id]);
          localStorage.setItem('activeOrganizationId', activeOrg.id);
          
          // Load subscription data
          try {
            console.log('Loading subscription data...');
            const { data: subData, error: subError } = await supabase
              .from('organization_subscriptions')
              .select(`
                *,
                subscription_plans (*)
              `)
              .eq('organization_id', activeOrg.id)
              .single();

            if (subError && subError.code !== 'PGRST116') { // Not found error is OK
              console.error('Error loading subscription:', subError);
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
            // Don't throw, just log the error
          }
        }
      } else {
        console.log('No organizations found for user');
        // User has no organizations - they need to create one or be invited
        setOrganizations([]);
        setUserRoles({});
      }
    } catch (error) {
      console.error('Error loading user organizations:', error);
      // Set empty state to prevent infinite loading
      setOrganizations([]);
      setUserRoles({});
      setOrganization(null);
      setOrganizationRole(null);
      setSubscription(null);
      setSubscriptionPlan(null);
    } finally {
      console.log('Finished loading user organizations');
      setLoading(false);
    }
  }, [checkSuperAdminStatus]);

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

  const refreshOrganizationDataSilently = useCallback(async () => {
    if (user) {
      // Don't set loading state, just refresh the data
      try {
        console.log('Silently refreshing organization data...');
        
        // Check super admin status first
        try {
          await checkSuperAdminStatus(user.id);
        } catch (error) {
          console.error('Error checking super admin status:', error);
        }

        // Get user's organizations and roles
        const { data: orgUsers, error: orgUsersError } = await supabase
          .from('organization_users')
          .select(`
            role,
            is_active,
            organization_id,
            organizations (*)
          `)
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (orgUsersError) {
          console.error('Error fetching organization users:', orgUsersError);
          return;
        }

        if (orgUsers && orgUsers.length > 0) {
          const orgs = orgUsers.map(ou => ou.organizations).filter(Boolean).flat() as Organization[];
          const roles: Record<string, UserRole> = {};
          
          orgUsers.forEach(ou => {
            if (ou.organizations) {
              roles[ou.organization_id] = ou.role as UserRole;
            }
          });

          setOrganizations(orgs);
          setUserRoles(roles);

          // Set active organization
          const savedOrgId = localStorage.getItem('activeOrganizationId');
          const activeOrg = savedOrgId 
            ? orgs.find(org => org.id === savedOrgId) || orgs[0]
            : orgs[0];

          if (activeOrg) {
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

              if (subError && subError.code !== 'PGRST116') {
                console.error('Error loading subscription:', subError);
                return;
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
          setOrganizations([]);
          setUserRoles({});
          setOrganization(null);
          setOrganizationRole(null);
          setSubscription(null);
          setSubscriptionPlan(null);
        }
      } catch (error) {
        console.error('Error silently refreshing organization data:', error);
      }
    }
  }, [user, checkSuperAdminStatus]);

  // Set up auth listener
  useEffect(() => {
    console.log('Setting up auth listener...');
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session?.user?.email || 'No user');
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
        console.log('Auth state change:', event, session?.user?.email || 'No user');
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
          setIsSuperAdmin(false);
          setLoading(false);
        }
      }
    );

    // Add a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('Loading timeout reached, forcing loading to false');
        setLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => {
      authSubscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [loadUserOrganizations, loading]);

  // Create context value inside the provider to ensure proper initialization order
  const contextValue: SaasContextType = React.useMemo(() => {
    // Computed properties
    const isOrganizationOwner = organizationRole === 'owner';
    const isOrganizationAdmin = organizationRole === 'owner' || organizationRole === 'admin';
    const canManageUsers = ['owner', 'admin'].includes(organizationRole || '');
    const canManageSettings = ['owner', 'admin'].includes(organizationRole || '');
    
    // Super admin properties
    const canManageSystem = isSuperAdmin;

    const subscriptionStatus = (subscription?.status || null) as SubscriptionStatus;
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
      
      // Super Admin
      isSuperAdmin,
      canManageSystem,
      
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
    refreshOrganizationDataSilently,
      
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
    isSuperAdmin,
    switchOrganization,
    refreshOrganizationData
  ]);

  return <SaasContext.Provider value={contextValue}>{children}</SaasContext.Provider>;
};
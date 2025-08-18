
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Organization, 
  OrganizationUser, 
  UserRole, 
  OrganizationSubscription, 
  SubscriptionPlan,
  SystemSettings 
} from './types';
import { 
  OrganizationService,
  SubscriptionService,
  SystemSettingsService
} from './services';

interface SaasContextType {
  user: User | null;
  organization: Organization | null;
  organizations: Organization[];
  organizationRole: UserRole | null;
  subscription: OrganizationSubscription | null;
  subscriptionPlan: SubscriptionPlan | null;
  isTrialing: boolean;
  daysLeftInTrial: number | null;
  systemSettings: SystemSettings | null;
  isOrganizationOwner: boolean;
  isOrganizationAdmin: boolean;
  switchOrganization: (organizationId: string) => Promise<void>;
  refreshOrganizations: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const SaasContext = createContext<SaasContextType | null>(null);

// Utility function for retrying network requests
const retryWithBackoff = async <T,>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry for certain types of errors
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('unauthorized') || 
            errorMessage.includes('forbidden') ||
            errorMessage.includes('not found')) {
          throw error;
        }
      }
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
};

// Enhanced error handling utility
const handleServiceError = (error: any, context: string): string => {
  console.error(`Error in ${context}:`, error);
  
  if (error?.message?.toLowerCase().includes('failed to fetch')) {
    return `Network error in ${context}. Please check your connection and try again.`;
  }
  
  if (error?.message?.toLowerCase().includes('timeout')) {
    return `Request timeout in ${context}. Please try again.`;
  }
  
  return `An error occurred in ${context}. Please try again later.`;
};

export function SaasProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationRole, setOrganizationRole] = useState<UserRole | null>(null);
  const [subscription, setSubscription] = useState<OrganizationSubscription | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan | null>(null);
  const [isTrialing, setIsTrialing] = useState(false);
  const [daysLeftInTrial, setDaysLeftInTrial] = useState<number | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOrganizationOwner = organizationRole === 'owner';
  const isOrganizationAdmin = organizationRole === 'admin' || organizationRole === 'owner';

  // Load organizations with retry logic
  const loadOrganizations = async (userId: string) => {
    try {
      const orgUsers = await retryWithBackoff(() => OrganizationService.getUserOrganizations(userId));
      const orgs = orgUsers
        .filter(ou => ou.organizations)
        .map(ou => ou.organizations!)
        .filter(Boolean);
      
      setOrganizations(orgs);
      
      if (orgs.length > 0) {
        const currentOrgId = localStorage.getItem('currentOrganizationId');
        const targetOrg = currentOrgId 
          ? orgs.find(org => org.id === currentOrgId) || orgs[0]
          : orgs[0];
        
        await loadOrganization(targetOrg.id);
      }
    } catch (error) {
      const errorMessage = handleServiceError(error, 'loading organizations');
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  // Load organization details with retry logic
  const loadOrganization = async (organizationId: string) => {
    try {
      // Find the organization from loaded organizations
      const org = organizations.find(o => o.id === organizationId);
      if (org) {
        setOrganization(org);
        localStorage.setItem('currentOrganizationId', organizationId);
        
        // Find user's role in this organization from loaded org users
        const orgUsers = await OrganizationService.getUserOrganizations(user!.id);
        const userOrg = orgUsers.find(ou => ou.organization_id === organizationId);
        if (userOrg) {
          setOrganizationRole(userOrg.role);
        }
        
        await loadSubscription(organizationId);
      }
    } catch (error) {
      const errorMessage = handleServiceError(error, 'loading organization');
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  // Load subscription with retry logic
  const loadSubscription = async (organizationId: string) => {
    try {
      const sub = await retryWithBackoff(() => SubscriptionService.getOrganizationSubscription(organizationId));
      setSubscription(sub);
      setSubscriptionPlan(sub?.subscription_plans || null);
      
      if (sub) {
        const now = new Date();
        const trialEnd = sub.trial_end ? new Date(sub.trial_end) : null;
        
        if (trialEnd && trialEnd > now) {
          setIsTrialing(true);
          const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          setDaysLeftInTrial(daysLeft);
        } else {
          setIsTrialing(false);
          setDaysLeftInTrial(null);
        }
      }
    } catch (error) {
      const errorMessage = handleServiceError(error, 'loading subscription');
      console.warn(errorMessage); // Don't show error toast for subscription issues
    }
  };

  // Load system settings with retry logic
  const loadSystemSettings = async () => {
    try {
      const settings = await retryWithBackoff(() => SystemSettingsService.getSystemSettings());
      setSystemSettings(settings);
    } catch (error) {
      const errorMessage = handleServiceError(error, 'loading system settings');
      console.warn(errorMessage); // Don't show error toast for system settings
    }
  };

  // Switch organization
  const switchOrganization = async (organizationId: string) => {
    try {
      await loadOrganization(organizationId);
      toast.success('Organization switched successfully');
    } catch (error) {
      const errorMessage = handleServiceError(error, 'switching organization');
      setError(errorMessage);
      toast.error(errorMessage);
      throw error;
    }
  };

  // Refresh functions
  const refreshOrganizations = async () => {
    if (user) {
      await loadOrganizations(user.id);
    }
  };

  const refreshSubscription = async () => {
    if (organization) {
      await loadSubscription(organization.id);
    }
  };

  // Initialize context
  useEffect(() => {
    let mounted = true;
    
    const initializeAuth = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Use longer timeout for initial auth check
        const { data: { session }, error: sessionError } = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Session check timeout')), 10000)
          )
        ]);
        
        if (sessionError) {
          throw sessionError;
        }
        
        if (!mounted) return;
        
        if (session?.user) {
          setUser(session.user);
          await Promise.all([
            loadOrganizations(session.user.id),
            loadSystemSettings()
          ]);
        }
      } catch (error) {
        if (!mounted) return;
        
        const errorMessage = handleServiceError(error, 'authentication initialization');
        setError(errorMessage);
        
        // For network errors, don't break the app completely
        if (error instanceof Error && error.message.includes('timeout')) {
          toast.error('Connection timeout. Some features may be limited.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          setError(null);
          await Promise.all([
            loadOrganizations(session.user.id),
            loadSystemSettings()
          ]);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setOrganization(null);
          setOrganizations([]);
          setOrganizationRole(null);
          setSubscription(null);
          setSubscriptionPlan(null);
          setIsTrialing(false);
          setDaysLeftInTrial(null);
          setSystemSettings(null);
          setError(null);
          localStorage.removeItem('currentOrganizationId');
        }
      }
    );

    return () => {
      mounted = false;
      authSubscription.unsubscribe();
    };
  }, []);

  const value: SaasContextType = {
    user,
    organization,
    organizations,
    organizationRole,
    subscription,
    subscriptionPlan,
    isTrialing,
    daysLeftInTrial,
    systemSettings,
    isOrganizationOwner,
    isOrganizationAdmin,
    switchOrganization,
    refreshOrganizations,
    refreshSubscription,
    loading,
    error,
  };

  return <SaasContext.Provider value={value}>{children}</SaasContext.Provider>;
}

export function useSaas(): SaasContextType {
  const context = useContext(SaasContext);
  if (!context) {
    throw new Error('useSaas must be used within a SaasProvider');
  }
  return context;
}

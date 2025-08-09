import { useCallback, useEffect, useState } from 'react';
import { useSaas } from '@/lib/saas';
import { PLAN_FEATURES, FeatureLimit, FEATURE_LABELS } from '@/lib/features';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FeatureAccess {
  enabled: boolean;
  limit?: number;
  usage?: number;
  remaining?: number;
  unlimited: boolean;
  canCreate: boolean;
  warningThreshold?: number;
  upgradeRequired: boolean;
}

export interface FeatureGateProps {
  feature: string;
  fallback?: React.ReactNode;
  upgradePrompt?: boolean;
  showWarning?: boolean;
}

// Main feature gating hook
export const useFeatureGating = () => {
  const { 
    subscriptionPlan, 
    organization, 
    isSubscriptionActive,
    isTrialing 
  } = useSaas();

  const [usageData, setUsageData] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  // Get feature access information
  const getFeatureAccess = useCallback((featureName: string): FeatureAccess => {
    // Default to no access if no subscription
    if (!subscriptionPlan || !isSubscriptionActive) {
      // During trial, allow basic features
      if (isTrialing) {
                 const trialFeatures = ['appointments', 'clients', 'staff', 'services', 'reports'];
        const enabled = trialFeatures.includes(featureName);
        return {
          enabled,
          unlimited: false,
          canCreate: enabled,
          upgradeRequired: !enabled,
        };
      }
      
      return {
        enabled: false,
        unlimited: false,
        canCreate: false,
        upgradeRequired: true,
      };
    }

    const planFeatures = PLAN_FEATURES[subscriptionPlan.slug];
    const feature: FeatureLimit = planFeatures?.[featureName as keyof typeof planFeatures];

    if (!feature) {
      return {
        enabled: false,
        unlimited: false,
        canCreate: false,
        upgradeRequired: true,
      };
    }

    const usage = usageData[featureName] || 0;
    const limit = feature.max;
    const unlimited = !limit;
    const remaining = limit ? Math.max(0, limit - usage) : undefined;
    const canCreate = feature.enabled && (unlimited || (remaining !== undefined && remaining > 0));
    const warningThreshold = limit ? Math.floor(limit * 0.8) : undefined; // 80% warning threshold

    return {
      enabled: feature.enabled,
      limit,
      usage,
      remaining,
      unlimited,
      canCreate,
      warningThreshold,
      upgradeRequired: !feature.enabled,
    };
  }, [subscriptionPlan, isSubscriptionActive, isTrialing, usageData]);

  // Check if feature is enabled
  const hasFeature = useCallback((featureName: string): boolean => {
    return getFeatureAccess(featureName).enabled;
  }, [getFeatureAccess]);

  // Check if user can create new items for a feature
  const canCreate = useCallback((featureName: string): boolean => {
    return getFeatureAccess(featureName).canCreate;
  }, [getFeatureAccess]);

  // Check if feature is approaching limit
  const isApproachingLimit = useCallback((featureName: string): boolean => {
    const access = getFeatureAccess(featureName);
    if (access.unlimited || !access.warningThreshold || !access.usage) return false;
    return access.usage >= access.warningThreshold;
  }, [getFeatureAccess]);

  // Check if feature is at limit
  const isAtLimit = useCallback((featureName: string): boolean => {
    const access = getFeatureAccess(featureName);
    if (access.unlimited) return false;
    return !access.canCreate;
  }, [getFeatureAccess]);

  // Get upgrade message for a feature
  const getUpgradeMessage = useCallback((featureName: string): string => {
    const access = getFeatureAccess(featureName);
    const featureLabel = FEATURE_LABELS[featureName] || featureName;
    
    if (!access.enabled) {
      return `${featureLabel} is not available in your current plan. Upgrade to access this feature.`;
    }
    
    if (!access.canCreate) {
      return `You've reached your ${featureLabel} limit. Upgrade to add more.`;
    }
    
    return `Upgrade your plan to unlock ${featureLabel}.`;
  }, [getFeatureAccess]);

  // Fetch current usage data
  const fetchUsageData = useCallback(async () => {
    if (!organization) return;

    setLoading(true);
    try {
      const usage: Record<string, number> = {};

      // Fetch usage counts for various features (only existing tables)
      const queries = [
        { feature: 'appointments', table: 'appointments' },
        { feature: 'clients', table: 'clients' },
        { feature: 'staff', table: 'staff' },
        { feature: 'services', table: 'services' },
        { feature: 'inventory', table: 'inventory_items' },
        { feature: 'purchases', table: 'purchases' },
        { feature: 'job_cards', table: 'job_cards' },
      ];

      const results = await Promise.all(
        queries.map(async ({ feature, table }) => {
          try {
            const { count, error } = await supabase
              .from(table as any)
              .select('*', { count: 'exact', head: true });

            if (error) {
              console.error(`Error fetching ${feature} count:`, error);
              return { feature, count: 0 };
            }
            return { feature, count: count || 0 };
          } catch (err) {
            console.error(`Error with ${feature}:`, err);
            return { feature, count: 0 };
          }
        })
      );

      // Monthly usage (appointments, emails, SMS, etc.)
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Fetch monthly appointments - skip organization filter for now since not all tables have it
      try {
        const { count: appointmentCount } = await supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .gte('appointment_date', monthStart.toISOString().split('T')[0]);

        results.push({ feature: 'monthly_appointments', count: appointmentCount || 0 });
      } catch (err) {
        console.error('Error fetching monthly appointments:', err);
      }

      // Convert results to usage object
      results.forEach(({ feature, count }) => {
        usage[feature] = count;
      });

      setUsageData(usage);
    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setLoading(false);
    }
  }, [organization]);

  // Enforce feature limit before creation
  const enforceLimit = useCallback((featureName: string): boolean => {
    const access = getFeatureAccess(featureName);
    
    if (!access.enabled) {
      toast.error(
        `Feature not available`, 
        {
          description: getUpgradeMessage(featureName),
          action: {
            label: 'Upgrade',
            onClick: () => window.location.href = '/settings?tab=subscription'
          }
        }
      );
      return false;
    }

    if (!access.canCreate) {
      toast.error(
        `Limit reached`, 
        {
          description: getUpgradeMessage(featureName),
          action: {
            label: 'Upgrade',
            onClick: () => window.location.href = '/settings?tab=subscription'
          }
        }
      );
      return false;
    }

    return true;
  }, [getFeatureAccess, getUpgradeMessage]);

  // Show warning if approaching limit
  const showLimitWarning = useCallback((featureName: string) => {
    if (isApproachingLimit(featureName) && !isAtLimit(featureName)) {
      const access = getFeatureAccess(featureName);
      const featureLabel = FEATURE_LABELS[featureName] || featureName;
      
      toast.warning(
        `Approaching ${featureLabel} limit`,
        {
          description: `You've used ${access.usage}/${access.limit}. Consider upgrading your plan.`,
          action: {
            label: 'Upgrade',
            onClick: () => window.location.href = '/settings?tab=subscription'
          }
        }
      );
    }
  }, [isApproachingLimit, isAtLimit, getFeatureAccess]);

  // Refresh usage data
  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  return {
    // Core functions
    hasFeature,
    canCreate,
    getFeatureAccess,
    enforceLimit,
    
    // Limit checking
    isApproachingLimit,
    isAtLimit,
    showLimitWarning,
    
    // Messages
    getUpgradeMessage,
    
    // Data
    usageData,
    loading,
    refreshUsage: fetchUsageData,
  };
};

// Hook for specific feature access
export const useFeatureAccess = (featureName: string) => {
  const { getFeatureAccess, enforceLimit, hasFeature, canCreate } = useFeatureGating();
  
  return {
    access: getFeatureAccess(featureName),
    enforce: () => enforceLimit(featureName),
    hasFeature: hasFeature(featureName),
    canCreate: canCreate(featureName),
  };
};

// Hook for multiple features
export const useFeatures = (featureNames: string[]) => {
  const { hasFeature, getFeatureAccess } = useFeatureGating();
  
  const features = featureNames.reduce((acc, name) => {
    acc[name] = {
      enabled: hasFeature(name),
      access: getFeatureAccess(name),
    };
    return acc;
  }, {} as Record<string, { enabled: boolean; access: FeatureAccess }>);
  
  return features;
};
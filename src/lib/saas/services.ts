
import { supabase } from "@/integrations/supabase/client";

export interface SystemSettings {
  maintenance_mode?: boolean;
  feature_flags?: Record<string, boolean>;
  api_version?: string;
}

export const systemSettingsService = {
  async loadSystemSettings(): Promise<SystemSettings> {
    try {
      // Instead of trying to fetch from a potentially non-existent endpoint,
      // return default settings to prevent fetch errors
      const defaultSettings: SystemSettings = {
        maintenance_mode: false,
        feature_flags: {},
        api_version: '1.0.0'
      };

      // Try to get settings from Supabase if available
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('*')
          .limit(1)
          .maybeSingle();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 is "table not found"
          console.warn('System settings table not found, using defaults:', error);
        }
        
        return data ? { ...defaultSettings, ...data } : defaultSettings;
      } catch (innerError) {
        console.warn('Failed to fetch system settings from database, using defaults:', innerError);
        return defaultSettings;
      }
    } catch (error) {
      console.warn('System settings service error, using defaults:', error);
      return {
        maintenance_mode: false,
        feature_flags: {},
        api_version: '1.0.0'
      };
    }
  }
};

// Placeholder services for exports that are expected by the index file
// These can be implemented later as needed
export const OrganizationService = {
  async updateSubscription(organizationId: string, planId: string) {
    throw new Error('OrganizationService.updateSubscription is not yet implemented');
  }
};

export const SubscriptionService = {
  async updateSubscription(organizationId: string, planId: string) {
    try {
      const { data, error } = await supabase
        .from('organization_subscriptions')
        .update({ subscription_plan_id: planId })
        .eq('organization_id', organizationId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to update subscription:', error);
      throw error;
    }
  }
};

export const UserService = {
  async getCurrentUser() {
    throw new Error('UserService.getCurrentUser is not yet implemented');
  }
};

export const SuperAdminService = {
  async getSystemInfo() {
    throw new Error('SuperAdminService.getSystemInfo is not yet implemented');
  }
};

export const UsageService = {
  async getUsageMetrics() {
    throw new Error('UsageService.getUsageMetrics is not yet implemented');
  }
};

export const AnalyticsService = {
  async trackEvent() {
    throw new Error('AnalyticsService.trackEvent is not yet implemented');
  }
};

export const CacheService = {
  async get() {
    throw new Error('CacheService.get is not yet implemented');
  }
};

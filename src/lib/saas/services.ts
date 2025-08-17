
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

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSaas } from '@/lib/saas';
import { ModuleManager, CORE_MODULES } from '@/lib/modules';

export interface UseModuleAccessResult {
  moduleManager: ModuleManager | null;
  isLoading: boolean;
  enabledModules: string[];
  userPermissions: string[];
  isModuleEnabled: (moduleId: string) => boolean;
  canAccessModule: (moduleId: string) => boolean;
  refreshModules: () => Promise<void>;
}

export function useModuleAccess(): UseModuleAccessResult {
  const { organization, organizationRole, user } = useSaas();
  const [moduleManager, setModuleManager] = useState<ModuleManager | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);

  const loadModules = async () => {
    if (!organization?.id || !user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Load enabled modules for the organization
      const { data: orgModules, error: modulesError } = await supabase
        .from('organization_modules')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('is_enabled', true);

      if (modulesError) throw modulesError;

      // Load user permissions based on role
      const { data: roleData, error: roleError } = await supabase
        .from('staff_roles')
        .select('permissions')
        .eq('organization_id', organization.id)
        .eq('role_name', organizationRole || 'staff')
        .single();

      let permissions: string[] = [];
      
      // If role not found or error, use default permissions
      if (roleError || !roleData) {
        // Default permissions based on role
        switch (organizationRole) {
          case 'owner':
          case 'admin':
            permissions = [
              'appointments:view', 'appointments:create', 'appointments:edit', 'appointments:delete',
              'clients:view', 'clients:create', 'clients:edit', 'clients:delete',
              'invoices:view', 'invoices:create', 'invoices:edit', 'invoices:delete',
              'payments:view', 'payments:create', 'payments:edit', 'payments:delete',
              'job_cards:view', 'job_cards:create', 'job_cards:edit', 'job_cards:delete',
              'purchases:view', 'purchases:create', 'purchases:edit', 'purchases:delete',
              'suppliers:view', 'suppliers:create', 'suppliers:edit', 'suppliers:delete',
              'goods_received:view', 'goods_received:create', 'goods_received:edit',
              'services:view', 'services:create', 'services:edit', 'services:delete',
              'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete',
              'inventory_adjustments:view', 'inventory_adjustments:create', 'inventory_adjustments:edit',
              'transfers:view', 'transfers:create', 'transfers:edit',
              'accounting:view', 'banking:view', 'reports:view',
              'pos:access'
            ];
            break;
          case 'accountant':
            permissions = [
              'appointments:view',
              'clients:view',
              'invoices:view', 'invoices:create', 'invoices:edit',
              'payments:view', 'payments:create', 'payments:edit',
              'accounting:view', 'banking:view', 'reports:view'
            ];
            break;
          case 'manager':
            permissions = [
              'appointments:view', 'appointments:create', 'appointments:edit',
              'clients:view', 'clients:create', 'clients:edit',
              'invoices:view', 'invoices:create',
              'payments:view', 'payments:create',
              'job_cards:view', 'job_cards:create', 'job_cards:edit',
              'services:view', 'services:create', 'services:edit',
              'inventory:view',
              'pos:access'
            ];
            break;
          default: // staff
            permissions = [
              'appointments:view',
              'clients:view',
              'job_cards:view', 'job_cards:edit',
              'services:view',
              'pos:access'
            ];
        }
      } else {
        permissions = roleData.permissions as string[] || [];
      }

      const modules = (orgModules || []).map(m => m.module_name);
      
      // If no modules are explicitly enabled, enable default modules based on role
      const finalModules = modules.length > 0 ? modules : ['appointments', 'sales', 'services'];

      setEnabledModules(finalModules);
      setUserPermissions(permissions);

      const manager = new ModuleManager(finalModules, permissions);
      setModuleManager(manager);

    } catch (error) {
      console.error('Error loading modules:', error);
      // Set default modules on error
      const defaultModules = ['appointments', 'sales', 'services'];
      const defaultPermissions = ['appointments:view', 'clients:view', 'services:view'];
      
      setEnabledModules(defaultModules);
      setUserPermissions(defaultPermissions);
      setModuleManager(new ModuleManager(defaultModules, defaultPermissions));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadModules();
  }, [organization?.id, organizationRole, user?.id]);

  const isModuleEnabled = (moduleId: string): boolean => {
    return moduleManager?.isModuleEnabled(moduleId) || false;
  };

  const canAccessModule = (moduleId: string): boolean => {
    return moduleManager?.canAccessModule(moduleId) || false;
  };

  const refreshModules = async () => {
    await loadModules();
  };

  return {
    moduleManager,
    isLoading,
    enabledModules,
    userPermissions,
    isModuleEnabled,
    canAccessModule,
    refreshModules
  };
}
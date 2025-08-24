import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Settings, Users, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ModuleManagementCardProps {
  planId: string;
  planName: string;
  modules: Array<{
    id: string;
    module_name: string;
    is_enabled: boolean;
  }>;
  onUpdate: () => void;
}

const AVAILABLE_MODULES = [
  { id: 'inventory', name: 'Inventory Management', icon: Building2, description: 'Track products and stock levels' },
  { id: 'reports', name: 'Advanced Reports', icon: Settings, description: 'Generate detailed business reports' },
  { id: 'staff', name: 'Staff Management', icon: Users, description: 'Manage staff and permissions' },
  { id: 'banking', name: 'Banking & Finance', icon: Building2, description: 'Financial tracking and banking' },
  { id: 'pos', name: 'Point of Sale', icon: Settings, description: 'In-store sales system' },
  { id: 'appointments', name: 'Appointments', icon: Users, description: 'Schedule and manage appointments' },
];

export function ModuleManagementCard({ planId, planName, modules, onUpdate }: ModuleManagementCardProps) {
  const [loading, setLoading] = useState(false);

  const handleToggleModule = async (moduleName: string, enabled: boolean) => {
    setLoading(true);
    try {
      if (enabled) {
        // Enable module for this plan
        const { error } = await supabase
          .from('subscription_plan_modules')
          .upsert({
            plan_id: planId,
            module_name: moduleName,
            is_enabled: true
          });
        if (error) throw error;
      } else {
        // Disable module for this plan
        const { error } = await supabase
          .from('subscription_plan_modules')
          .delete()
          .eq('plan_id', planId)
          .eq('module_name', moduleName);
        if (error) throw error;
      }
      
      toast.success(`Module ${enabled ? 'enabled' : 'disabled'} for ${planName}`);
      onUpdate();
    } catch (error: any) {
      console.error('Error updating module:', error);
      toast.error(`Failed to update module: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const isModuleEnabled = (moduleName: string) => {
    return modules.some(m => m.module_name === moduleName && m.is_enabled);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          {planName} - Module Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {AVAILABLE_MODULES.map((module) => {
          const ModuleIcon = module.icon;
          const enabled = isModuleEnabled(module.id);
          
          return (
            <div key={module.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <ModuleIcon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{module.name}</span>
                    {enabled && <Badge variant="secondary">Enabled</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{module.description}</p>
                </div>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={(checked) => handleToggleModule(module.id, checked)}
                disabled={loading}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CORE_MODULES } from '@/lib/modules';
import { Loader2 } from 'lucide-react';
import { useSaas } from '@/lib/saas';

interface ModuleToggleProps {
  moduleId: string;
  isEnabled: boolean;
  onToggle: (moduleId: string, enabled: boolean) => void;
  disabled?: boolean;
}

export function ModuleToggle({ 
  moduleId, 
  isEnabled, 
  onToggle, 
  disabled = false 
}: ModuleToggleProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { organization } = useSaas();
  const module = CORE_MODULES[moduleId];

  if (!module) {
    return null;
  }

  const handleToggle = async (checked: boolean) => {
    setIsLoading(true);
    try {
      if (!organization?.id) return;
      
      const { error } = await supabase
        .from('organization_modules')
        .upsert({
          organization_id: organization.id,
          module_name: moduleId,
          is_enabled: checked,
          enabled_at: checked ? new Date().toISOString() : null
        });

      if (error) throw error;

      onToggle(moduleId, checked);
      toast.success(
        checked 
          ? `${module.name} module has been enabled` 
          : `${module.name} module has been disabled`
      );
    } catch (error) {
      console.error('Error toggling module:', error);
      toast.error('Failed to update module status');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={`transition-colors ${isEnabled ? 'border-green-200 bg-green-50/50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">{module.name}</CardTitle>
            <Badge variant={isEnabled ? 'default' : 'secondary'}>
              {isEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            <Switch
              checked={isEnabled}
              onCheckedChange={handleToggle}
              disabled={disabled || isLoading}
            />
          </div>
        </div>
        <CardDescription>{module.description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 text-sm text-muted-foreground">
          <div><strong>Category:</strong> {module.category}</div>
          {module.dependencies && module.dependencies.length > 0 && (
            <div>
              <strong>Dependencies:</strong>{' '}
              {module.dependencies.map(dep => CORE_MODULES[dep]?.name || dep).join(', ')}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
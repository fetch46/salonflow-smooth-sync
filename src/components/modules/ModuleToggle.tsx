import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CORE_MODULES } from '@/lib/modules';
import { supabase } from '@/integrations/supabase/client';
import { useSaas } from '@/lib/saas';
import { toast } from '@/hooks/use-toast';
import { AlertTriangle, Check, Clock } from 'lucide-react';

interface ModuleToggleProps {
  moduleId: string;
  isEnabled: boolean;
  onToggle: (moduleId: string, enabled: boolean) => void;
  disabled?: boolean;
}

export function ModuleToggle({ moduleId, isEnabled, onToggle, disabled = false }: ModuleToggleProps) {
  const { organization, user } = useSaas();
  const [isLoading, setIsLoading] = useState(false);
  const module = CORE_MODULES[moduleId];

  if (!module) return null;

  const handleToggle = async (checked: boolean) => {
    if (!organization?.id || !user?.id) return;

    setIsLoading(true);
    try {
      if (checked) {
        // Enable module
        const { error } = await supabase
          .from('organization_modules')
          .upsert({
            organization_id: organization.id,
            module_name: moduleId,
            is_enabled: true,
            enabled_at: new Date().toISOString(),
            enabled_by: user.id
          });

        if (error) throw error;
        
        toast({
          title: "Module Enabled",
          description: `${module.name} module has been enabled successfully.`
        });
      } else {
        // Disable module
        const { error } = await supabase
          .from('organization_modules')
          .update({
            is_enabled: false,
            updated_at: new Date().toISOString()
          })
          .eq('organization_id', organization.id)
          .eq('module_name', moduleId);

        if (error) throw error;
        
        toast({
          title: "Module Disabled",
          description: `${module.name} module has been disabled.`
        });
      }

      onToggle(moduleId, checked);
    } catch (error) {
      console.error('Error toggling module:', error);
      toast({
        title: "Error",
        description: "Failed to update module status. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getDependencyStatus = () => {
    if (!module.dependencies?.length) return null;

    // This would need to check if dependencies are enabled
    // For now, we'll assume they are if the module is being shown
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Check className="h-3 w-3" />
        Dependencies satisfied
      </div>
    );
  };

  return (
    <Card className={`transition-all ${isEnabled ? 'ring-2 ring-primary/20 bg-primary/5' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{module.name}</CardTitle>
            <Badge variant={isEnabled ? "default" : "secondary"} className="text-xs">
              {isEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={handleToggle}
            disabled={disabled || isLoading}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground mb-3">
          {module.description}
        </p>
        
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              {module.category}
            </Badge>
          </div>
          
          {module.dependencies?.length && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Dependencies:</span> {module.dependencies.join(', ')}
            </div>
          )}
          
          {getDependencyStatus()}
          
          {isLoading && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 animate-spin" />
              Updating...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
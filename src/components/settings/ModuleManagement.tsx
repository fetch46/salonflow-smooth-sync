import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ModuleToggle } from '@/components/modules/ModuleToggle';
import { CORE_MODULES } from '@/lib/modules';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useSaas } from '@/lib/saas';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTransactionNumbers, TransactionNumberSeries } from '@/hooks/useTransactionNumbers';

export function ModuleManagement() {
  const { organization, isOrganizationOwner, isOrganizationAdmin } = useSaas();
  const { enabledModules, refreshModules } = useModuleAccess();
  const { series, updateSeries, refreshSeries } = useTransactionNumbers();
  const [enabledModulesList, setEnabledModulesList] = useState<string[]>([]);
  const [editingSeries, setEditingSeries] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<TransactionNumberSeries>>({});

  const canManageModules = isOrganizationOwner || isOrganizationAdmin;

  useEffect(() => {
    setEnabledModulesList(enabledModules);
  }, [enabledModules]);

  const handleModuleToggle = async (moduleId: string, enabled: boolean) => {
    if (!organization?.id || !canManageModules) return;

    try {
      const { error } = await supabase
        .from('organization_modules')
        .upsert({
          organization_id: organization.id,
          module_name: moduleId,
          is_enabled: enabled,
          enabled_at: enabled ? new Date().toISOString() : null
        });

      if (error) throw error;

      setEnabledModulesList(prev => 
        enabled 
          ? [...prev.filter(m => m !== moduleId), moduleId]
          : prev.filter(m => m !== moduleId)
      );

      await refreshModules();
      
      toast.success(
        enabled 
          ? `${CORE_MODULES[moduleId]?.name} module enabled`
          : `${CORE_MODULES[moduleId]?.name} module disabled`
      );
    } catch (error) {
      console.error('Error toggling module:', error);
      toast.error('Failed to update module');
    }
  };

  const handleEditSeries = (seriesType: string) => {
    const existingSeries = series.find(s => s.transaction_type === seriesType);
    setEditingSeries(seriesType);
    setFormData(existingSeries || {
      transaction_type: seriesType,
      prefix: seriesType.toUpperCase().substring(0, 3) + '-',
      current_number: 1,
      padding_length: 4,
      format_template: '{prefix}{number}'
    });
  };

  const handleSaveSeries = async () => {
    if (!editingSeries || !formData) return;

    try {
      await updateSeries(editingSeries, formData);
      setEditingSeries(null);
      setFormData({});
      await refreshSeries();
      toast.success('Transaction number series updated');
    } catch (error) {
      console.error('Error updating series:', error);
      toast.error('Failed to update series');
    }
  };

  const groupModulesByCategory = () => {
    const grouped: Record<string, typeof CORE_MODULES[keyof typeof CORE_MODULES][]> = {};
    
    Object.values(CORE_MODULES).forEach(module => {
      if (!grouped[module.category]) {
        grouped[module.category] = [];
      }
      grouped[module.category].push(module);
    });
    
    return grouped;
  };

  const commonTransactionTypes = [
    'invoice', 'receipt', 'purchase', 'expense', 'job_card', 'quotation'
  ];

  if (!canManageModules) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Module Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            You don't have permission to manage modules. Contact your organization administrator.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Module Management</h2>
        <p className="text-muted-foreground">
          Enable or disable modules for your organization and configure transaction numbering.
        </p>
      </div>

      <Tabs defaultValue="modules" className="w-full">
        <TabsList>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="numbering">Transaction Numbering</TabsTrigger>
        </TabsList>

        <TabsContent value="modules" className="space-y-6">
          {Object.entries(groupModulesByCategory()).map(([category, modules]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {category}
                  <Badge variant="secondary">{modules.length} modules</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {modules.map(module => (
                  <ModuleToggle
                    key={module.id}
                    moduleId={module.id}
                    isEnabled={enabledModulesList.includes(module.id)}
                    onToggle={handleModuleToggle}
                  />
                ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="numbering" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Transaction Number Series</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure how transaction numbers are generated for different document types.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {commonTransactionTypes.map(type => {
                const existingSeries = series.find(s => s.transaction_type === type);
                const isEditing = editingSeries === type;

                return (
                  <div key={type} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium capitalize">{type.replace('_', ' ')}</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => isEditing ? setEditingSeries(null) : handleEditSeries(type)}
                      >
                        {isEditing ? 'Cancel' : 'Configure'}
                      </Button>
                    </div>

                    {existingSeries && !isEditing && (
                      <div className="text-sm text-muted-foreground">
                        Current format: {existingSeries.prefix || ''}{String(existingSeries.current_number + 1).padStart(existingSeries.padding_length, '0')}{existingSeries.suffix || ''}
                      </div>
                    )}

                    {isEditing && (
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                          <Label htmlFor="prefix">Prefix</Label>
                          <Input
                            id="prefix"
                            value={formData.prefix || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, prefix: e.target.value }))}
                            placeholder="e.g., INV-"
                          />
                        </div>
                        <div>
                          <Label htmlFor="suffix">Suffix</Label>
                          <Input
                            id="suffix"
                            value={formData.suffix || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, suffix: e.target.value }))}
                            placeholder="e.g., -2024"
                          />
                        </div>
                        <div>
                          <Label htmlFor="padding">Number Length</Label>
                          <Input
                            id="padding"
                            type="number"
                            min="1"
                            max="10"
                            value={formData.padding_length || 4}
                            onChange={(e) => setFormData(prev => ({ ...prev, padding_length: parseInt(e.target.value) }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="current">Current Number</Label>
                          <Input
                            id="current"
                            type="number"
                            min="0"
                            value={formData.current_number || 1}
                            onChange={(e) => setFormData(prev => ({ ...prev, current_number: parseInt(e.target.value) }))}
                          />
                        </div>
                        <div className="col-span-2">
                          <Button onClick={handleSaveSeries} className="w-full">
                            Save Configuration
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
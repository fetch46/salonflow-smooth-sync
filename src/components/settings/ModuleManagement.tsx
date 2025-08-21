import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ModuleToggle } from '@/components/modules/ModuleToggle';
import { CORE_MODULES } from '@/lib/modules';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useTransactionNumbers } from '@/hooks/useTransactionNumbers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useSaas } from '@/lib/saas';
import { 
  Settings as SettingsIcon, 
  Package, 
  Hash, 
  FileText, 
  Palette,
  Save,
  RotateCcw
} from 'lucide-react';

interface TransactionSeriesFormData {
  transaction_type: string;
  prefix: string;
  padding_length: number;
  suffix: string;
}

export function ModuleManagement() {
  const { organization, organizationRole } = useSaas();
  const { enabledModules, refreshModules } = useModuleAccess();
  const { series, updateSeries, refreshSeries } = useTransactionNumbers();
  const [editingSeries, setEditingSeries] = useState<string | null>(null);
  const [seriesForm, setSeriesForm] = useState<TransactionSeriesFormData>({
    transaction_type: '',
    prefix: '',
    padding_length: 3,
    suffix: ''
  });

  const isAdmin = ['owner', 'admin'].includes(organizationRole || '');

  const handleModuleToggle = async (moduleId: string, enabled: boolean) => {
    await refreshModules();
    toast({
      title: enabled ? "Module Enabled" : "Module Disabled",
      description: `${CORE_MODULES[moduleId]?.name || moduleId} module has been ${enabled ? 'enabled' : 'disabled'}.`
    });
  };

  const handleEditSeries = (seriesData: any) => {
    setEditingSeries(seriesData.transaction_type);
    setSeriesForm({
      transaction_type: seriesData.transaction_type,
      prefix: seriesData.prefix || '',
      padding_length: seriesData.padding_length || 3,
      suffix: seriesData.suffix || ''
    });
  };

  const handleSaveSeries = async () => {
    if (!editingSeries) return;

    try {
      await updateSeries(editingSeries, {
        prefix: seriesForm.prefix,
        padding_length: seriesForm.padding_length,
        suffix: seriesForm.suffix
      });
      
      setEditingSeries(null);
      await refreshSeries();
      
      toast({
        title: "Series Updated",
        description: "Transaction number series has been updated successfully."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update transaction number series.",
        variant: "destructive"
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingSeries(null);
    setSeriesForm({
      transaction_type: '',
      prefix: '',
      padding_length: 3,
      suffix: ''
    });
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'job_cards': 'Job Cards',
      'invoices': 'Invoices',
      'payments_received': 'Payments Received',
      'purchases': 'Purchases',
      'payments_made': 'Payments Made',
      'expenses': 'Expenses',
      'inventory_adjustments': 'Inventory Adjustments',
      'stock_transfers': 'Stock Transfers'
    };
    return labels[type] || type.replace('_', ' ').toUpperCase();
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="rounded-full bg-orange-100 p-3 mx-auto w-fit mb-4">
            <SettingsIcon className="h-8 w-8 text-orange-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Access Restricted
          </h3>
          <p className="text-sm text-gray-500">
            Only administrators can manage organization modules and settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <SettingsIcon className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Module Management</h1>
      </div>

      <Tabs defaultValue="modules" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="modules" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Modules
          </TabsTrigger>
          <TabsTrigger value="numbering" className="flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Number Series
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="modules" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization Modules</CardTitle>
              <p className="text-sm text-muted-foreground">
                Enable or disable modules for your organization. Modules control which features are available to your team.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.values(CORE_MODULES).map(module => (
                  <ModuleToggle
                    key={module.id}
                    moduleId={module.id}
                    isEnabled={enabledModules.includes(module.id)}
                    onToggle={handleModuleToggle}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="numbering" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Transaction Number Series</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure automatic numbering for different transaction types.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {series.map(seriesItem => (
                  <div key={seriesItem.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{getTransactionTypeLabel(seriesItem.transaction_type)}</h4>
                        <p className="text-sm text-muted-foreground">
                          Current: {seriesItem.current_number}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {seriesItem.prefix || ''}{String(seriesItem.current_number + 1).padStart(seriesItem.padding_length, '0')}{seriesItem.suffix || ''}
                      </Badge>
                    </div>

                    {editingSeries === seriesItem.transaction_type ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label htmlFor={`prefix-${seriesItem.id}`}>Prefix</Label>
                            <Input
                              id={`prefix-${seriesItem.id}`}
                              value={seriesForm.prefix}
                              onChange={(e) => setSeriesForm(prev => ({ ...prev, prefix: e.target.value }))}
                              placeholder="e.g., JC-"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`padding-${seriesItem.id}`}>Padding Length</Label>
                            <Input
                              id={`padding-${seriesItem.id}`}
                              type="number"
                              min="1"
                              max="10"
                              value={seriesForm.padding_length}
                              onChange={(e) => setSeriesForm(prev => ({ ...prev, padding_length: parseInt(e.target.value) || 3 }))}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`suffix-${seriesItem.id}`}>Suffix</Label>
                            <Input
                              id={`suffix-${seriesItem.id}`}
                              value={seriesForm.suffix}
                              onChange={(e) => setSeriesForm(prev => ({ ...prev, suffix: e.target.value }))}
                              placeholder="e.g., -2024"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleSaveSeries} size="sm">
                            <Save className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                          <Button onClick={handleCancelEdit} variant="outline" size="sm">
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <span className="font-mono bg-muted px-2 py-1 rounded">
                            {seriesItem.prefix || ''}{'{number}'}{seriesItem.suffix || ''}
                          </span>
                        </div>
                        <Button 
                          onClick={() => handleEditSeries(seriesItem)} 
                          variant="outline" 
                          size="sm"
                        >
                          Edit
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Document Templates</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage invoice and email templates for your organization.
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Palette className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Templates Management</h3>
                <p className="text-muted-foreground mb-4">
                  Template management will be available in the next update.
                </p>
                <p className="text-sm text-muted-foreground">
                  This will include invoice templates (80mm & A4) and email templates for booking confirmations and notifications.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
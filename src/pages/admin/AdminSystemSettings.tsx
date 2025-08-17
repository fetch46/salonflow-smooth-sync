import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SystemSettingsService } from "@/lib/saas";
import { isMissingRelationError } from "@/lib/saas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";
import { Settings } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
interface SystemSettings {
  maintenance_mode: boolean;
  support_email: string;
  default_plan_slug: string;
  features: Record<string, boolean>;
  metadata: Record<string, any>;
  regional_formats_enabled?: boolean;
  app_name?: string;
}

const DEFAULT_SETTINGS: SystemSettings = {
  maintenance_mode: false,
  support_email: "support@example.com",
  default_plan_slug: "starter",
  features: {
    allow_signups: true,
    allow_public_booking: true,
  },
  metadata: {},
  regional_formats_enabled: false,
  app_name: 'AURA OS',
};

export default function AdminSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [newCurrency, setNewCurrency] = useState({ code: '', name: '', symbol: '' });
  const [savingCurrency, setSavingCurrency] = useState<boolean>(false);
  const [countries, setCountries] = useState<any[]>([]);
  const [newCountry, setNewCountry] = useState({ code: '', name: '' });
  const [savingCountry, setSavingCountry] = useState<boolean>(false);
useEffect(() => {
    loadSettings();
    loadCurrencies();
    loadCountries();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const s = await SystemSettingsService.getSystemSettings();
      setSettings({ ...DEFAULT_SETTINGS, ...(s as any) });
    } catch (err) {
      console.error("Failed to load settings", err);
      toast.error("Failed to load system settings");
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const ok = await SystemSettingsService.saveSystemSettings(settings);
      if (ok) toast.success("Settings saved");
      else toast.error("Failed to save settings");
    } catch (err) {
      console.error("Failed to save settings", err);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // Data loaders and CRUD for currencies and countries
  const loadCurrencies = async () => {
    try {
      const { data, error } = await supabase
        .from('currencies' as any)
        .select('*')
        .order('code');
      if (error) throw error;
      setCurrencies(data || []);
    } catch (err: any) {
      if (isMissingRelationError(err)) {
        console.warn('Currencies table missing; skipping.');
        setCurrencies([]);
      } else {
        console.error('Failed to load currencies', err);
        toast.error('Failed to load currencies');
      }
    }
  };

  const addCurrency = async () => {
    if (!newCurrency.code || !newCurrency.name || !newCurrency.symbol) {
      toast.error('Please fill code, name and symbol');
      return;
    }
    try {
      setSavingCurrency(true);
      const payload = {
        code: newCurrency.code.trim().toUpperCase(),
        name: newCurrency.name.trim(),
        symbol: newCurrency.symbol.trim(),
        is_active: true,
      };
      const { error } = await supabase.from('currencies' as any).insert([payload]);
      if (error) throw error;
      toast.success('Currency added');
      setNewCurrency({ code: '', name: '', symbol: '' });
      loadCurrencies();
    } catch (err: any) {
      if (isMissingRelationError(err)) {
        toast.error('Currencies table not installed');
      } else {
        console.error('Failed to add currency', err);
        toast.error('Failed to add currency');
      }
    } finally {
      setSavingCurrency(false);
    }
  };

  const toggleCurrencyActive = async (id: string, value: boolean) => {
    try {
      const { error } = await supabase
        .from('currencies' as any)
        .update({ is_active: value })
        .eq('id', id);
      if (error) throw error;
      loadCurrencies();
    } catch (err: any) {
      if (isMissingRelationError(err)) {
        toast.error('Currencies table not installed');
      } else {
        console.error('Failed to update currency', err);
        toast.error('Failed to update currency');
      }
    }
  };

  const deleteCurrency = async (id: string) => {
    if (!confirm('Delete this currency?')) return;
    try {
      const { error } = await supabase
        .from('currencies' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Currency deleted');
      loadCurrencies();
    } catch (err: any) {
      if (isMissingRelationError(err)) {
        toast.error('Currencies table not installed');
      } else {
        console.error('Failed to delete currency', err);
        toast.error('Failed to delete currency');
      }
    }
  };

  const loadCountries = async () => {
    try {
      const { data, error } = await supabase
        .from('countries' as any)
        .select('*')
        .order('name');
      if (error) throw error;
      setCountries(data || []);
    } catch (err) {
      if (isMissingRelationError(err)) {
        console.warn('Countries table missing; skipping.');
        setCountries([]);
      } else {
        console.error('Failed to load countries', err);
        toast.error('Failed to load countries');
      }
    }
  };

  const addCountry = async () => {
    if (!newCountry.code || !newCountry.name) {
      toast.error('Please fill code and name');
      return;
    }
    try {
      setSavingCountry(true);
      const payload = {
        code: newCountry.code.trim().toUpperCase(),
        name: newCountry.name.trim(),
        is_active: true,
      };
      const { error } = await supabase.from('countries' as any).insert([payload]);
      if (error) throw error;
      toast.success('Country added');
      setNewCountry({ code: '', name: '' });
      loadCountries();
    } catch (err: any) {
      if (isMissingRelationError(err)) {
        toast.error('Countries table not installed');
      } else {
        console.error('Failed to add country', err);
        toast.error('Failed to add country');
      }
    } finally {
      setSavingCountry(false);
    }
  };

  const toggleCountryActive = async (id: string, value: boolean) => {
    try {
      const { error } = await supabase
        .from('countries' as any)
        .update({ is_active: value })
        .eq('id', id);
      if (error) throw error;
      loadCountries();
    } catch (err: any) {
      if (isMissingRelationError(err)) {
        toast.error('Countries table not installed');
      } else {
        console.error('Failed to update country', err);
        toast.error('Failed to update country');
      }
    }
  };

  const deleteCountry = async (id: string) => {
    if (!confirm('Delete this country?')) return;
    try {
      const { error } = await supabase
        .from('countries' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Country deleted');
      loadCountries();
    } catch (err: any) {
      if (isMissingRelationError(err)) {
        toast.error('Countries table not installed');
      } else {
        console.error('Failed to delete country', err);
        toast.error('Failed to delete country');
      }
    }
  };

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-500 mt-1">Global configuration for the platform</p>
        </div>

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="currencies">Currencies</TabsTrigger>
            <TabsTrigger value="countries">Countries</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="organizations">Organizations</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Platform Configuration
                </CardTitle>
                <CardDescription>These settings apply to all organizations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between border rounded-md p-4">
                  <div>
                    <Label className="text-base">Maintenance Mode</Label>
                    <p className="text-sm text-gray-500">Temporarily disable user access for maintenance</p>
                  </div>
                  <Switch
                    checked={settings.maintenance_mode}
                    onCheckedChange={(v) => setSettings((s) => ({ ...s, maintenance_mode: v }))}
                  />
                </div>

                <div className="flex items-center justify-between border rounded-md p-4">
                  <div>
                    <Label className="text-base">Regional Formats</Label>
                    <p className="text-sm text-gray-500">Use users' regional settings for dates, currency and number separators</p>
                  </div>
                  <Switch
                    checked={!!settings.regional_formats_enabled}
                    onCheckedChange={(v) => setSettings((s) => ({ ...s, regional_formats_enabled: v }))}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>App Name</Label>
                    <Input
                      value={settings.app_name || ''}
                      onChange={(e) => setSettings((s) => ({ ...s, app_name: e.target.value }))}
                      placeholder="AURA OS"
                    />
                  </div>
                  <div>
                    <Label>Support Email</Label>
                    <Input
                      value={settings.support_email}
                      onChange={(e) => setSettings((s) => ({ ...s, support_email: e.target.value }))}
                      placeholder="support@yourapp.com"
                    />
                  </div>
                  <div>
                    <Label>Default Plan Slug</Label>
                    <Input
                      value={settings.default_plan_slug}
                      onChange={(e) => setSettings((s) => ({ ...s, default_plan_slug: e.target.value }))}
                      placeholder="starter"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Feature Flags</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(settings.features || {}).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between border rounded-md p-3">
                        <div className="text-sm font-medium">{key}</div>
                        <Switch
                          checked={!!value}
                          onCheckedChange={(v) => setSettings((s) => ({ ...s, features: { ...(s.features || {}), [key]: v } }))}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <Label className="text-sm">Raw JSON (advanced)</Label>
                    <Textarea
                      value={JSON.stringify(settings.features, null, 2)}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          setSettings((s) => ({ ...s, features: parsed }));
                        } catch {
                          // ignore parse errors while typing
                        }
                      }}
                      rows={6}
                    />
                    <p className="text-xs text-gray-500">Toggle common flags above or edit JSON directly</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={saveSettings} disabled={saving || loading}>
                    {saving ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="currencies">
            <Card>
              <CardHeader>
                <CardTitle>Currencies</CardTitle>
                <CardDescription>Manage available currencies</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Code</Label>
                    <Input value={newCurrency.code} onChange={(e) => setNewCurrency({ ...newCurrency, code: e.target.value })} placeholder="USD" />
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input value={newCurrency.name} onChange={(e) => setNewCurrency({ ...newCurrency, name: e.target.value })} placeholder="US Dollar" />
                  </div>
                  <div>
                    <Label>Symbol</Label>
                    <Input value={newCurrency.symbol} onChange={(e) => setNewCurrency({ ...newCurrency, symbol: e.target.value })} placeholder="$" />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={addCurrency} disabled={savingCurrency} className="w-full">{savingCurrency ? 'Adding...' : 'Add Currency'}</Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currencies.map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.code}</TableCell>
                          <TableCell>{c.name}</TableCell>
                          <TableCell>{c.symbol}</TableCell>
                          <TableCell>
                            <Switch checked={!!c.is_active} onCheckedChange={(v) => toggleCurrencyActive(c.id, v)} />
                          </TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" onClick={() => deleteCurrency(c.id)}>Delete</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="countries">
            <Card>
              <CardHeader>
                <CardTitle>Countries</CardTitle>
                <CardDescription>Manage supported countries</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Code</Label>
                    <Input value={newCountry.code} onChange={(e) => setNewCountry({ ...newCountry, code: e.target.value })} placeholder="US" />
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input value={newCountry.name} onChange={(e) => setNewCountry({ ...newCountry, name: e.target.value })} placeholder="United States" />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={addCountry} disabled={savingCountry} className="w-full">{savingCountry ? 'Adding...' : 'Add Country'}</Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {countries.map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.code}</TableCell>
                          <TableCell>{c.name}</TableCell>
                          <TableCell>
                            <Switch checked={!!c.is_active} onCheckedChange={(v) => toggleCountryActive(c.id, v)} />
                          </TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" onClick={() => deleteCountry(c.id)}>Delete</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Users Management</CardTitle>
                <CardDescription>View and manage all users and memberships</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-muted-foreground">Open the full users console to manage users, roles and org memberships.</p>
                <Button asChild>
                  <Link to="/admin/users">Open Users Management</Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="organizations">
            <Card>
              <CardHeader>
                <CardTitle>Organizations</CardTitle>
                <CardDescription>Manage organizations, subscriptions and statuses</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-muted-foreground">Open the organizations console to create, edit and manage subscriptions.</p>
                <Button asChild>
                  <Link to="/admin/organizations">Open Organizations</Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SuperAdminLayout>
  );
}
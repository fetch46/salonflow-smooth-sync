import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";
import { Settings } from "lucide-react";

interface SystemSettings {
  maintenance_mode: boolean;
  support_email: string;
  default_plan_slug: string;
  features: Record<string, boolean>;
  metadata: Record<string, any>;
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
};

export default function AdminSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [newCurrency, setNewCurrency] = useState({ code: '', name: '', symbol: '' });
  const [savingCurrency, setSavingCurrency] = useState<boolean>(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // Store system settings in a dedicated row in organizations table with slug 'system'
      const { data, error } = await supabase
        .from("organizations")
        .select("id, settings")
        .eq("slug", "system")
        .maybeSingle();

      if (error) throw error;

      if (data?.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...(data.settings as any) });
      } else {
        // Create a system organization row if not exists
        const { data: created, error: insertError } = await supabase
          .from("organizations")
          .insert({ name: "System", slug: "system", settings: DEFAULT_SETTINGS, status: "active" })
          .select("id, settings")
          .single();
        if (insertError) throw insertError;
        setSettings(created.settings as SystemSettings);
      }
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
      const { error } = await supabase
        .from("organizations")
        .update({ settings })
        .eq("slug", "system");
      if (error) throw error;
      toast.success("Settings saved");
    } catch (err) {
      console.error("Failed to save settings", err);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-500 mt-1">Global configuration for the platform</p>
        </div>

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Label>Feature Flags (JSON)</Label>
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
              <p className="text-xs text-gray-500">Edit feature flags as JSON</p>
            </div>

            <div className="flex justify-end">
              <Button onClick={saveSettings} disabled={saving || loading}>
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
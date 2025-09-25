import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Save, Eye, EyeOff, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSaas } from "@/lib/saas";

interface MpesaSettings {
  enabled: boolean;
  environment: "sandbox" | "production";
  consumer_key: string;
  consumer_secret: string;
  business_short_code: string;
  lipa_na_mpesa_online_passkey: string;
  callback_url: string;
}

export const MpesaSettings = () => {
  const { organization } = useSaas();
  const [loading, setLoading] = useState(false);
  const [showSecrets, setShowSecrets] = useState({
    consumer_secret: false,
    passkey: false
  });
  
  const [settings, setSettings] = useState<MpesaSettings>({
    enabled: false,
    environment: "sandbox",
    consumer_key: "",
    consumer_secret: "",
    business_short_code: "",
    lipa_na_mpesa_online_passkey: "",
    callback_url: ""
  });

  useEffect(() => {
    loadSettings();
  }, [organization?.id]);

  const loadSettings = async () => {
    if (!organization?.id) return;
    
    try {
      setLoading(true);
      const orgSettings = organization.settings as any || {};
      const mpesaSettings = orgSettings.mpesa || {};
      
      setSettings({
        enabled: mpesaSettings.enabled || false,
        environment: mpesaSettings.environment || "sandbox",
        consumer_key: mpesaSettings.consumer_key || "",
        consumer_secret: mpesaSettings.consumer_secret || "",
        business_short_code: mpesaSettings.business_short_code || "",
        lipa_na_mpesa_online_passkey: mpesaSettings.lipa_na_mpesa_online_passkey || "",
        callback_url: mpesaSettings.callback_url || `https://eoxeoyyunhsdvjiwkttx.supabase.co/functions/v1/mpesa-callback`
      });
    } catch (error) {
      console.error("Error loading M-Pesa settings:", error);
      toast.error("Failed to load M-Pesa settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (field: keyof MpesaSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const toggleShowSecret = (field: 'consumer_secret' | 'passkey') => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const saveSettings = async () => {
    if (!organization?.id) return;

    try {
      setLoading(true);
      
      const currentSettings = organization.settings as any || {};
      const updatedSettings = {
        ...currentSettings,
        mpesa: settings
      };

      const { error } = await supabase
        .from('organizations')
        .update({ settings: updatedSettings })
        .eq('id', organization.id);

      if (error) throw error;

      toast.success('M-Pesa settings saved successfully');
    } catch (error) {
      console.error('Error saving M-Pesa settings:', error);
      toast.error('Failed to save M-Pesa settings');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (!settings.consumer_key || !settings.consumer_secret) {
      toast.error("Please fill in Consumer Key and Consumer Secret");
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('test-mpesa-connection', {
        body: {
          consumer_key: settings.consumer_key,
          consumer_secret: settings.consumer_secret,
          environment: settings.environment
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Connection test successful!");
      } else {
        toast.error(data?.error || "Connection test failed");
      }
    } catch (error) {
      console.error('Connection test error:', error);
      toast.error('Connection test failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          M-Pesa Payment Settings
        </CardTitle>
        <CardDescription>
          Configure M-Pesa STK Push integration for mobile payments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Enable M-Pesa Payments</Label>
            <p className="text-sm text-muted-foreground">
              Allow customers to pay via M-Pesa STK Push
            </p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(checked) => handleSettingChange('enabled', checked)}
          />
        </div>

        {settings.enabled && (
          <>
            {/* Environment Selection */}
            <div className="space-y-2">
              <Label htmlFor="environment">Environment</Label>
              <Select 
                value={settings.environment} 
                onValueChange={(value) => handleSettingChange('environment', value as "sandbox" | "production")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                  <SelectItem value="production">Production (Live)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Use Sandbox for testing, Production for live payments
              </p>
            </div>

            {/* API Credentials */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="consumer_key">Consumer Key</Label>
                <Input
                  id="consumer_key"
                  value={settings.consumer_key}
                  onChange={(e) => handleSettingChange('consumer_key', e.target.value)}
                  placeholder="Enter Consumer Key"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="consumer_secret">Consumer Secret</Label>
                <div className="relative">
                  <Input
                    id="consumer_secret"
                    type={showSecrets.consumer_secret ? "text" : "password"}
                    value={settings.consumer_secret}
                    onChange={(e) => handleSettingChange('consumer_secret', e.target.value)}
                    placeholder="Enter Consumer Secret"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => toggleShowSecret('consumer_secret')}
                  >
                    {showSecrets.consumer_secret ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="business_short_code">Business Short Code</Label>
                <Input
                  id="business_short_code"
                  value={settings.business_short_code}
                  onChange={(e) => handleSettingChange('business_short_code', e.target.value)}
                  placeholder="e.g., 174379"
                />
                <p className="text-xs text-muted-foreground">
                  {settings.environment === 'sandbox' ? 'Use 174379 for sandbox testing' : 'Your business short code from Safaricom'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lipa_na_mpesa_online_passkey">Lipa Na M-Pesa Online Passkey</Label>
                <div className="relative">
                  <Input
                    id="lipa_na_mpesa_online_passkey"
                    type={showSecrets.passkey ? "text" : "password"}
                    value={settings.lipa_na_mpesa_online_passkey}
                    onChange={(e) => handleSettingChange('lipa_na_mpesa_online_passkey', e.target.value)}
                    placeholder="Enter Passkey"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => toggleShowSecret('passkey')}
                  >
                    {showSecrets.passkey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Callback URL */}
            <div className="space-y-2">
              <Label htmlFor="callback_url">Callback URL</Label>
              <Input
                id="callback_url"
                value={settings.callback_url}
                onChange={(e) => handleSettingChange('callback_url', e.target.value)}
                placeholder="https://your-domain.com/mpesa-callback"
                readOnly
              />
              <p className="text-sm text-muted-foreground">
                This URL will receive payment confirmations from Safaricom. Configure this in your M-Pesa portal.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={testConnection} 
                disabled={loading || !settings.consumer_key || !settings.consumer_secret}
              >
                Test Connection
              </Button>
              
              <Button onClick={saveSettings} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>

            {/* Help Text */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Setup Instructions:</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Create a developer account at <a href="https://developer.safaricom.co.ke" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">developer.safaricom.co.ke</a></li>
                <li>Create a new app and get your Consumer Key and Consumer Secret</li>
                <li>For sandbox testing, use Business Short Code: 174379</li>
                <li>Configure the callback URL in your M-Pesa portal</li>
                <li>Test the connection before going live</li>
              </ol>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
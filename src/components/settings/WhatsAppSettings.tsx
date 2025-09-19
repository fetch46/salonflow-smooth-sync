import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Save, MessageCircle, TestTube, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useOrganization } from "@/lib/saas/hooks";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";

interface WhatsAppConfig {
  enabled: boolean;
  account_sid: string;
  auth_token: string;
  from_number: string;
  webhook_url: string;
  test_number: string;
}

export function WhatsAppSettings() {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const { organization, updateOrganization } = useOrganization();
  
  const [config, setConfig] = useState<WhatsAppConfig>({
    enabled: false,
    account_sid: '',
    auth_token: '',
    from_number: '',
    webhook_url: '',
    test_number: ''
  });

  useEffect(() => {
    if (organization?.settings) {
      const whatsappSettings = (organization.settings as any)?.whatsapp || {};
      setConfig({
        enabled: whatsappSettings.enabled || false,
        account_sid: whatsappSettings.account_sid || '',
        auth_token: whatsappSettings.auth_token || '',
        from_number: whatsappSettings.from_number || '',
        webhook_url: whatsappSettings.webhook_url || '',
        test_number: whatsappSettings.test_number || ''
      });
    }
  }, [organization]);

  const handleConfigChange = (field: keyof WhatsAppConfig, value: string | boolean) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const saveSettings = async () => {
    if (!organization?.id || !updateOrganization) return;
    
    try {
      setLoading(true);
      
      const currentSettings = organization.settings as any || {};
      const updatedSettings = {
        ...currentSettings,
        whatsapp: config
      };

      await updateOrganization(organization.id, {
        settings: updatedSettings
      });

      toast.success('WhatsApp settings saved successfully');
    } catch (error) {
      console.error('Error saving WhatsApp settings:', error);
      toast.error('Failed to save WhatsApp settings');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (!config.test_number) {
      toast.error('Please enter a test number');
      return;
    }

    try {
      setTesting(true);
      
      // Call our edge function to test WhatsApp connection
      const { data, error } = await supabase.functions.invoke('test-whatsapp', {
        body: {
          organization_id: organization?.id,
          test_number: config.test_number,
          config: config
        }
      });

      if (error) throw error;
      
      if (data.success) {
        toast.success('Test message sent successfully!');
      } else {
        toast.error(`Test failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Error testing WhatsApp:', error);
      toast.error('Failed to test WhatsApp connection');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <WhatsAppIcon className="h-6 w-6 text-green-600" />
            <div>
              <CardTitle>WhatsApp Integration</CardTitle>
              <CardDescription>
                Configure WhatsApp Business API for sending appointment confirmations, reminders, and notifications
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="whatsapp-enabled" className="text-base font-medium">
              Enable WhatsApp Integration
            </Label>
            <Switch
              id="whatsapp-enabled"
              checked={config.enabled}
              onCheckedChange={(checked) => handleConfigChange('enabled', checked)}
            />
          </div>

          {config.enabled && (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You'll need a Twilio account with WhatsApp Business API access. Visit{' '}
                  <a 
                    href="https://console.twilio.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Twilio Console
                  </a>{' '}
                  to get your credentials.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="account-sid">Account SID</Label>
                  <Input
                    id="account-sid"
                    type="password"
                    value={config.account_sid}
                    onChange={(e) => handleConfigChange('account_sid', e.target.value)}
                    placeholder="Enter your Twilio Account SID"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auth-token">Auth Token</Label>
                  <Input
                    id="auth-token"
                    type="password"
                    value={config.auth_token}
                    onChange={(e) => handleConfigChange('auth_token', e.target.value)}
                    placeholder="Enter your Twilio Auth Token"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="from-number">WhatsApp From Number</Label>
                  <Input
                    id="from-number"
                    value={config.from_number}
                    onChange={(e) => handleConfigChange('from_number', e.target.value)}
                    placeholder="whatsapp:+1234567890"
                  />
                  <p className="text-sm text-muted-foreground">
                    Format: whatsapp:+[country code][number]
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">Webhook URL (Optional)</Label>
                  <Input
                    id="webhook-url"
                    value={config.webhook_url}
                    onChange={(e) => handleConfigChange('webhook_url', e.target.value)}
                    placeholder="https://your-domain.com/webhook/whatsapp"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="test-number">Test Phone Number</Label>
                  <Input
                    id="test-number"
                    value={config.test_number}
                    onChange={(e) => handleConfigChange('test_number', e.target.value)}
                    placeholder="+1234567890"
                  />
                  <p className="text-sm text-muted-foreground">
                    Enter a phone number to test the WhatsApp integration
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={testConnection}
                  disabled={testing || !config.account_sid || !config.auth_token || !config.from_number}
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  {testing ? 'Sending Test...' : 'Send Test Message'}
                </Button>
              </div>
            </>
          )}

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={saveSettings} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {config.enabled && (
        <Card>
          <CardHeader>
            <CardTitle>Message Templates</CardTitle>
            <CardDescription>
              Configure default message templates for different types of notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confirmation-template">Appointment Confirmation Template</Label>
              <Textarea
                id="confirmation-template"
                placeholder="Hi {{customer_name}}, your appointment for {{service_name}} on {{date}} at {{time}} has been confirmed. Thank you!"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder-template">Appointment Reminder Template</Label>
              <Textarea
                id="reminder-template"
                placeholder="Reminder: You have an appointment for {{service_name}} tomorrow at {{time}}. See you then!"
                rows={3}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Available variables: {'{{customer_name}}, {{service_name}}, {{date}}, {{time}}, {{location}}'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
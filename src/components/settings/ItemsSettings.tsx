import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Package2, AlertTriangle, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/lib/saas";

export function ItemsSettings() {
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);

  useEffect(() => {
    if (organization?.id) {
      loadSettings();
    }
  }, [organization?.id]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      const { data: orgData } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", organization?.id)
        .single();

      if (orgData?.settings && typeof orgData.settings === 'object') {
        const settings = (orgData.settings as Record<string, any>) || {};
        setAllowNegativeStock(settings.allow_negative_stock || false);
      }

    } catch (error) {
      console.error("Error loading items settings:", error);
      toast.error("Failed to load items settings");
    } finally {
      setLoading(false);
    }
  };

  const handleNegativeStockToggle = async (enabled: boolean) => {
    try {
      const currentSettings = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", organization?.id)
        .single();

      const settings = (currentSettings.data?.settings as Record<string, any>) || {};

      const { error } = await supabase
        .from("organizations")
        .update({
          settings: {
            ...settings,
            allow_negative_stock: enabled
          }
        })
        .eq("id", organization?.id);

      if (error) throw error;

      setAllowNegativeStock(enabled);
      toast.success(`Negative stock ${enabled ? 'allowed' : 'disallowed'} successfully`);
    } catch (error) {
      console.error("Error updating negative stock setting:", error);
      toast.error("Failed to update negative stock setting");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package2 className="h-5 w-5 text-primary" />
            Items & Inventory Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading items settings...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Inventory Control Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Inventory Control
          </CardTitle>
          <CardDescription>
            Configure how inventory levels are managed in your system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-medium">Allow Negative Stock</Label>
              <p className="text-sm text-muted-foreground">
                When disabled, prevents sales and invoices when there's insufficient stock
              </p>
            </div>
            <Switch
              checked={allowNegativeStock}
              onCheckedChange={handleNegativeStockToggle}
            />
          </div>

          {!allowNegativeStock && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Stock Validation Enabled:</strong> The system will prevent saving invoices, POS sales, 
                and job cards when there's insufficient stock for products or services. This helps maintain 
                accurate inventory levels and prevents overselling.
              </AlertDescription>
            </Alert>
          )}

          {allowNegativeStock && (
            <Alert>
              <Package2 className="h-4 w-4" />
              <AlertDescription>
                <strong>Negative Stock Allowed:</strong> Sales can proceed even when inventory levels are 
                insufficient. This may result in negative stock levels that will need to be reconciled later. 
                Use caution with this setting to avoid inventory discrepancies.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Additional Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package2 className="h-5 w-5 text-primary" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-sm">When Negative Stock is Disabled:</h4>
              <ul className="text-sm text-muted-foreground mt-1 ml-4 space-y-1">
                <li>• POS sales will check available stock before allowing completion</li>
                <li>• Invoice creation will validate stock levels for all line items</li>
                <li>• Job card completion will verify product availability</li>
                <li>• Users will receive clear error messages when stock is insufficient</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-sm">When Negative Stock is Enabled:</h4>
              <ul className="text-sm text-muted-foreground mt-1 ml-4 space-y-1">
                <li>• Sales can proceed regardless of current stock levels</li>
                <li>• Inventory levels may go negative</li>
                <li>• Useful for businesses that order stock as needed</li>
                <li>• Requires manual monitoring of inventory levels</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
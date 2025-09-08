import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { DollarSign, Calculator } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/lib/saas";

interface Account {
  id: string;
  account_name: string;
  account_code: string;
  account_type: string;
}

interface PaymentMethodAccount {
  payment_method: string;
  account_id: string;
  account_name?: string;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Credit/Debit Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'check', label: 'Check' },
  { value: 'other', label: 'Other' }
];

export function AccountingSettings() {
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [paymentMethodAccounts, setPaymentMethodAccounts] = useState<PaymentMethodAccount[]>([]);

  useEffect(() => {
    if (organization?.id) {
      loadData();
    }
  }, [organization?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const accountsRes = await supabase
        .from("accounts")
        .select("id, account_name, account_code, account_type")
        .eq("organization_id", organization?.id)
        .in("account_type", ["Asset", "Liability"])
        .eq("is_active", true)
        .order("account_name");

      if (accountsRes.error) throw accountsRes.error;

      setAccounts(accountsRes.data || []);

      // Load organization settings
      const { data: orgData } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", organization?.id)
        .single();

      if (orgData?.settings && typeof orgData.settings === 'object') {
        const settings = orgData.settings as any;
        setTaxEnabled(settings.tax_enabled || false);
        setPaymentMethodAccounts(settings.payment_method_accounts || []);
      }

    } catch (error) {
      console.error("Error loading accounting data:", error);
      toast.error("Failed to load accounting settings");
    } finally {
      setLoading(false);
    }
  };

  const handleTaxToggle = async (enabled: boolean) => {
    try {
      const currentSettings = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", organization?.id)
        .single();

      const settings = (currentSettings.data?.settings as any) || {};

      const { error } = await supabase
        .from("organizations")
        .update({
          settings: {
            ...settings,
            tax_enabled: enabled
          }
        })
        .eq("id", organization?.id);

      if (error) throw error;

      setTaxEnabled(enabled);
      toast.success(`Tax ${enabled ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error("Error updating tax setting:", error);
      toast.error("Failed to update tax setting");
    }
  };

  const handlePaymentAccountChange = async (paymentMethod: string, accountId: string) => {
    try {
      const currentSettings = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", organization?.id)
        .single();

      const settings = (currentSettings.data?.settings as any) || {};
      const currentAccounts = settings.payment_method_accounts || [];
      
      const updatedAccounts = currentAccounts.filter((pma: PaymentMethodAccount) => 
        pma.payment_method !== paymentMethod
      );
      
      if (accountId) {
        const account = accounts.find(acc => acc.id === accountId);
        updatedAccounts.push({
          payment_method: paymentMethod,
          account_id: accountId,
          account_name: account?.account_name
        });
      }

      const { error } = await supabase
        .from("organizations")
        .update({
          settings: {
            ...settings,
            payment_method_accounts: updatedAccounts
          }
        })
        .eq("id", organization?.id);

      if (error) throw error;

      setPaymentMethodAccounts(updatedAccounts);
      toast.success("Payment method account updated successfully");
    } catch (error) {
      console.error("Error updating payment method account:", error);
      toast.error("Failed to update payment method account");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Accounting Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading accounting settings...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment Method Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Default Deposit Accounts
          </CardTitle>
          <CardDescription>
            Set default accounts for different payment methods
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PAYMENT_METHODS.map((method) => {
              const currentAccount = paymentMethodAccounts.find(
                pma => pma.payment_method === method.value
              );
              
              return (
                <div key={method.value}>
                  <Label>{method.label} Deposits</Label>
                  <Select 
                    value={currentAccount?.account_id || ""} 
                    onValueChange={(value) => handlePaymentAccountChange(method.value, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select account for ${method.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No account selected</SelectItem>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.account_code} - {account.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tax Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Tax Settings
          </CardTitle>
          <CardDescription>
            Configure tax calculations and settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Enable Tax</Label>
              <p className="text-sm text-muted-foreground">
                Enable tax calculations across the system
              </p>
            </div>
            <Switch
              checked={taxEnabled}
              onCheckedChange={handleTaxToggle}
            />
          </div>

          {taxEnabled && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="text-muted-foreground">
                  Tax rate management will be available after database types are updated.
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CreditCard, Plus, Edit, Trash2, Percent, DollarSign, Calculator } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/lib/saas";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const taxRateFormSchema = z.object({
  name: z.string().min(2, "Tax rate name must be at least 2 characters"),
  rate: z.number().min(0, "Rate must be 0 or greater").max(100, "Rate cannot exceed 100%"),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
  is_default: z.boolean().default(false),
});

type TaxRateFormValues = z.infer<typeof taxRateFormSchema>;

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  description?: string;
  is_active: boolean;
  is_default: boolean;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

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
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editingTaxRate, setEditingTaxRate] = useState<TaxRate | null>(null);
  const [showTaxDialog, setShowTaxDialog] = useState(false);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [paymentMethodAccounts, setPaymentMethodAccounts] = useState<PaymentMethodAccount[]>([]);
  
  const form = useForm<TaxRateFormValues>({
    resolver: zodResolver(taxRateFormSchema),
    defaultValues: {
      name: "",
      rate: 0,
      description: "",
      is_active: true,
      is_default: false,
    },
  });

  useEffect(() => {
    if (organization?.id) {
      loadData();
    }
  }, [organization?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [taxRatesRes, accountsRes] = await Promise.all([
        supabase
          .from("tax_rates")
          .select("*")
          .eq("organization_id", organization?.id)
          .order("name"),
        supabase
          .from("accounts")
          .select("id, account_name, account_code, account_type")
          .eq("organization_id", organization?.id)
          .in("account_type", ["Asset", "Liability"])
          .eq("is_active", true)
          .order("account_name")
      ]);

      if (taxRatesRes.error) throw taxRatesRes.error;
      if (accountsRes.error) throw accountsRes.error;

      setTaxRates(taxRatesRes.data || []);
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

  const handleTaxSubmit = async (values: TaxRateFormValues) => {
    try {
      if (editingTaxRate) {
        const { error } = await supabase
          .from("tax_rates")
          .update({
            ...values,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingTaxRate.id);

        if (error) throw error;
        toast.success("Tax rate updated successfully");
      } else {
        const { error } = await supabase
          .from("tax_rates")
          .insert({
            ...values,
            organization_id: organization?.id,
          });

        if (error) throw error;
        toast.success("Tax rate created successfully");
      }

      setShowTaxDialog(false);
      setEditingTaxRate(null);
      form.reset();
      loadData();
    } catch (error) {
      console.error("Error saving tax rate:", error);
      toast.error("Failed to save tax rate");
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

  const handleEditTaxRate = (taxRate: TaxRate) => {
    setEditingTaxRate(taxRate);
    form.reset({
      name: taxRate.name,
      rate: taxRate.rate,
      description: taxRate.description || "",
      is_active: taxRate.is_active,
      is_default: taxRate.is_default,
    });
    setShowTaxDialog(true);
  };

  const handleDeleteTaxRate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tax rate?")) return;

    try {
      const { error } = await supabase
        .from("tax_rates")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Tax rate deleted successfully");
      loadData();
    } catch (error) {
      console.error("Error deleting tax rate:", error);
      toast.error("Failed to delete tax rate");
    }
  };

  const openCreateTaxDialog = () => {
    setEditingTaxRate(null);
    form.reset();
    setShowTaxDialog(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
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
            Configure tax rates and tax application settings
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
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium">Tax Rates</h4>
                  <p className="text-sm text-muted-foreground">
                    {taxRates.length} tax rate(s) configured
                  </p>
                </div>
                <Dialog open={showTaxDialog} onOpenChange={setShowTaxDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={openCreateTaxDialog} className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Add Tax Rate
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>
                        {editingTaxRate ? "Edit Tax Rate" : "Create New Tax Rate"}
                      </DialogTitle>
                      <DialogDescription>
                        {editingTaxRate 
                          ? "Update the tax rate details below" 
                          : "Add a new tax rate to your organization"
                        }
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(handleTaxSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tax Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="VAT" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="rate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Rate (%)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    step="0.01"
                                    placeholder="8.5" 
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Input placeholder="Value Added Tax" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex items-center space-x-4">
                          <FormField
                            control={form.control}
                            name="is_active"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <FormLabel>Active</FormLabel>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="is_default"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <FormLabel>Default Rate</FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setShowTaxDialog(false)}>
                            Cancel
                          </Button>
                          <Button type="submit">
                            {editingTaxRate ? "Update Tax Rate" : "Create Tax Rate"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taxRates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <div className="text-muted-foreground">
                            No tax rates configured yet. Create your first tax rate to get started.
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      taxRates.map((taxRate) => (
                        <TableRow key={taxRate.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {taxRate.name}
                              {taxRate.is_default && (
                                <Badge variant="secondary" className="text-xs">Default</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Percent className="h-3 w-3" />
                              {taxRate.rate}%
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {taxRate.description || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={taxRate.is_active ? "default" : "secondary"}>
                              {taxRate.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditTaxRate(taxRate)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteTaxRate(taxRate.id)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
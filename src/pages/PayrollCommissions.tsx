import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, DollarSign, ArrowLeft, Receipt } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Commission {
  id: string;
  staff_id: string;
  commission_amount: number;
  commission_percentage: number;
  status: string;
  accrued_date: string | null;
  paid_date: string | null;
  staff: {
    id: string;
    full_name: string;
  };
  invoice: {
    id: string;
    invoice_number: string;
  } | null;
  job_card: {
    id: string;
    job_number: string;
  } | null;
}

interface Account {
  id: string;
  account_name: string;
  account_code: string;
  account_type: string;
}

interface Location {
  id: string;
  name: string;
}

export default function PayrollCommissions() {
  const navigate = useNavigate();
  const { format: formatCurrency } = useOrganizationCurrency();
  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [selectedCommissions, setSelectedCommissions] = useState<string[]>([]);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load commissions
      const { data: commissionsData, error: commissionsError } = await supabase
        .from('staff_commissions')
        .select(`
          *,
          staff:staff_id (id, full_name),
          invoice:invoice_id (id, invoice_number),
          job_card:job_card_id (id, job_number)
        `)
        .eq('status', 'accrued')
        .order('accrued_date', { ascending: false });

      if (commissionsError) throw commissionsError;

      // Load bank accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('id, account_name, account_code, account_type')
        .in('account_type', ['Asset'])
        .in('account_code', ['1001', '1002']) // Cash and Bank accounts
        .eq('is_active', true)
        .order('account_code');

      if (accountsError) throw accountsError;

      // Load locations
      const { data: locationsData, error: locationsError } = await supabase
        .from('business_locations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (locationsError) throw locationsError;

      setCommissions(commissionsData || []);
      setAccounts(accountsData || []);
      setLocations(locationsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load commission data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCommissionSelect = (commissionId: string, checked: boolean) => {
    if (checked) {
      setSelectedCommissions([...selectedCommissions, commissionId]);
    } else {
      setSelectedCommissions(selectedCommissions.filter(id => id !== commissionId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCommissions(commissions.map(c => c.id));
    } else {
      setSelectedCommissions([]);
    }
  };

  const processPayments = async () => {
    if (selectedCommissions.length === 0) {
      toast({
        title: "Error",
        description: "Please select commissions to pay",
        variant: "destructive",
      });
      return;
    }

    if (!selectedAccount) {
      toast({
        title: "Error",
        description: "Please select a payment account",
        variant: "destructive",
      });
      return;
    }

    try {
      for (const commissionId of selectedCommissions) {
        const { error } = await supabase.rpc('pay_staff_commission', {
          p_commission_id: commissionId,
          p_payment_date: paymentDate,
          p_bank_account_id: selectedAccount,
          p_payment_reference: paymentReference || null
        });

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `${selectedCommissions.length} commission(s) processed successfully`,
      });

      setPaymentDialogOpen(false);
      setSelectedCommissions([]);
      setPaymentReference("");
      loadData(); // Reload data
    } catch (error) {
      console.error('Error processing payments:', error);
      toast({
        title: "Error",
        description: "Failed to process commission payments",
        variant: "destructive",
      });
    }
  };

  const totalSelectedAmount = selectedCommissions.reduce((sum, id) => {
    const commission = commissions.find(c => c.id === id);
    return sum + (commission?.commission_amount || 0);
  }, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/payroll')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Payroll
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Commission Payments</h1>
          <p className="text-muted-foreground">Process staff commission payments</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Accrued Commissions</CardTitle>
            <div className="flex items-center gap-2">
              {selectedCommissions.length > 0 && (
                <Badge variant="secondary">
                  {selectedCommissions.length} selected - {formatCurrency(totalSelectedAmount)}
                </Badge>
              )}
              <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
                <DialogTrigger asChild>
                  <Button disabled={selectedCommissions.length === 0}>
                    <Receipt className="h-4 w-4 mr-2" />
                    Process Payments
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Process Commission Payments</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="payment-account">Payment Account</Label>
                      <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.account_code} - {account.account_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="payment-location">Location (Optional)</Label>
                      <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="payment-date">Payment Date</Label>
                      <Input
                        id="payment-date"
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="payment-reference">Payment Reference (Optional)</Label>
                      <Input
                        id="payment-reference"
                        placeholder="Enter payment reference"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                      />
                    </div>

                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Total Amount:</span>
                        <span className="text-lg font-bold">{formatCurrency(totalSelectedAmount)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Commissions Selected:</span>
                        <span>{selectedCommissions.length}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button onClick={processPayments} className="flex-1">
                        Process Payments
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setPaymentDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No accrued commissions found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedCommissions.length === commissions.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Accrued Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((commission) => (
                  <TableRow key={commission.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedCommissions.includes(commission.id)}
                        onChange={(e) => handleCommissionSelect(commission.id, e.target.checked)}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {commission.staff?.full_name || 'Unknown Staff'}
                    </TableCell>
                    <TableCell>
                      {commission.invoice ? (
                        <span className="text-sm">Invoice {commission.invoice.invoice_number}</span>
                      ) : commission.job_card ? (
                        <span className="text-sm">Job Card {commission.job_card.job_number}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Unknown</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatCurrency(commission.commission_amount)}
                    </TableCell>
                    <TableCell>
                      {commission.commission_percentage}%
                    </TableCell>
                    <TableCell>
                      {commission.accrued_date ? format(new Date(commission.accrued_date), 'MMM dd, yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {commission.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
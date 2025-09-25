import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, DollarSign, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useSaas } from "@/lib/saas";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { getInvoicesWithBalanceWithFallback, recordInvoicePaymentWithFallback } from "@/utils/mockDatabase";
import { postInvoicePaymentWithAccount, postInvoicePaymentToLedger } from "@/utils/ledger";
import { MpesaPaymentModal } from "@/components/payments/MpesaPaymentModal";
import { useMpesaPayments } from "@/hooks/useMpesaPayments";

interface InvoiceLiteOption {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  customer_name?: string;
  total_amount: number;
  amount_paid: number;
  status: string;
  created_at: string;
  derived_status?: string;
}

export default function PaymentReceivedNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { organization } = useSaas();
  const { format: formatCurrency } = useOrganizationCurrency();

  const [loading, setLoading] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [showMpesaModal, setShowMpesaModal] = useState<boolean>(false);
  const { initiatePayment } = useMpesaPayments(organization?.id);

  const [createStatus, setCreateStatus] = useState<"unpaid" | "pending">("unpaid");
  const [invoiceOptions, setInvoiceOptions] = useState<InvoiceLiteOption[]>([]);
  const [invoiceSearch, setInvoiceSearch] = useState<string>("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");

  const [assetAccounts, setAssetAccounts] = useState<Array<{ id: string; account_code: string; account_name: string; account_subtype?: string | null }>>([]);

  const [form, setForm] = useState({
    amount: "",
    method: "cash",
    reference: "",
    payment_date: new Date().toISOString().slice(0, 10),
    account_id: "",
    customer_name: "",
    customer_phone: "",
  });

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const invs = (await getInvoicesWithBalanceWithFallback(supabase)) as unknown as InvoiceLiteOption[];
        setInvoiceOptions(invs || []);
      } catch {
        setInvoiceOptions([]);
      } finally {
        setLoading(false);
      }
      try {
        if (organization?.id) {
          let data: any[] | null = null;
          let error: any = null;
          try {
            const res = await supabase
              .from("accounts")
              .select("id, account_code, account_name, account_type, account_subtype")
              .eq("organization_id", organization.id)
              .eq("account_type", "Asset")
              .order("account_code", { ascending: true });
            data = res.data as any[] | null;
            error = res.error;
          } catch (err: any) {
            error = err;
          }
          if (error) {
            const res = await supabase
              .from("accounts")
              .select("id, account_code, account_name, account_type")
              .eq("organization_id", organization.id)
              .order("account_code", { ascending: true });
            data = res.data as any[] | null;
          }
          const filtered = (data || []).filter((a: any) => (a.account_type === "Asset") && (!a.account_subtype || ["Cash", "Bank"].includes(a.account_subtype)));
          setAssetAccounts(
            filtered.map((a: any) => ({
              id: a.id,
              account_code: a.account_code,
              account_name: a.account_name,
              account_subtype: (a as any).account_subtype || null,
            }))
          );
        } else {
          setAssetAccounts([]);
        }
      } catch {
        setAssetAccounts([]);
      }
    };
    init();
  }, [organization?.id]);

  const outstandingById = useMemo(() => {
    const map: Record<string, number> = {};
    (invoiceOptions || []).forEach((r) => {
      const total = Number(r.total_amount || 0);
      const paid = Number(r.amount_paid || 0);
      map[r.id] = Math.max(0, total - paid);
    });
    return map;
  }, [invoiceOptions]);

  const filteredInvoiceOptions = useMemo(() => {
    const s = invoiceSearch.toLowerCase();
    return (invoiceOptions || [])
      .filter((r) => {
        const status = (r as any).derived_status || r.status;
        return createStatus === "unpaid"
          ? status === "sent" || status === "draft" || status === "overdue"
          : status === "partial";
      })
      .filter((r) => (r.invoice_number || "").toLowerCase().includes(s));
  }, [invoiceOptions, invoiceSearch, createStatus]);

  const onSelectInvoice = (id: string) => {
    setSelectedInvoiceId(id);
    const outstanding = outstandingById[id] || 0;
    // Prefill amount and customer name if available
    const selected = invoiceOptions.find((x) => x.id === id);
    const customerName = (selected as any)?.customer_name || '';
    setForm((prev) => ({ ...prev, amount: String(outstanding > 0 ? outstanding.toFixed(2) : ""), customer_name: customerName }));
  };

  const handleMpesaPayment = () => {
    if (!selectedInvoiceId) {
      toast.error("Select an invoice");
      return;
    }
    
    const amt = parseFloat(form.amount) || 0;
    if (amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    
    if (!form.customer_phone) {
      toast.error("Customer phone number is required for M-Pesa payments");
      return;
    }
    
    setShowMpesaModal(true);
  };

  const handleMpesaSuccess = async (paymentId: string) => {
    try {
      setCreating(true);
      const r = invoiceOptions.find((x) => x.id === selectedInvoiceId);
      const amt = parseFloat(form.amount) || 0;
      
      // Record the payment in the system
      const ok = await recordInvoicePaymentWithFallback(supabase, {
        invoice_id: selectedInvoiceId,
        amount: amt,
        method: form.method,
        reference_number: paymentId, // Use M-Pesa payment ID as reference
        payment_date: form.payment_date,
      });
      
      if (!ok) throw new Error("Failed to record payment");

      // Post to ledger
      try {
        if (organization?.id) {
          if (form.account_id) {
            await postInvoicePaymentWithAccount({
              organizationId: organization.id,
              amount: amt,
              depositAccountId: form.account_id,
              invoiceId: selectedInvoiceId,
              invoiceNumber: r?.invoice_number,
              paymentDate: form.payment_date,
            });
          } else {
            await postInvoicePaymentToLedger({
              organizationId: organization.id,
              amount: amt,
              method: form.method,
              invoiceId: selectedInvoiceId,
              invoiceNumber: r?.invoice_number,
              paymentDate: form.payment_date,
            });
          }
        }
      } catch (ledgerErr) {
        console.warn("Ledger posting failed", ledgerErr);
      }

      toast.success("M-Pesa payment completed and recorded");
      navigate("/payments");
    } catch (err) {
      console.error(err);
      toast.error("Failed to record M-Pesa payment");
    } finally {
      setCreating(false);
      setShowMpesaModal(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Handle M-Pesa payments differently
    if (form.method === 'mpesa') {
      handleMpesaPayment();
      return;
    }
    
    if (!selectedInvoiceId) {
      toast.error("Select an invoice");
      return;
    }
    const r = invoiceOptions.find((x) => x.id === selectedInvoiceId);
    const outstanding = r ? Math.max(0, Number(r.total_amount || 0) - Number(r.amount_paid || 0)) : 0;
    const amt = parseFloat(form.amount) || 0;
    if (amt <= 0 || (outstanding > 0 && amt > outstanding + 0.0001)) {
      toast.error("Invalid amount");
      return;
    }

    try {
      setCreating(true);
      const ok = await recordInvoicePaymentWithFallback(supabase, {
        invoice_id: selectedInvoiceId,
        amount: amt,
        method: form.method,
        reference_number: form.reference || null,
        payment_date: form.payment_date,
      });
      if (!ok) throw new Error("Failed to record payment");

      try {
        if (organization?.id) {
          if (form.account_id) {
            await postInvoicePaymentWithAccount({
              organizationId: organization.id,
              amount: amt,
              depositAccountId: form.account_id,
              invoiceId: selectedInvoiceId,
              invoiceNumber: r?.invoice_number,
              paymentDate: form.payment_date,
            });
          } else {
            await postInvoicePaymentToLedger({
              organizationId: organization.id,
              amount: amt,
              method: form.method,
              invoiceId: selectedInvoiceId,
              invoiceNumber: r?.invoice_number,
              paymentDate: form.payment_date,
            });
          }
        }
      } catch (ledgerErr) {
        console.warn("Ledger posting failed", ledgerErr);
      }

      toast.success("Payment recorded");
      navigate("/payments");
    } catch (err) {
      console.error(err);
      toast.error("Failed to record payment");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="w-5 h-5" /> Record Payment Received
          </h2>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Select Invoice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Label>Status</Label>
              <Select value={createStatus} onValueChange={(v) => setCreateStatus(v as any)}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search invoices..."
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
              />
            </div>
            <div className="border rounded h-[380px] overflow-auto">
              <Table className="w-full text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Select</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                        Loading invoices...
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && filteredInvoiceOptions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                        No invoices
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && filteredInvoiceOptions.map((r) => {
                    const outstanding = outstandingById[r.id] || 0;
                    return (
                      <TableRow key={r.id} className="hover:bg-muted/50">
                        <TableCell>
                          <input
                            type="radio"
                            name="selectedInvoice"
                            checked={selectedInvoiceId === r.id}
                            onChange={() => onSelectInvoice(r.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{r.invoice_number}</TableCell>
                        <TableCell>{formatCurrency(outstanding)}</TableCell>
                        <TableCell>{format(new Date(r.created_at), "MMM dd, yyyy")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Payment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Input value={form.customer_name} onChange={(e) => setForm((prev) => ({ ...prev, customer_name: e.target.value }))} placeholder="Customer name" />
              </div>
              {form.method === 'mpesa' && (
                <div className="space-y-2">
                  <Label>Customer Phone <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.customer_phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, customer_phone: e.target.value }))}
                    placeholder="254XXXXXXXXX"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter phone number in format 254XXXXXXXXX for M-Pesa payments
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={form.method} onValueChange={(v) => setForm((prev) => ({ ...prev, method: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.method !== 'mpesa' && (
                <div className="space-y-2">
                  <Label>Reference (optional)</Label>
                  <Input
                    value={form.reference}
                    onChange={(e) => setForm((prev) => ({ ...prev, reference: e.target.value }))}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  value={form.payment_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, payment_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Deposit to (Cash/Bank)</Label>
                <Select
                  value={form.account_id}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, account_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={assetAccounts.length ? "Select account" : "No accounts available"} />
                  </SelectTrigger>
                  <SelectContent>
                    {assetAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.account_code} - {a.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => navigate("/payments")}>Cancel</Button>
                <Button type="submit" disabled={creating || !selectedInvoiceId}>
                  {form.method === 'mpesa' ? 'Send STK Push' : 'Save Payment'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* M-Pesa Payment Modal */}
      <MpesaPaymentModal
        open={showMpesaModal}
        onOpenChange={setShowMpesaModal}
        amount={parseFloat(form.amount) || 0}
        organizationId={organization?.id || ''}
        accountReference={selectedInvoiceId ? `INV-${invoiceOptions.find(i => i.id === selectedInvoiceId)?.invoice_number}` : ''}
        transactionDesc={`Payment for Invoice ${invoiceOptions.find(i => i.id === selectedInvoiceId)?.invoice_number}`}
        referenceType="invoice_payment"
        referenceId={selectedInvoiceId}
        onSuccess={handleMpesaSuccess}
        customerPhone={form.customer_phone}
      />
    </div>
  );
}
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Users, Receipt, Trash2, Plus, Printer, ChevronDown, AlertCircle } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createInvoiceWithFallback, getInvoicesWithFallback, getInvoiceItemsWithFallback } from "@/utils/mockDatabase";
import { useOrganizationCurrency, useOrganizationTaxRate, useOrganization } from "@/lib/saas/hooks";
import { useTransactionNumbers } from "@/hooks/useTransactionNumbers";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { recordInvoicePaymentWithFallback } from "@/utils/mockDatabase";
import { useRegionalSettings } from "@/hooks/useRegionalSettings";
import { formatCurrency as formatCurrencyWithSeparators, formatNumber } from "@/lib/currencyUtils";


interface Customer { id: string; full_name: string; email: string | null; phone: string | null }
interface Service { id: string; name: string; price: number; commission_percentage?: number }
interface Staff { id: string; full_name: string; commission_rate?: number }

export default function InvoiceCreateFixed() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { symbol } = useOrganizationCurrency();
  const { taxRate: orgTaxRate, taxEnabled } = useOrganizationTaxRate() as any;
  const { organization } = useOrganization();
  const { getNextNumber } = useTransactionNumbers();
  const { formatCurrency: formatRegionalCurrency, settings: regionalSettings } = useRegionalSettings();

  const persistKeyCustomer = useMemo(() => (
    organization?.id ? `invoice_customer_persist_v1_${organization.id}` : null
  ), [organization?.id]);
  const persistKeyCustomerGlobal = 'invoice_customer_persist_v1__global';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [jobCards, setJobCards] = useState<Array<{ id: string; job_card_number: string; client_name?: string; total_amount: number }>>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string; is_default?: boolean; is_active?: boolean }>>([]);
  const [defaultLocationIdForUser, setDefaultLocationIdForUser] = useState<string | null>(null);
  const [customerJobCards, setCustomerJobCards] = useState<Array<{ id: string; job_card_number: string; total_amount: number }>>([]);
  const [filteredJobCards, setFilteredJobCards] = useState<Array<{ id: string; job_card_number: string; client_name?: string; total_amount: number }>>([]);
  const [selectedJobCardInfo, setSelectedJobCardInfo] = useState<{
    id: string;
    job_card_number: string;
    client_name?: string;
    total_amount: number;
    service_count?: number;
  } | null>(null);

  // Unique locations by name (prefer default when duplicates exist)
  const uniqueLocations = useMemo(() => {
    const map = new Map<string, { id: string; name: string; is_default?: boolean; is_active?: boolean }>();
    for (const loc of locations) {
      const key = (loc.name || "").trim().toLowerCase();
      const existing = map.get(key);
      if (!existing) {
        map.set(key, loc);
      } else if (loc.is_default && !existing.is_default) {
        map.set(key, loc);
      }
    }
    return Array.from(map.values());
  }, [locations]);

  const [formData, setFormData] = useState({
    customer_id: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    due_date: new Date().toISOString().split('T')[0],
    payment_method: "",
    notes: "",
    jobcard_id: "",
    jobcard_reference: "",
    location_id: "",
  });

  const [newItem, setNewItem] = useState({
    service_id: "",
    description: "",
    quantity: 1,
    unit_price: "",
    discount_percentage: 0,
    staff_id: "",
    commission_percentage: 0,
  });

  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [applyTax, setApplyTax] = useState<boolean>(true);
  const [receivedPayment, setReceivedPayment] = useState<boolean>(false);
  const [depositAccounts, setDepositAccounts] = useState<Array<{ id: string; account_code: string; account_name: string; account_subtype?: string | null }>>([]);
  const [paymentData, setPaymentData] = useState<{ method: string; account_id: string; reference: string; amount: string }>({ method: "", account_id: "", reference: "", amount: "" });

  // Load initial data
  useEffect(() => {
    (async () => {
      try {
        const [{ data: cust }, { data: svc }, { data: stf }, { data: jc }] = await Promise.all([
          supabase.from("clients").select("id, full_name, email, phone").eq("is_active", true).order("full_name"),
          supabase.from("services").select("id, name, price, commission_percentage").eq("is_active", true).eq('organization_id', organization?.id || '').order("name"),
          supabase.from("staff").select("id, full_name, commission_rate").eq("is_active", true).eq('organization_id', organization?.id || '').order("full_name"),
          supabase.from("job_cards")
            .select(`
              id, 
              job_card_number, 
              total_amount,
              clients(full_name)
            `)
            .eq('organization_id', organization?.id || '')
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
        ]);
        setCustomers(cust || []);
        setServices(svc || []);
        setStaff(stf || []);
        setJobCards((jc || []).map((jc: any) => ({
          id: jc.id,
          job_card_number: jc.job_card_number,
          client_name: jc.clients?.full_name,
          total_amount: jc.total_amount
        })));
      } catch {}
    })();
  }, [organization?.id]);

  // Load customer job cards when customer changes
  useEffect(() => {
    if (formData.customer_id) {
      (async () => {
        try {
          const { data: customerJCs } = await supabase
            .from("job_cards")
            .select("id, job_card_number, total_amount")
            .eq('client_id', formData.customer_id)
            .eq('organization_id', organization?.id || '')
            .eq('status', 'completed')
            .order('created_at', { ascending: false });
          setCustomerJobCards(customerJCs || []);
        } catch (error) {
          console.error('Error loading customer job cards:', error);
          setCustomerJobCards([]);
        }
      })();
    } else {
      setCustomerJobCards([]);
    }
  }, [formData.customer_id, organization?.id]);

  // Filter job cards based on selected customer
  useEffect(() => {
    if (formData.customer_id) {
      const filtered = jobCards.filter(jc => {
        return customerJobCards.some(cjc => cjc.id === jc.id);
      });
      setFilteredJobCards(filtered.length > 0 ? filtered : customerJobCards.map(cjc => {
        const fullJc = jobCards.find(jc => jc.id === cjc.id);
        return fullJc || { ...cjc, client_name: undefined };
      }));
    } else {
      setFilteredJobCards(jobCards);
    }
  }, [formData.customer_id, jobCards, customerJobCards]);

  const handleCustomerChange = async (customerId: string) => {
    try {
      const customer = customers.find(c => c.id === customerId);
      if (!customer) return;

      // Auto-fill customer details without confirmation
      setFormData(prev => ({
        ...prev,
        customer_id: customerId,
        customer_name: customer.full_name,
        customer_email: customer.email || '',
        customer_phone: customer.phone || '',
      }));
    } catch (error) {
      console.error('Error handling customer change:', error);
    }
  };

  const calculateTotals = () => {
    const subtotal = selectedItems.reduce((sum, item) => sum + item.total_price, 0);
    const taxAmount = applyTax ? subtotal * (orgTaxRate / 100) : 0;
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    try {
      const invoiceNumber = await getNextNumber('invoice');
      const totals = calculateTotals();

      const invoiceData = {
        invoice_number: invoiceNumber,
        client_id: formData.customer_id || null,
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone,
        issue_date: new Date().toISOString().split('T')[0],
        due_date: formData.due_date || null,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        total_amount: totals.total,
        notes: formData.notes,
        status: 'draft',
        location_id: formData.location_id || null,
        organization_id: organization?.id || null,
        jobcard_reference: formData.jobcard_reference || null,
      };

      const invoice = await createInvoiceWithFallback(supabase, invoiceData, selectedItems);
      
      // Record payment if received
      if (receivedPayment && parseFloat(paymentData.amount) > 0) {
        await recordInvoicePaymentWithFallback(supabase, {
          invoice_id: invoice.id,
          amount: parseFloat(paymentData.amount),
          method: paymentData.method,
          reference_number: paymentData.reference,
          account_id: paymentData.account_id,
        });
      }

      toast.success(`Invoice ${invoiceNumber} created successfully!`);
      navigate('/invoices');
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error('Failed to create invoice');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-6xl mx-auto">
        <Card className="shadow-xl border-0 bg-white/95 backdrop-blur">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-3">
              <Receipt className="w-6 h-6" />
              Create New Invoice
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Customer Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Select Customer</Label>
                  <Select value={formData.customer_id} onValueChange={handleCustomerChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Job Card Reference</Label>
                  <Select 
                    value={formData.jobcard_reference}
                    onValueChange={(value) => {
                      const selectedJC = filteredJobCards.find(jc => jc.job_card_number === value);
                      setFormData(prev => ({ 
                        ...prev, 
                        jobcard_reference: value,
                        jobcard_id: selectedJC?.id || ''
                      }));
                      setSelectedJobCardInfo(selectedJC || null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select job card" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredJobCards.map((jc) => (
                        <SelectItem key={jc.id} value={jc.job_card_number}>
                          {jc.job_card_number} - {jc.client_name || 'No Client'} ({formatRegionalCurrency(jc.total_amount)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.customer_id && customerJobCards.length > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-blue-700">
                          Customer has {customerJobCards.length} completed job card{customerJobCards.length > 1 ? 's' : ''} available
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bill To Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Bill To Details</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Customer Name</Label>
                    <Input 
                      value={formData.customer_name} 
                      onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
                      placeholder="Enter customer name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input 
                      type="email"
                      value={formData.customer_email} 
                      onChange={(e) => setFormData(prev => ({ ...prev, customer_email: e.target.value }))}
                      placeholder="Enter email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input 
                      value={formData.customer_phone} 
                      onChange={(e) => setFormData(prev => ({ ...prev, customer_phone: e.target.value }))}
                      placeholder="Enter phone"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Items Table */}
              {selectedItems.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Invoice Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Unit Price</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedItems.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{item.description}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{symbol}{item.unit_price}</TableCell>
                            <TableCell>{symbol}{item.total_price}</TableCell>
                            <TableCell>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedItems(selectedItems.filter((_, i) => i !== idx))}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Totals */}
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2 max-w-sm ml-auto">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{symbol}{calculateTotals().subtotal.toFixed(2)}</span>
                    </div>
                    {applyTax && (
                      <div className="flex justify-between">
                        <span>Tax ({orgTaxRate}%):</span>
                        <span>{symbol}{calculateTotals().taxAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Total:</span>
                      <span>{symbol}{calculateTotals().total.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => navigate('/invoices')}>
                  Cancel
                </Button>
                <Button type="submit">
                  Create Invoice
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
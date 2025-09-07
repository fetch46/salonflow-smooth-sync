import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Users, Receipt, Trash2, Plus, DollarSign } from "lucide-react";
import { useOrganizationCurrency, useOrganizationTaxRate, useOrganization } from "@/lib/saas/hooks";


interface Customer { id: string; full_name: string; email: string | null; phone: string | null }
interface Service { id: string; name: string; price: number; commission_percentage?: number }
interface Staff { id: string; full_name: string; commission_rate?: number }

export default function InvoiceCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { symbol } = useOrganizationCurrency();
  const { taxRate: orgTaxRate, taxEnabled } = useOrganizationTaxRate() as any;
  const { organization } = useOrganization();
  const { getNextNumber } = useTransactionNumbers();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string; is_default?: boolean; is_active?: boolean }>>([]);
  const [defaultLocationIdForUser, setDefaultLocationIdForUser] = useState<string | null>(null);

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
    due_date: "",
    payment_method: "",
    notes: "",
    jobcard_id: "",
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
  const [receivePayment, setReceivePayment] = useState<boolean>(false);
  const [paymentForm, setPaymentForm] = useState<{ method: string; account_id: string; reference: string; amount: string }>({
    method: "cash",
    account_id: "",
    reference: "",
    amount: "",
  });
  const [assetAccounts, setAssetAccounts] = useState<Array<{ id: string; account_code?: string; account_name: string }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: cust }, { data: svc }, { data: stf }] = await Promise.all([
          supabase.from("clients").select("id, full_name, email, phone").eq("is_active", true).order("full_name"),
          supabase.from("services").select("id, name, price, commission_percentage").eq("is_active", true).eq('organization_id', organization?.id || '').order("name"),
          supabase.from("staff").select("id, full_name, commission_rate").eq("is_active", true).eq('organization_id', organization?.id || '').order("full_name"),
        ]);
        setCustomers(cust || []);
        setServices(svc || []);
        setStaff(stf || []);
      } catch {}
    })();
  }, [organization?.id]);

  const fetchLocations = async () => {
    try {
      const { data } = await supabase
        .from("business_locations")
        .select("id, name, is_default, is_active")
        .eq('organization_id', organization?.id || '')
        .order("name");
      const active = (data || []).filter((l: any) => l.is_active !== false);
      setLocations(active as any);
    } catch (error) {
      console.warn("Failed to fetch business_locations", error);
      setLocations([]);
    }
  };

  // Resolve default location for current user via staff_default_locations
  const resolveUserDefaultLocation = async () => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const email = userRes.user?.email || null;
      if (!email) return null;
      const { data: staffRow } = await supabase.from("staff").select("id, email").eq("email", email).maybeSingle();
      const staffId = (staffRow as any)?.id as string | undefined;
      if (!staffId) return null;
      const { data: mapping } = await supabase.from("staff_default_locations").select("location_id").eq("staff_id", staffId).maybeSingle();
      return ((mapping as any)?.location_id as string | undefined) || null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    fetchLocations();
    (async () => {
      const locId = await resolveUserDefaultLocation();
      setDefaultLocationIdForUser(locId);
    })();
  }, [organization?.id]);

  // Apply default location: user's default, else org default flag, else first
  useEffect(() => {
    if (formData.location_id) return;
    const candidate = defaultLocationIdForUser || (locations.find(l => (l as any).is_default)?.id || locations[0]?.id) || "";
    if (candidate) setFormData(prev => ({ ...prev, location_id: candidate }));
  }, [locations, defaultLocationIdForUser, formData.location_id]);

  // Ensure selected location exists after deduping
  useEffect(() => {
    if (!formData.location_id) return;
    if (uniqueLocations.every(l => l.id !== formData.location_id)) {
      const fallback = uniqueLocations[0]?.id || "";
      if (fallback) setFormData(prev => ({ ...prev, location_id: fallback }));
    }
  }, [uniqueLocations, formData.location_id]);

  // Prefill from Job Card
  useEffect(() => {
    const fromJobCard = searchParams.get("fromJobCard");
    if (!fromJobCard) return;
    (async () => {
      try {
        const { data: jc } = await supabase
          .from('job_cards')
          .select('id, client_id')
          .eq('id', fromJobCard)
          .maybeSingle();
        if (!jc) return;
        // Prefill client
        const client = customers.find(c => c.id === jc.client_id);
        if (client) {
          setFormData(prev => ({
            ...prev,
            customer_id: client.id,
            customer_name: client.full_name,
            customer_email: client.email || '',
            customer_phone: client.phone || '',
            jobcard_id: jc.id
          }));
        } else if (jc.client_id) {
          const { data: cli } = await supabase.from('clients').select('id, full_name, email, phone').eq('id', jc.client_id).maybeSingle();
          if (cli) {
            setCustomers(prev => (prev.some(c => c.id === cli.id) ? prev : [...prev, cli as any]));
            setFormData(prev => ({
              ...prev,
              customer_id: cli.id,
              customer_name: (cli as any).full_name || '',
              customer_email: (cli as any).email || '',
              customer_phone: (cli as any).phone || '',
              jobcard_id: jc.id,
              // Use the job card's location if available
              location_id: (jc as any).location_id || prev.location_id,
            }));
          }
        }
        // Prefill items from job_card_services
        const { data: jcs } = await supabase
          .from('job_card_services')
          .select('service_id, staff_id, quantity, unit_price, commission_percentage, services:service_id(name)')
          .eq('job_card_id', fromJobCard);
        const preItems = (jcs || []).map((row: any, idx: number) => ({
          id: `prefill-${Date.now()}-${idx}`,
          invoice_id: '',
          product_id: row.service_id,
          service_id: row.service_id,
          description: row.services?.name || 'Service',
          quantity: Number(row.quantity || 1),
          unit_price: Number(row.unit_price || 0),
          discount_percentage: 0,
          staff_id: row.staff_id || '',
          commission_percentage: typeof row.commission_percentage === 'number' ? Number(row.commission_percentage) : 0,
          total_price: Number(row.quantity || 1) * Number(row.unit_price || 0),
        }));
        if (preItems.length > 0) setSelectedItems(preItems as any);
      } catch (err) {
        console.error('Failed to prefill from job card:', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, customers]);

  // Prefill from duplicateId
  useEffect(() => {
    const duplicateId = searchParams.get('duplicateId');
    if (!duplicateId) return;
    (async () => {
      try {
        const all = await getInvoicesWithFallback(supabase);
        const inv = (all || []).find(i => i.id === duplicateId);
        if (!inv) return;
        setFormData(prev => ({
          ...prev,
          customer_id: inv.customer_id || "",
          customer_name: inv.customer_name || "",
          customer_email: inv.customer_email || "",
          customer_phone: inv.customer_phone || "",
          due_date: "",
          payment_method: inv.payment_method || "",
          notes: inv.notes || "",
          jobcard_id: inv.jobcard_id || "",
          location_id: inv.location_id || prev.location_id,
        }));
        const items = await getInvoiceItemsWithFallback(supabase, duplicateId);
        setSelectedItems((items || []).map((it: any) => ({
          service_id: it.service_id || "",
          description: it.description,
          quantity: it.quantity,
          unit_price: String(it.unit_price ?? 0),
          discount_percentage: it.discount_percentage ?? 0,
          staff_id: it.staff_id || "",
          commission_percentage: it.commission_percentage ?? 0,
          total_price: it.total_price,
        })));
        toast.success('Duplicated invoice loaded');
      } catch (e) {
        console.error(e);
      }
    })();
  }, [searchParams]);

  // Load deposit accounts for payment receive form
  useEffect(() => {
    (async () => {
      try {
        if (!organization?.id) { setAssetAccounts([]); return; }
        const { data } = await supabase
          .from("accounts")
          .select("id, account_code, account_name, account_type, account_subtype")
          .eq("organization_id", organization.id)
          .eq("account_type", "Asset")
          .order("account_code", { ascending: true });
        const filtered = (data || []).filter((a: any) => a.account_type === "Asset" && (!a.account_subtype || ["Cash", "Bank"].includes(a.account_subtype)));
        setAssetAccounts(filtered as any);
      } catch {
        setAssetAccounts([]);
      }
    })();
  }, [organization?.id]);

  // When toggling receive payment on, default amount to invoice total
  useEffect(() => {
    if (!receivePayment) return;
    const totals = calculateTotals();
    setPaymentForm(prev => ({ ...prev, amount: totals.total.toFixed(2) }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receivePayment, selectedItems, applyTax, orgTaxRate]);

  const calculateTotals = useMemo(() => {
    return () => {
      const subtotal = selectedItems.reduce((sum, item: any) => Number(sum) + (Number(item.total_price) || 0), 0);
      const canApply = taxEnabled !== false && applyTax;
      const taxAmount = canApply ? Number(subtotal) * ((Number(orgTaxRate) || 0) / 100) : 0;
      const total = Number(subtotal) + Number(taxAmount);
      return { subtotal, taxAmount, total };
    };
  }, [selectedItems, applyTax, orgTaxRate]);

  const addItemToInvoice = () => {
    if (!newItem.service_id || !newItem.staff_id || !newItem.description || !newItem.unit_price) {
      toast.error("Service and Staff are mandatory fields");
      return;
    }
    const unit = parseFloat(newItem.unit_price) || 0;
    const totalPrice = Number((newItem.quantity * unit * (1 - (newItem.discount_percentage / 100))).toFixed(2));
    const item: any = {
      id: `temp-${Date.now()}`,
      invoice_id: "",
      product_id: newItem.service_id,
      service_id: newItem.service_id,
      description: newItem.description,
      quantity: newItem.quantity,
      unit_price: unit,
      discount_percentage: newItem.discount_percentage || 0,
      staff_id: newItem.staff_id || "",
      commission_percentage: Number(newItem.commission_percentage || 0),
      total_price: totalPrice,
    };
    setSelectedItems(prev => [...prev, item]);
    setNewItem({ service_id: "", description: "", quantity: 1, unit_price: "", discount_percentage: 0, staff_id: "", commission_percentage: 0 });
  };

  const removeItemFromInvoice = (idx: number) => setSelectedItems(selectedItems.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) return toast.error('Please add at least one item to the invoice');
    if (!formData.location_id) return toast.error('Please select a location');
    // Validate payment form if receiving payment now
    if (receivePayment) {
      const amt = parseFloat(paymentForm.amount) || 0;
      if (!paymentForm.method) return toast.error('Select a payment method');
      if (!paymentForm.account_id) return toast.error('Select a deposit account');
      if (paymentForm.method === 'mpesa' && !paymentForm.reference?.trim()) return toast.error('Reference is required for M-PESA');
      if (amt <= 0) return toast.error('Enter a valid amount to receive');
    }
    try {
      // Generate next invoice number from configured series
      const invoiceNumber = await getNextNumber('invoice');
      const totals = calculateTotals();
      const invoiceData = {
        invoice_number: invoiceNumber,
        customer_id: formData.customer_id || null,
        customer_name: formData.customer_name,
        customer_email: formData.customer_email || null,
        customer_phone: formData.customer_phone || null,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        discount_amount: 0,
        total_amount: totals.total,
        status: 'draft',
        due_date: formData.due_date || null,
        payment_method: formData.payment_method || null,
        notes: formData.notes || null,
        jobcard_id: formData.jobcard_id || null,
        location_id: formData.location_id || null,
      };
      const created = await createInvoiceWithFallback(supabase, invoiceData, selectedItems);
      // Optionally record a payment immediately
      if (receivePayment && created?.id) {
        const amt = parseFloat(paymentForm.amount) || 0;
        const res = await recordInvoicePaymentWithFallback(supabase, {
          invoice_id: created.id,
          amount: amt,
          method: paymentForm.method,
          reference_number: paymentForm.reference || null,
          payment_date: new Date().toISOString().slice(0,10),
          account_id: paymentForm.account_id,
          location_id: formData.location_id || null,
        });
        if (!res.success) {
          toast.error(res.error || 'Failed to record payment');
        } else {
          toast.success('Payment recorded');
        }
      }
      toast.success('Invoice created');
      navigate('/invoices');
    } catch (e) {
      console.error(e);
      toast.error('Failed to create invoice');
    }
  };

  // Calculate commission summary
  const commissionSummary = useMemo(() => {
    const staffCommissions = new Map();
    selectedItems.forEach(item => {
      if (item.staff_id && item.commission_percentage > 0) {
        const staffName = staff.find(s => s.id === item.staff_id)?.full_name || 'Unknown Staff';
        const commissionAmount = (item.total_price * item.commission_percentage) / 100;
        
        if (staffCommissions.has(item.staff_id)) {
          const existing = staffCommissions.get(item.staff_id);
          existing.amount += commissionAmount;
          existing.items.push(item.description);
        } else {
          staffCommissions.set(item.staff_id, {
            name: staffName,
            amount: commissionAmount,
            items: [item.description]
          });
        }
      }
    });
    return Array.from(staffCommissions.values());
  }, [selectedItems, staff]);

  return (
    <div className="flex gap-6 p-6 bg-slate-50/30 min-h-screen">
      {/* Main Form */}
      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl shadow-lg">
              <Receipt className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Create Invoice</h1>
              <p className="text-slate-600">Full-page invoice creation</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/payments/received/new')}>
              <DollarSign className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
            <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            <Button onClick={handleSubmit}>Create Invoice</Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              Customer Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_id">Existing Customer</Label>
                <Select value={formData.customer_id} onValueChange={(value) => {
                  const customer = customers.find(c => c.id === value);
                  setFormData({
                    ...formData,
                    customer_id: value,
                    customer_name: customer?.full_name || "",
                    customer_email: customer?.email || "",
                    customer_phone: customer?.phone || "",
                  });
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select existing customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer_name">Customer Name *</Label>
                <Input id="customer_name" value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_email">Email</Label>
                <Input id="customer_email" type="email" value={formData.customer_email} onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer_phone">Phone</Label>
                <Input id="customer_phone" value={formData.customer_phone} onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })} />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-purple-600" />
              Invoice Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input id="due_date" type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="location_id">Location *</Label>
                <Select value={formData.location_id} onValueChange={(v) => setFormData({ ...formData, location_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={locations.length ? 'Select a location' : 'No locations found'} />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueLocations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-green-600" />
              Invoice Items
            </h3>
            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-purple-800">Add Item</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-9 gap-3">
                  <div className="lg:col-span-2">
                    <Label className="text-sm">Service *</Label>
                    <Select value={newItem.service_id} onValueChange={async (value) => {
                      const service = services.find(s => s.id === value);
                      // Use service commission rate or fallback to current
                      const commissionRate = service?.commission_percentage || newItem.commission_percentage;
                      
                      setNewItem({
                        ...newItem,
                        service_id: value,
                        description: service?.name || "",
                        unit_price: service?.price?.toString() || "",
                        commission_percentage: commissionRate,
                      });
                    }}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select service *" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.name} - {symbol}{s.price}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="lg:col-span-1">
                    <Label className="text-sm">Qty *</Label>
                    <Input className="h-9" type="number" min="1" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })} />
                  </div>
                  <div className="lg:col-span-1">
                    <Label className="text-sm">Price *</Label>
                    <Input className="h-9" type="number" step="0.01" value={newItem.unit_price} onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })} />
                  </div>
                  <div className="lg:col-span-1">
                    <Label className="text-sm">Discount %</Label>
                    <Input className="h-9" type="number" min="0" max="100" value={newItem.discount_percentage} onChange={(e) => setNewItem({ ...newItem, discount_percentage: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="lg:col-span-1">
                    <Label className="text-sm">Staff *</Label>
                    <Select value={newItem.staff_id} onValueChange={(value) => {
                      const selectedStaff = staff.find(s => s.id === value);
                      // Use staff commission rate only if service doesn't have one
                      const commissionRate = newItem.commission_percentage > 0 
                        ? newItem.commission_percentage 
                        : selectedStaff?.commission_rate || 0;
                      setNewItem({ 
                        ...newItem, 
                        staff_id: value,
                        commission_percentage: commissionRate
                      });
                    }}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select staff *" />
                      </SelectTrigger>
                      <SelectContent>
                        {staff.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="lg:col-span-1">
                    <Label className="text-sm">Commission %</Label>
                    <Input className="h-9" type="number" min="0" max="100" step="0.1" value={newItem.commission_percentage} onChange={(e) => setNewItem({ ...newItem, commission_percentage: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="lg:col-span-1 flex items-end">
                    <Button type="button" size="sm" className="w-full h-9 bg-violet-600 hover:bg-violet-700" onClick={addItemToInvoice}>
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {selectedItems.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Invoice Items ({selectedItems.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Discount</TableHead>
                        <TableHead>Staff</TableHead>
                        <TableHead>Commission</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedItems.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{symbol}{item.unit_price}</TableCell>
                          <TableCell>{item.discount_percentage}%</TableCell>
                          <TableCell>{staff.find(s => s.id === item.staff_id)?.full_name || '-'}</TableCell>
                          <TableCell>{item.commission_percentage}%</TableCell>
                          <TableCell>{symbol}{item.total_price}</TableCell>
                          <TableCell>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeItemFromInvoice(idx)}>
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
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Additional Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payment_method">Payment Method</Label>
                <Select value={formData.payment_method} onValueChange={(v) => setFormData({ ...formData, payment_method: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mpesa">M-PESA</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {taxEnabled !== false && (
                <div className="space-y-2">
                  <Label className="flex items-center space-x-2">
                    <input type="checkbox" checked={applyTax} onChange={(e) => setApplyTax(e.target.checked)} />
                    <span>Apply Tax ({(orgTaxRate).toFixed(1)}%)</span>
                  </Label>
                </div>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
            </div>

            {/* Receive Payment Now */}
            <Separator />
            <div className="space-y-3">
              <Label className="flex items-center space-x-2">
                <input type="checkbox" checked={receivePayment} onChange={(e) => setReceivePayment(e.target.checked)} />
                <span>I have Received Payment</span>
              </Label>
              {receivePayment && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Payment Received</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Payment Method</Label>
                        <Select value={paymentForm.method} onValueChange={(v) => setPaymentForm(prev => ({ ...prev, method: v }))}>
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
                      <div className="space-y-2">
                        <Label>Deposit to Account</Label>
                        <Select value={paymentForm.account_id} onValueChange={(v) => setPaymentForm(prev => ({ ...prev, account_id: v }))}>
                          <SelectTrigger>
                            <SelectValue placeholder={assetAccounts.length ? 'Select account' : 'No accounts found'} />
                          </SelectTrigger>
                          <SelectContent>
                            {assetAccounts.map(acc => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {(acc as any).account_code ? `${(acc as any).account_code} - ${acc.account_name}` : acc.account_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Reference{paymentForm.method === 'mpesa' ? ' *' : ''}</Label>
                        <Input
                          value={paymentForm.reference}
                          onChange={(e) => setPaymentForm(prev => ({ ...prev, reference: e.target.value }))}
                          placeholder={paymentForm.method === 'mpesa' ? 'Enter M-Pesa reference' : 'Optional reference'}
                          required={paymentForm.method === 'mpesa'}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Amount Received *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={paymentForm.amount}
                          onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Invoice Preview Sidebar */}
      <div className="w-80 space-y-4">
        {/* Invoice Preview */}
        <Card className="bg-white border border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-slate-900">Invoice Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Invoice #:</span>
                <span className="font-medium">TBD</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-medium">{formData.customer_name || 'Not selected'}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span className="font-medium">{new Date().toLocaleDateString()}</span>
              </div>
              {formData.due_date && (
                <div className="flex justify-between">
                  <span>Due:</span>
                  <span className="font-medium">{new Date(formData.due_date).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-900">Items ({selectedItems.length})</div>
              {selectedItems.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No items added yet</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedItems.map((item, idx) => (
                    <div key={idx} className="text-xs bg-slate-50 p-2 rounded">
                      <div className="font-medium">{item.description}</div>
                      <div className="text-slate-600">
                        {item.quantity} × {symbol}{item.unit_price} = {symbol}{item.total_price.toFixed(2)}
                      </div>
                      {item.staff_id && (
                        <div className="text-blue-600">
                          Staff: {staff.find(s => s.id === item.staff_id)?.full_name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-1 text-sm">
              {(() => {
                const totals = calculateTotals();
                return (
                  <>
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{symbol}{totals.subtotal.toFixed(2)}</span>
                    </div>
                    {taxEnabled !== false && applyTax && (
                      <div className="flex justify-between">
                        <span>Tax ({(orgTaxRate).toFixed(1)}%):</span>
                        <span>{symbol}{totals.taxAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Total:</span>
                      <span>{symbol}{totals.total.toFixed(2)}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Commission Summary */}
        {commissionSummary.length > 0 && (
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-green-800 flex items-center gap-2">
                💰 Commission Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {commissionSummary.map((commission, idx) => (
                <div key={idx} className="bg-white/60 p-3 rounded-lg">
                  <div className="font-medium text-green-900">{commission.name}</div>
                  <div className="text-lg font-bold text-green-700">
                    {symbol}{commission.amount.toFixed(2)}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    {commission.items.join(', ')}
                  </div>
                </div>
              ))}
              <div className="border-t border-green-200 pt-2">
                <div className="flex justify-between font-semibold text-green-800">
                  <span>Total Commission:</span>
                  <span>{symbol}{commissionSummary.reduce((sum, c) => sum + c.amount, 0).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
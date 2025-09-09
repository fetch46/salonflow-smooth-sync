import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { Users, Receipt, Trash2, Plus } from "lucide-react";
import { useOrganizationCurrency, useOrganizationTaxRate, useOrganization } from "@/lib/saas/hooks";
import { getInvoiceItemsWithFallback, getInvoicesWithFallback, updateInvoiceWithFallback } from "@/utils/mockDatabase";
import { formatNumber } from "@/lib/currencyUtils";

export default function InvoiceEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { symbol } = useOrganizationCurrency();
  const { taxRate: orgTaxRate, taxEnabled } = useOrganizationTaxRate() as any;
  const { organization } = useOrganization();

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [jobCards, setJobCards] = useState<Array<{ id: string; job_card_number: string; client_name?: string; total_amount: number }>>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string; is_default?: boolean; is_active?: boolean }>>([]);
  const [defaultLocationIdForUser, setDefaultLocationIdForUser] = useState<string | null>(null);
  const [customerJobCards, setCustomerJobCards] = useState<Array<{ id: string; job_card_number: string; total_amount: number }>>([]);

  const [formData, setFormData] = useState({
    customer_id: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    due_date: "",
    payment_method: "",
    notes: "",
    jobcard_id: "",
    jobcard_reference: "",
    location_id: "",
  });
  const [invoiceMeta, setInvoiceMeta] = useState<any | null>(null);
  const jobcardRequired = Boolean(((organization as any)?.settings || {})?.jobcard_required_on_invoice);

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
    (async () => {
      try {
        const [{ data: cust }, { data: svc }, { data: stf }, { data: jc }] = await Promise.all([
          supabase.from("clients").select("id, full_name, email, phone").eq("is_active", true).order("full_name"),
          supabase.from("services").select("id, name, price").eq("is_active", true).eq('organization_id', organization?.id || '').order("name"),
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
      await fetchLocations();
      const locId = await resolveUserDefaultLocation();
      setDefaultLocationIdForUser(locId);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        setLoading(true);
        const all = await getInvoicesWithFallback(supabase);
        const inv = (all || []).find(i => i.id === id);
        if (inv) {
          setFormData(prev => ({
            ...prev,
            customer_id: inv.customer_id || "",
            customer_name: inv.customer_name || "",
            customer_email: inv.customer_email || "",
            customer_phone: inv.customer_phone || "",
            due_date: inv.due_date || "",
            payment_method: inv.payment_method || "",
            notes: inv.notes || "",
            jobcard_id: inv.jobcard_id || "",
            jobcard_reference: (inv as any).jobcard_reference || "",
            location_id: (inv as any).location_id || prev.location_id,
          }));
          setInvoiceMeta(inv as any);
        }
        const items = await getInvoiceItemsWithFallback(supabase, id);
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
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Apply default location only if missing
  useEffect(() => {
    if (formData.location_id) return;
    const candidate = defaultLocationIdForUser || (locations.find(l => (l as any).is_default)?.id || locations[0]?.id) || "";
    if (candidate) setFormData(prev => ({ ...prev, location_id: candidate }));
  }, [locations, defaultLocationIdForUser, formData.location_id]);

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
      invoice_id: id,
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

  const handleJobCardSelection = async (jobCardId: string) => {
    if (!jobCardId) return;
    
    try {
      // Prefill and lock customer from selected job card
      try {
        const { data: jcRow } = await supabase
          .from('job_cards')
          .select('id, client_id, clients:client_id ( id, full_name, email, phone )')
          .eq('id', jobCardId)
          .maybeSingle();
        if (jcRow) {
          const cli = (jcRow as any).clients;
          if (cli?.id) {
            setCustomers(prev => (prev.some(c => c.id === cli.id) ? prev : [...prev, cli as any]));
          }
          setFormData(prev => ({
            ...prev,
            customer_id: (jcRow as any).client_id || prev.customer_id,
            customer_name: cli?.full_name || prev.customer_name,
            customer_email: cli?.email || prev.customer_email,
            customer_phone: cli?.phone || prev.customer_phone,
          }));
        }
      } catch {}

      // Fetch job card services with their details
      const { data: jobCardServices, error } = await supabase
        .from('job_card_services')
        .select(`
          id,
          service_id,
          staff_id,
          quantity,
          unit_price,
          commission_percentage,
          commission_amount,
          services(id, name),
          staff(id, full_name)
        `)
        .eq('job_card_id', jobCardId);

      if (error) throw error;

      if (jobCardServices && jobCardServices.length > 0) {
        // Clear existing items and add job card services
        const invoiceItems = jobCardServices.map((jcs: any) => ({
          id: `jobcard-${jcs.id}`,
          invoice_id: "",
          product_id: jcs.service_id,
          service_id: jcs.service_id,
          description: jcs.services?.name || 'Service',
          quantity: jcs.quantity || 1,
          unit_price: jcs.unit_price || 0,
          discount_percentage: 0,
          staff_id: jcs.staff_id || "",
          commission_percentage: jcs.commission_percentage || 0,
          total_price: (jcs.quantity || 1) * (jcs.unit_price || 0),
        }));

        setSelectedItems(invoiceItems);
        toast.success(`Added ${invoiceItems.length} service(s) from job card`);
      } else {
        toast.info("No services found for this job card");
      }
    } catch (error) {
      console.error("Error loading job card services:", error);
      toast.error("Failed to load job card services");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (selectedItems.length === 0) return toast.error('Please add at least one item to the invoice');
    if (!formData.location_id) return toast.error('Please select a location');
    if (jobcardRequired && !formData.jobcard_reference) return toast.error('Job card reference is required by settings');
    // Enforce invoice customer equals job card customer when a job card is selected
    if (formData.jobcard_reference) {
      try {
        const { data: jcMin } = await supabase
          .from('job_cards')
          .select('id, client_id')
          .eq('id', formData.jobcard_reference)
          .maybeSingle();
        const jobCustomerId = (jcMin as any)?.client_id || '';
        if (jobCustomerId && formData.customer_id && jobCustomerId !== formData.customer_id) {
          toast.error('Selected Job Card belongs to a different customer');
          return;
        }
        if (!formData.customer_id && jobCustomerId) {
          setFormData(prev => ({ ...prev, customer_id: jobCustomerId }));
        }
      } catch {}
    }
    try {
      const totals = calculateTotals();
      await updateInvoiceWithFallback(supabase, id, {
        customer_id: formData.customer_id || null,
        customer_name: formData.customer_name,
        customer_email: formData.customer_email || null,
        customer_phone: formData.customer_phone || null,
        due_date: formData.due_date || null,
        payment_method: formData.payment_method || null,
        notes: formData.notes || null,
        jobcard_reference: formData.jobcard_reference || null,
        location_id: formData.location_id || null,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        total_amount: totals.total,
      });
      // Replace items
      await supabase.from('invoice_items').delete().eq('invoice_id', id);
      if (selectedItems.length) {
        const payload = selectedItems.map((it: any) => ({
          invoice_id: id,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          total_price: it.total_price,
          service_id: it.service_id || null,
          product_id: it.product_id || null,
          staff_id: it.staff_id || null,
          location_id: formData.location_id || null,
          commission_percentage: typeof it.commission_percentage === 'number' ? it.commission_percentage : null,
          commission_amount: typeof it.commission_percentage === 'number' ? Number(((it.commission_percentage / 100) * (it.total_price ?? (it.quantity * it.unit_price))).toFixed(2)) : null,
        }));
        const { error: insErr } = await supabase.from('invoice_items').insert(payload);
        if (insErr) throw insErr;
      }
      toast.success('Invoice updated');
      navigate('/invoices');
    } catch (e) {
      console.error(e);
      toast.error('Failed to update invoice');
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
    <div className="flex flex-col xl:flex-row gap-6 p-6 bg-slate-50/30 min-h-screen max-w-7xl mx-auto w-full">
      {/* Main Form */}
      <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl shadow-lg">
            <Receipt className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Edit Invoice</h1>
            <p className="text-slate-600">Full-page invoice editing</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button variant="secondary" onClick={handleSubmit}>Save Invoice</Button>
          <Button onClick={handleSubmit}>Save Changes</Button>
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
              <Label htmlFor="customer_name">Customer Name *</Label>
              <Input id="customer_name" value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} required readOnly={Boolean(formData.jobcard_reference)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_id">Existing Customer</Label>
              <Select value={formData.customer_id} disabled={Boolean(formData.jobcard_reference)} onValueChange={async (value) => {
                if (formData.jobcard_reference) {
                  toast.error('Customer is controlled by the selected job card');
                  return;
                }
                const customer = customers.find(c => c.id === value);
                setFormData(prev => ({ 
                  ...prev, 
                  customer_id: value,
                  customer_name: customer?.full_name || prev.customer_name,
                  customer_email: customer?.email || prev.customer_email,
                  customer_phone: customer?.phone || prev.customer_phone,
                }));
                
                // Fetch job cards for this customer (only completed ones)
                if (value) {
                  try {
                    const { data: customerJCs } = await supabase
                      .from("job_cards")
                      .select("id, job_card_number, total_amount")
                      .eq('client_id', value)
                      .eq('organization_id', organization?.id || '')
                      .eq('status', 'completed')
                      .order('created_at', { ascending: false });
                    setCustomerJobCards(customerJCs || []);
                  } catch (error) {
                    console.error("Error fetching customer job cards:", error);
                    setCustomerJobCards([]);
                  }
                } else {
                  setCustomerJobCards([]);
                }
              }}>
                <SelectTrigger disabled={Boolean(formData.jobcard_reference)}>
                  <SelectValue placeholder="Select existing customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>))}
                </SelectContent>
              </Select>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input id="due_date" type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location_id">Location *</Label>
              <Select value={formData.location_id} onValueChange={(v) => setFormData({ ...formData, location_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={locations.length ? 'Select a location' : 'No locations found'} />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobcard_reference" className={jobcardRequired && !formData.jobcard_reference ? 'text-red-700' : ''}>Job Card Reference{jobcardRequired ? ' *' : ''}</Label>
              <Select 
                value={formData.jobcard_reference} 
                onValueChange={(value) => {
                  setFormData({ ...formData, jobcard_reference: value });
                  handleJobCardSelection(value);
                }}
              >
                <SelectTrigger className={jobcardRequired && !formData.jobcard_reference ? 'border-red-500 ring-1 ring-red-500 bg-red-50' : ''}>
                  <SelectValue placeholder={jobcardRequired ? 'Select a job card (required)' : 'Select a job card'} />
                </SelectTrigger>
                <SelectContent>
                  {jobCards.map((jc) => (
                    <SelectItem key={jc.id} value={jc.id}>
                      {jc.job_card_number} {jc.client_name ? `- ${jc.client_name}` : ''} ({symbol}{jc.total_amount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {jobcardRequired && !formData.jobcard_reference && (
                <p className="text-xs text-red-600 mt-1">Job card is required by accounting settings.</p>
              )}
              {customerJobCards.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-slate-600">Completed job cards for this customer:</p>
                  {customerJobCards.map((jc) => (
                    <p key={jc.id} className="text-sm text-red-600 font-medium">
                      {jc.job_card_number}
                    </p>
                  ))}
                </div>
              )}
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
              <div className="grid grid-cols-8 gap-3 items-end">
                <div className="col-span-2">
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">Description *</Label>
                  <Input className="h-9 text-sm" value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} placeholder="Item description" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">Service *</Label>
                  <Select value={newItem.service_id} onValueChange={async (value) => {
                    const service = services.find(s => s.id === value);
                    // Get service commission rate
                    let commissionRate = 0;
                    if (service) {
                      try {
                        const { data: serviceData } = await supabase
                          .from('services')
                          .select('commission_percentage')
                          .eq('id', value)
                          .maybeSingle();
                        commissionRate = serviceData?.commission_percentage || 0;
                      } catch (error) {
                        console.error('Error fetching service commission:', error);
                      }
                    }
                    
                    setNewItem({
                      ...newItem,
                      service_id: value,
                      description: service?.name || "",
                      unit_price: service?.price?.toString() || "",
                      commission_percentage: commissionRate || newItem.commission_percentage,
                    });
                  }}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
                      {services.map((s: any) => (
                        <SelectItem key={s.id} value={s.id} className="text-sm">{s.name} - {symbol}{s.price}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">Qty *</Label>
                  <Input className="h-9 text-sm" type="number" min="1" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">Price *</Label>
                  <Input className="h-9 text-sm" type="number" step="0.01" value={newItem.unit_price} onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">Discount %</Label>
                  <Input className="h-9 text-sm" type="number" min="0" max="100" value={newItem.discount_percentage} onChange={(e) => setNewItem({ ...newItem, discount_percentage: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">Staff *</Label>
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
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select staff" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
                      {staff.map((s: any) => (
                        <SelectItem key={s.id} value={s.id} className="text-sm">{s.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">Commission %</Label>
                  <Input className="h-9 text-sm" type="number" min="0" max="100" step="0.1" value={newItem.commission_percentage} onChange={(e) => setNewItem({ ...newItem, commission_percentage: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">&nbsp;</Label>
                  <Button type="button" size="sm" className="w-full h-9 bg-violet-600 hover:bg-violet-700 text-sm" onClick={addItemToInvoice}>
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
                      <TableHead>Total</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedItems.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{symbol}{parseFloat(String(item.unit_price)).toFixed(2)}</TableCell>
                        <TableCell>{item.discount_percentage}%</TableCell>
                        <TableCell className="font-semibold">{symbol}{Number(item.total_price).toFixed(2)}</TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeItemFromInvoice(idx)}>
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

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="notes">Additional Notes</Label>
          <Textarea id="notes" rows={3} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Add any additional notes or special instructions..." />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
      </div>

      {/* Invoice Preview Sidebar */}
      <div className="w-full xl:w-80 space-y-4">
        {/* Invoice Details (Sidebar) */}
        <Card className="bg-white border border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-slate-900">Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Invoice #:</span>
              <span className="font-medium">{invoiceMeta?.invoice_number || id?.slice(-6) || 'TBD'}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span className="font-medium">{invoiceMeta?.created_at ? new Date(invoiceMeta.created_at).toLocaleDateString() : new Date().toLocaleDateString()}</span>
            </div>
            {(formData.due_date || invoiceMeta?.due_date) && (
              <div className="flex justify-between">
                <span>Due:</span>
                <span className="font-medium">{(invoiceMeta?.due_date || formData.due_date) ? new Date((invoiceMeta?.due_date || formData.due_date) as any).toLocaleDateString() : ''}</span>
              </div>
            )}
            {invoiceMeta?.payment_method && (
              <div className="flex justify-between">
                <span>Payment:</span>
                <span className="font-medium">{invoiceMeta.payment_method}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Location:</span>
              <span className="font-medium">{(() => { const lid = formData.location_id || (invoiceMeta as any)?.location_id; const loc = locations.find(l => l.id === lid); return loc?.name || '—'; })()}</span>
            </div>
          </CardContent>
        </Card>
        {/* Invoice Preview */}
        <Card className="bg-white border border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-slate-900">Invoice Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Invoice #:</span>
                <span className="font-medium">{id?.slice(-6) || 'TBD'}</span>
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
                        <span>Tax ({orgTaxRate}%):</span>
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
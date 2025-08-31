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
import { Users, Receipt, Trash2, Plus } from "lucide-react";
import { useOrganizationCurrency, useOrganizationTaxRate, useOrganization } from "@/lib/saas/hooks";
import { createInvoiceWithFallback, getInvoiceItemsWithFallback, getInvoicesWithFallback } from "@/utils/mockDatabase";

interface Customer { id: string; full_name: string; email: string | null; phone: string | null }
interface Service { id: string; name: string; price: number }
interface Staff { id: string; full_name: string }

export default function InvoiceCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { symbol } = useOrganizationCurrency();
  const orgTaxRate = useOrganizationTaxRate();
  const { organization } = useOrganization();

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

  useEffect(() => {
    (async () => {
      try {
        const [{ data: cust }, { data: svc }, { data: stf }] = await Promise.all([
          supabase.from("clients").select("id, full_name, email, phone").eq("is_active", true).order("full_name"),
          supabase.from("services").select("id, name, price").eq("is_active", true).eq('organization_id', organization?.id || '').order("name"),
          supabase.from("staff").select("id, full_name").eq("is_active", true).order("full_name"),
        ]);
        setCustomers(cust || []);
        setServices(svc || []);
        setStaff(stf || []);
      } catch {}
    })();
  }, []);

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

  const calculateTotals = useMemo(() => {
    return () => {
      const subtotal = selectedItems.reduce((sum, item: any) => Number(sum) + (Number(item.total_price) || 0), 0);
      const taxAmount = applyTax ? Number(subtotal) * ((Number(orgTaxRate) || 0) / 100) : 0;
      const total = Number(subtotal) + Number(taxAmount);
      return { subtotal, taxAmount, total };
    };
  }, [selectedItems, applyTax, orgTaxRate]);

  const addItemToInvoice = () => {
    if (!newItem.description || !newItem.unit_price) {
      toast.error("Please fill in all required fields");
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

  const generateInvoiceNumber = () => `INV-${Date.now().toString().slice(-6)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) return toast.error('Please add at least one item to the invoice');
    if (!formData.location_id) return toast.error('Please select a location');
    try {
      const totals = calculateTotals();
      const invoiceData = {
        invoice_number: generateInvoiceNumber(),
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
      await createInvoiceWithFallback(supabase, invoiceData, selectedItems);
      toast.success('Invoice created');
      navigate('/invoices');
    } catch (e) {
      console.error(e);
      toast.error('Failed to create invoice');
    }
  };

  return (
    <div className="flex-1 space-y-6 p-6 bg-slate-50/30 min-h-screen">
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
          <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button onClick={handleSubmit} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">Create Invoice</Button>
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
                <div className="lg:col-span-1">
                  <Label className="text-sm">Service</Label>
                  <Select value={newItem.service_id} onValueChange={(value) => {
                    const service = services.find(s => s.id === value);
                    setNewItem({ 
                      ...newItem, 
                      service_id: value,
                      description: service?.name || "",
                      unit_price: service?.price.toString() || ""
                    });
                  }}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="lg:col-span-2">
                  <Label className="text-sm">Description *</Label>
                  <Input className="h-9" value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} />
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
                  <Label className="text-sm">Staff</Label>
                  <Select value={newItem.staff_id} onValueChange={(value) => setNewItem({ ...newItem, staff_id: value })}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {staff.map(s => (
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
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{symbol}{parseFloat(String(item.unit_price)).toFixed(2)}</TableCell>
                        <TableCell>{item.discount_percentage}%</TableCell>
                        <TableCell>{item.staff_id ? (staff.find(s => s.id === item.staff_id)?.full_name || '—') : '—'}</TableCell>
                        <TableCell>{item.commission_percentage}%</TableCell>
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
          <Button type="submit" className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">Create Invoice</Button>
        </div>
      </form>
    </div>
  );
}
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

export default function InvoiceEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { symbol } = useOrganizationCurrency();
  const orgTaxRate = useOrganizationTaxRate();
  const { organization } = useOrganization();

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string; is_default?: boolean; is_active?: boolean }>>([]);
  const [defaultLocationIdForUser, setDefaultLocationIdForUser] = useState<string | null>(null);

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
        const [{ data: cust }, { data: svc }, { data: stf }] = await Promise.all([
          supabase.from("clients").select("id, full_name, email, phone").eq("is_active", true).order("full_name"),
          supabase.from("services").select("id, name, price").eq("is_active", true).eq('organization_id', organization?.id || '').order("name"),
          supabase.from("staff").select("id, full_name, commission_rate").eq("is_active", true).eq('organization_id', organization?.id || '').order("full_name"),
        ]);
        setCustomers(cust || []);
        setServices(svc || []);
        setStaff(stf || []);
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
            location_id: (inv as any).location_id || prev.location_id,
          }));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (selectedItems.length === 0) return toast.error('Please add at least one item to the invoice');
    if (!formData.location_id) return toast.error('Please select a location');
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

  return (
    <div className="flex-1 space-y-6 p-6 bg-slate-50/30 min-h-screen">
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
          <Button onClick={handleSubmit} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">Save Changes</Button>
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
              <Input id="customer_name" value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_id">Existing Customer</Label>
              <Select value={formData.customer_id} onValueChange={(v) => setFormData(prev => ({ ...prev, customer_id: v }))}>
                <SelectTrigger>
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
                  {locations.map((loc) => (
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
                  <Select value={newItem.staff_id} onValueChange={(value) => {
                    const selectedStaff = staff.find(s => s.id === value);
                    setNewItem({ 
                      ...newItem, 
                      staff_id: value,
                      commission_percentage: selectedStaff?.commission_rate || newItem.commission_percentage
                    });
                  }}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select" />
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
          <Button type="submit" className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">Save Changes</Button>
        </div>
      </form>
    </div>
  );
}
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { useToast } from "@/hooks/use-toast";
import { useSaas } from "@/lib/saas";
import { useOrganizationTaxRate } from "@/lib/saas/hooks";
import { ArrowLeft, ShoppingCart } from "lucide-react";

interface InventoryItem { id: string; name: string; type: string }
interface SupplierOption { id: string; name: string }

interface PurchaseItem {
  id: string;
  item_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  received_quantity: number;
  inventory_items: { name: string } | null;
}

interface PurchaseRecord {
  id: string;
  purchase_number: string;
  vendor_name: string;
  purchase_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  notes: string | null;
}

export default function PurchaseForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const { organization } = useSaas();
  const { format: formatMoney } = useOrganizationCurrency();
  const orgTaxRate = useOrganizationTaxRate();
  const { toast } = useToast();

  const [loading, setLoading] = useState<boolean>(false);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  const [applyTax, setApplyTax] = useState<boolean>(true);

  const [formData, setFormData] = useState({
    purchase_number: "",
    vendor_name: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    subtotal: "",
    tax_amount: "",
    total_amount: "",
    status: "pending",
    notes: "",
  });

  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [newItem, setNewItem] = useState({ item_id: "", quantity: "", unit_cost: "" });

  const generatePurchaseNumber = () => `PUR-${Date.now().toString().slice(-6)}`;

  const calculateTotals = useCallback(() => {
    const subtotal = purchaseItems.reduce((sum, item) => sum + Number(item.total_cost || 0), 0);
    const computedTax = applyTax ? subtotal * ((orgTaxRate || 0) / 100) : 0;
    const total = subtotal + computedTax;
    setFormData((prev) => ({
      ...prev,
      subtotal: subtotal.toFixed(2),
      tax_amount: computedTax.toFixed(2),
      total_amount: total.toFixed(2),
    }));
  }, [purchaseItems, orgTaxRate, applyTax]);

  useEffect(() => {
    calculateTotals();
  }, [calculateTotals]);

  const fetchSuppliers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      setSuppliers((data || []) as SupplierOption[]);
    } catch (err) {
      console.warn("Failed to load suppliers", err);
      setSuppliers([]);
    }
  }, []);

  const fetchInventoryItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, name, type")
        .eq("type", "good")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      setInventoryItems(data || []);
    } catch (error) {
      console.error("Error fetching inventory items:", error);
    }
  }, []);

  const fetchExisting = useCallback(async (purchaseId: string) => {
    try {
      setLoading(true);
      const { data: purchase, error: pErr } = await supabase
        .from("purchases")
        .select("*")
        .eq("id", purchaseId)
        .single();
      if (pErr) throw pErr;
      if (purchase) {
        const pr = purchase as unknown as PurchaseRecord;
        setFormData({
          purchase_number: pr.purchase_number,
          vendor_name: pr.vendor_name,
          purchase_date: (pr.purchase_date || '').slice(0,10),
          subtotal: String(pr.subtotal ?? ''),
          tax_amount: String(pr.tax_amount ?? ''),
          total_amount: String(pr.total_amount ?? ''),
          status: pr.status,
          notes: pr.notes || "",
        });
      }
      const { data: items, error: iErr } = await supabase
        .from("purchase_items")
        .select(`*, inventory_items (name)`) 
        .eq("purchase_id", purchaseId);
      if (iErr) throw iErr;
      setPurchaseItems((items || []) as unknown as PurchaseItem[]);
    } catch (err) {
      console.error("Error loading purchase:", err);
      toast({ title: "Error", description: "Failed to load purchase", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSuppliers();
    fetchInventoryItems();
  }, [fetchSuppliers, fetchInventoryItems]);

  useEffect(() => {
    if (isEdit && id) {
      fetchExisting(id);
    }
  }, [isEdit, id, fetchExisting]);

  const addPurchaseItem = () => {
    if (!newItem.item_id || !newItem.quantity || !newItem.unit_cost) {
      toast({ title: "Error", description: "Please fill in all item fields", variant: "destructive" });
      return;
    }
    const item = inventoryItems.find((i) => i.id === newItem.item_id);
    if (!item) return;
    const totalCost = parseFloat(newItem.quantity) * parseFloat(newItem.unit_cost);
    setPurchaseItems([
      ...purchaseItems,
      {
        id: `temp-${Date.now()}`,
        item_id: newItem.item_id,
        quantity: parseInt(newItem.quantity),
        unit_cost: parseFloat(newItem.unit_cost),
        total_cost: totalCost,
        received_quantity: 0,
        inventory_items: { name: item.name },
      },
    ]);
    setNewItem({ item_id: "", quantity: "", unit_cost: "" });
  };

  const removePurchaseItem = (index: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!formData.vendor_name) {
        toast({ title: "Supplier required", description: "Please select a supplier before saving.", variant: "destructive" });
        return;
      }
      const subtotalNow = purchaseItems.reduce((sum, item) => sum + (Number(item.total_cost) || 0), 0);
      const taxNow = applyTax ? subtotalNow * ((orgTaxRate || 0) / 100) : 0;
      const totalNow = subtotalNow + taxNow;
      const purchaseData = {
        ...formData,
        purchase_number: formData.purchase_number || generatePurchaseNumber(),
        subtotal: Number(subtotalNow.toFixed(2)),
        tax_amount: Number(taxNow.toFixed(2)),
        total_amount: Number(totalNow.toFixed(2)),
      } as any;

      let purchaseId: string;
      if (isEdit && id) {
        const { error } = await supabase.from("purchases").update(purchaseData).eq("id", id);
        if (error) throw error;
        purchaseId = id;
        await supabase.from("purchase_items").delete().eq("purchase_id", purchaseId);
        toast({ title: "Success", description: "Purchase updated successfully" });
      } else {
        const { data, error } = await supabase
          .from("purchases")
          .insert([purchaseData])
          .select()
          .single();
        if (error) throw error;
        purchaseId = data.id;
        toast({ title: "Success", description: "Purchase created successfully" });
      }

      if (purchaseItems.length > 0) {
        const itemsToInsert = purchaseItems.map((item) => ({
          purchase_id: purchaseId,
          item_id: item.item_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          total_cost: item.total_cost,
          received_quantity: item.received_quantity,
        }));
        const { error: itemsError } = await supabase.from("purchase_items").insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }

      navigate("/purchases");
    } catch (error) {
      console.error("Error saving purchase:", error);
      toast({ title: "Error", description: "Failed to save purchase", variant: "destructive" });
    }
  };

  const stats = useMemo(() => {
    const subtotal = purchaseItems.reduce((sum, it) => sum + Number(it.total_cost || 0), 0);
    const tax = applyTax ? subtotal * ((orgTaxRate || 0) / 100) : 0;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }, [purchaseItems, applyTax, orgTaxRate]);

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 pb-24 sm:pb-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-emerald-600 to-green-600 rounded-xl shadow-lg">
            <ShoppingCart className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{isEdit ? "Edit Purchase" : "Create Purchase"}</h1>
            <p className="text-slate-600">{isEdit ? "Update purchase details and items" : "Add purchase details and items"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button onClick={handleSubmit as any}>{isEdit ? "Update Purchase" : "Create Purchase"}</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle>Purchase Details</CardTitle>
              <CardDescription>Basic information about the purchase</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="purchase_number">Purchase Number</Label>
                    <Input id="purchase_number" placeholder="Auto-generated if empty" value={formData.purchase_number} onChange={(e) => setFormData({ ...formData, purchase_number: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vendor_name">Vendor</Label>
                    <Select value={formData.vendor_name} onValueChange={(value) => { const s = suppliers.find(x => x.name === value || x.id === value); setFormData({ ...formData, vendor_name: s?.name || '' }); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.name || s.id}>{s.name || 'Unnamed Supplier'}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="purchase_date">Purchase Date</Label>
                    <Input id="purchase_date" type="date" value={(formData.purchase_date || '').slice(0,10)} onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="received">Received</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Purchase Items</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                    <div className="space-y-2">
                      <Label>Product</Label>
                      <Select value={newItem.item_id} onValueChange={(value) => setNewItem({ ...newItem, item_id: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventoryItems.map((item) => (
                            <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input type="number" placeholder="Qty" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Unit Cost</Label>
                      <Input type="number" step="0.01" placeholder="0.00" value={newItem.unit_cost} onChange={(e) => setNewItem({ ...newItem, unit_cost: e.target.value })} />
                    </div>
                    <Button type="button" onClick={addPurchaseItem}>Add Item</Button>
                  </div>

                  {purchaseItems.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Unit Cost</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchaseItems.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.inventory_items?.name || 'Unknown Item'}</TableCell>
                            <TableCell>
                              <Input type="number" min={0} value={item.quantity} onChange={(e) => {
                                const qty = Number(e.target.value || 0);
                                setPurchaseItems(prev => prev.map((it, i) => i === index ? { ...it, quantity: qty, total_cost: qty * (it.unit_cost || 0) } : it));
                              }} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" step="0.01" min={0} value={item.unit_cost} onChange={(e) => {
                                const price = Number(e.target.value || 0);
                                setPurchaseItems(prev => prev.map((it, i) => i === index ? { ...it, unit_cost: price, total_cost: (it.quantity || 0) * price } : it));
                              }} />
                            </TableCell>
                            <TableCell>{formatMoney(item.total_cost)}</TableCell>
                            <TableCell>
                              <Button type="button" variant="outline" size="sm" onClick={() => removePurchaseItem(index)}>Remove</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="subtotal">Subtotal</Label>
                    <Input id="subtotal" type="number" step="0.01" value={formData.subtotal} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax_amount">Tax Amount</Label>
                    <Input id="tax_amount" type="number" step="0.01" placeholder="0.00" value={formData.tax_amount} readOnly />
                    <div className="flex items-center gap-2">
                      <Switch checked={applyTax} onCheckedChange={setApplyTax} />
                      <span className="text-sm">Apply Tax ({(orgTaxRate || 0)}%)</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Auto-calculated when enabled.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="total_amount">Total Amount</Label>
                    <Input id="total_amount" type="number" step="0.01" value={formData.total_amount} readOnly />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" placeholder="Additional notes..." value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
                  <Button type="submit">{isEdit ? "Update Purchase" : "Create Purchase"}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>Real-time totals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatMoney(stats.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-medium">{formatMoney(stats.tax)}</span>
              </div>
              <div className="flex items-center justify-between text-base">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold">{formatMoney(stats.total)}</span>
              </div>
              <div className="pt-2">
                <Badge variant="secondary" className="text-xs">{applyTax ? "Tax Applied" : "No Tax"}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
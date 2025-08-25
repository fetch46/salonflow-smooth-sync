import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Package, ShoppingCart, ClipboardList, Pencil, Settings, MapPin } from "lucide-react";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useOrganization } from "@/lib/saas/hooks";
import { useRegionalNumberFormatter, useRegionalDateFormatter } from "@/lib/saas";
import { toast } from "@/hooks/use-toast";

interface InventoryItem {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  unit: string | null;
  reorder_point: number | null;
  is_active: boolean;
  cost_price?: number | null;
  selling_price?: number | null;
}

interface PurchaseHistoryRow {
  id: string;
  purchase_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
  purchases?: { purchase_number: string; purchase_date: string; vendor_name?: string | null } | null;
}

interface UsageHistoryRow {
  id: string;
  job_card_id: string;
  quantity_used: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
  job_cards?: { job_number: string; start_time: string | null; end_time: string | null } | null;
}

interface SalesHistoryRow {
  id: string;
  sale_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  sales?: { sale_number: string; created_at: string; customer_name?: string | null } | null;
}

interface ItemAccountMapping {
  sales_account_id: string | null;
  purchase_account_id: string | null;
  inventory_account_id: string | null;
  is_taxable: boolean;
}

export default function ProductView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryRow[]>([]);
  const [usageHistory, setUsageHistory] = useState<UsageHistoryRow[]>([]);
  const [salesHistory, setSalesHistory] = useState<SalesHistoryRow[]>([]);
  const [onHand, setOnHand] = useState<number>(0);
  const [levelsByWarehouse, setLevelsByWarehouse] = useState<Array<{ warehouse_id: string; quantity: number; warehouses?: { name: string } | null }>>([]);
  const { format: formatMoney } = useOrganizationCurrency();
  const formatRegionalNumber = useRegionalNumberFormatter();
  const formatDate = useRegionalDateFormatter();

  // Accounts mapping state
  const { organization } = useOrganization();
  const [mapping, setMapping] = useState<ItemAccountMapping | null>(null);
  const [accountDisplay, setAccountDisplay] = useState<Record<string, { code: string; name: string }> | null>(null);
  const [accountsLoading, setAccountsLoading] = useState<boolean>(false);
  const [incomeAccounts, setIncomeAccounts] = useState<any[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
  const [assetAccounts, setAssetAccounts] = useState<any[]>([]);
  const [isEditAccountsOpen, setIsEditAccountsOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    sales_account_id: "",
    purchase_account_id: "",
    inventory_account_id: "",
    is_taxable: false,
  });
  const [accountErrors, setAccountErrors] = useState<{ sales?: string; purchase?: string; inventory?: string }>({});

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const { data: it } = await supabase
          .from("inventory_items")
          .select("id, name, description, sku, unit, reorder_point, is_active, cost_price, selling_price")
          .eq("id", id)
          .single();
        if (it) setItem(it as InventoryItem);

        const { data: purchases } = await supabase
          .from("purchase_items")
          .select(`id, purchase_id, quantity, unit_cost, total_cost, created_at,
                   purchases:purchase_id ( purchase_number, purchase_date, vendor_name )`)
          .eq("item_id", id)
          .order("created_at", { ascending: false });
        setPurchaseHistory((purchases || []) as any);

        // Sales history - using receipt_items instead of sale_items
        const { data: sales } = await supabase
          .from("receipt_items")
          .select(`id, sale_id, quantity, unit_price, total_price, created_at,
                   sales:sale_id ( sale_number, created_at, customer_name )`)
          .eq("product_id", id)
          .order("created_at", { ascending: false });
        setSalesHistory((sales || []) as any);

        const { data: usages } = await supabase
          .from("job_card_products")
          .select(`id, job_card_id, quantity_used, unit_cost, total_cost, created_at,
                   job_cards:job_card_id ( job_number, start_time, end_time )`)
          .eq("inventory_item_id", id)
          .order("created_at", { ascending: false });
        setUsageHistory((usages || []) as any);

        // On-hand and stock by warehouse from inventory_levels
        const { data: levels } = await supabase
          .from("inventory_levels")
          .select(`quantity, warehouse_id, warehouses(name)`)
          .eq("item_id", id);
        const hand = (levels || []).reduce((s: number, r: any) => s + Number(r.quantity || 0), 0);
        setOnHand(hand);
        setLevelsByWarehouse((levels || []) as any);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // Load mapping and display accounts
  useEffect(() => {
    const loadMappingAndAccounts = async () => {
      if (!id) return;
      try {
        const { data: mapData } = await supabase
          .from("inventory_item_accounts")
          .select("sales_account_id, purchase_account_id, inventory_account_id, is_taxable")
          .eq("item_id", id)
          .maybeSingle();

        const m: ItemAccountMapping = {
          sales_account_id: mapData?.sales_account_id || null,
          purchase_account_id: mapData?.purchase_account_id || null,
          inventory_account_id: mapData?.inventory_account_id || null,
          is_taxable: !!mapData?.is_taxable,
        };
        setMapping(m);
        setEditForm({
          sales_account_id: m.sales_account_id || "",
          purchase_account_id: m.purchase_account_id || "",
          inventory_account_id: m.inventory_account_id || "",
          is_taxable: m.is_taxable,
        });

        const ids = [m.sales_account_id, m.purchase_account_id, m.inventory_account_id].filter(Boolean) as string[];
        if (ids.length > 0) {
          const { data: accounts } = await supabase
            .from("accounts")
            .select("id, account_code, account_name")
            .in("id", ids);
          const map: Record<string, { code: string; name: string }> = {};
          for (const a of accounts || []) {
            map[a.id] = { code: a.account_code, name: a.account_name } as any;
          }
          setAccountDisplay(map);
        } else {
          setAccountDisplay(null);
        }
      } catch (e) {
        // ignore
      }
    };
    loadMappingAndAccounts();
  }, [id]);

  // Load selectable accounts for editing
  useEffect(() => {
    const loadSelectableAccounts = async () => {
      if (!organization?.id) return;
      try {
        setAccountsLoading(true);
        let accs: any[] | null = null;
        let err: any = null;
        try {
          const res = await supabase
            .from("accounts")
            .select("id, account_code, account_name, account_type, account_subtype")
            .eq("organization_id", organization.id);
          accs = res.data as any[] | null;
          err = res.error;
        } catch (innerErr: any) {
          err = innerErr;
        }
        if (err) {
          const message = String(err?.message || "");
          if (message.includes("account_subtype") || (message.toLowerCase().includes("column") && message.toLowerCase().includes("does not exist"))) {
            const { data, error } = await supabase
              .from("accounts")
              .select("id, account_code, account_name, account_type")
              .eq("organization_id", organization.id);
            if (error) throw error;
            accs = data as any[] | null;
          } else {
            throw err;
          }
        }
        const accounts = accs || [];
        setIncomeAccounts(accounts.filter((a: any) => a.account_type === 'Income'));
        setExpenseAccounts(accounts.filter((a: any) => a.account_type === 'Expense'));
        setAssetAccounts(accounts.filter((a: any) => a.account_type === 'Asset' && (!('account_subtype' in a) || ['Stock','Stocks'].includes((a as any).account_subtype))));
      } catch (e) {
        // ignore
      } finally {
        setAccountsLoading(false);
      }
    };
    loadSelectableAccounts();
  }, [organization?.id]);

  const totalPurchased = useMemo(() => purchaseHistory.reduce((s, r) => s + (Number(r.quantity) || 0), 0), [purchaseHistory]);
  const totalUsed = useMemo(() => usageHistory.reduce((s, r) => s + (Number(r.quantity_used) || 0), 0), [usageHistory]);
  const totalSold = useMemo(() => salesHistory.reduce((s, r) => s + (Number(r.quantity) || 0), 0), [salesHistory]);
  const netOutflow = useMemo(() => (totalUsed + totalSold), [totalUsed, totalSold]);
  const netChange = useMemo(() => (totalPurchased - netOutflow), [totalPurchased, netOutflow]);

  const saveAccounts = async () => {
    if (!id) return;
    try {
      const nextErrors: { sales?: string; purchase?: string; inventory?: string } = {};
      if (!editForm.sales_account_id) nextErrors.sales = "Required";
      if (!editForm.purchase_account_id) nextErrors.purchase = "Required";
      if (!editForm.inventory_account_id) nextErrors.inventory = "Required";
      setAccountErrors(nextErrors);
      if (nextErrors.sales || nextErrors.purchase || nextErrors.inventory) {
        toast({ title: "Missing accounts", description: "Please select Sales, Purchase, and Inventory accounts.", variant: "destructive" });
        return;
      }
      const payload = {
        item_id: id,
        sales_account_id: editForm.sales_account_id || null,
        purchase_account_id: editForm.purchase_account_id || null,
        inventory_account_id: editForm.inventory_account_id || null,
        is_taxable: !!editForm.is_taxable,
      } as const;

      // Try upsert on unique item_id; if that fails (no constraint), fallback to update-or-insert
      let upsertError: any = null;
      try {
        const res = await supabase.from('inventory_item_accounts').upsert(payload, { onConflict: 'item_id' });
        upsertError = res.error || null;
      } catch (err: any) {
        upsertError = err;
      }

      if (upsertError) {
        const { data: existing } = await supabase
          .from('inventory_item_accounts')
          .select('item_id')
          .eq('item_id', id)
          .maybeSingle();
        if (existing) {
          const { error } = await supabase
            .from('inventory_item_accounts')
            .update(payload)
            .eq('item_id', id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('inventory_item_accounts')
            .insert(payload);
          if (error) throw error;
        }
      }

      setIsEditAccountsOpen(false);
      setAccountErrors({});
      // reload mapping
      const { data: mapData, error: reloadError } = await supabase
        .from("inventory_item_accounts")
        .select("sales_account_id, purchase_account_id, inventory_account_id, is_taxable")
        .eq("item_id", id)
        .maybeSingle();
      if (reloadError) throw reloadError;
      const m: ItemAccountMapping = {
        sales_account_id: mapData?.sales_account_id || null,
        purchase_account_id: mapData?.purchase_account_id || null,
        inventory_account_id: mapData?.inventory_account_id || null,
        is_taxable: !!mapData?.is_taxable,
      };
      setMapping(m);
      const ids = [m.sales_account_id, m.purchase_account_id, m.inventory_account_id].filter(Boolean) as string[];
      if (ids.length > 0) {
        const { data: accounts, error: accErr } = await supabase
          .from("accounts")
          .select("id, account_code, account_name")
          .in("id", ids);
        if (accErr) throw accErr;
        const map: Record<string, { code: string; name: string }> = {};
        for (const a of accounts || []) {
          map[a.id] = { code: a.account_code, name: a.account_name } as any;
        }
        setAccountDisplay(map);
      } else {
        setAccountDisplay(null);
      }
      toast({ title: "Saved", description: "Accounts updated for this product" });
    } catch (e: any) {
      toast({ title: "Save failed", description: String(e?.message || e || 'Unknown error'), variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">Product not found.</p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto p-2 sm:p-4 md:p-6 space-y-6">
      {/* Product Header */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start md:items-center gap-4 md:gap-6 flex-1 min-w-0">
              <Button variant="ghost" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Package className="w-8 h-8 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent truncate">
                  {item.name}
                </h1>
                <p className="text-muted-foreground text-sm">
                  SKU: {item.sku || '—'} • Unit: {item.unit || '—'} • Reorder point: {item.reorder_point ?? '—'}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start md:items-end space-y-2">
              <div className="flex gap-2 w-full md:w-auto">
                <Button onClick={() => setIsEditAccountsOpen(true)} variant="outline" className="w-full md:w-auto">
                  <Settings className="w-4 h-4 mr-2" /> Edit Accounts
                </Button>
                <Button onClick={() => navigate(`/inventory/${id}/edit`)} className="w-full md:w-auto">
                  <Pencil className="w-4 h-4 mr-2" /> Edit Product
                </Button>
              </div>
              <div className="flex space-x-2">
                <Badge variant={item.is_active ? 'default' : 'secondary'} className="text-xs">
                  {item.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mini Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle>Mini Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="p-4 rounded-lg border bg-gradient-to-b from-white to-slate-50">
              <div className="text-xs text-muted-foreground">On Hand</div>
              <div className="text-2xl font-semibold mt-1">{formatRegionalNumber(onHand)}</div>
            </div>
            <div className="p-4 rounded-lg border bg-gradient-to-b from-white to-slate-50">
              <div className="text-xs text-muted-foreground">Purchased</div>
              <div className="text-2xl font-semibold mt-1">{totalPurchased}</div>
            </div>
            <div className="p-4 rounded-lg border bg-gradient-to-b from-white to-slate-50">
              <div className="text-xs text-muted-foreground">Used</div>
              <div className="text-2xl font-semibold mt-1">{totalUsed}</div>
            </div>
            <div className="p-4 rounded-lg border bg-gradient-to-b from-white to-slate-50">
              <div className="text-xs text-muted-foreground">Sold</div>
              <div className="text-2xl font-semibold mt-1">{totalSold}</div>
            </div>
            <div className={`p-4 rounded-lg border bg-gradient-to-b from-white to-slate-50 ${netChange >= 0 ? 'border-green-200' : 'border-red-200'}`}>
              <div className="text-xs text-muted-foreground">Net Change</div>
              <div className={`text-2xl font-semibold mt-1 ${netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>{netChange}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two-column layout: Details + Tabs */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4 xl:order-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Description</div>
                    <div className="text-sm">{item.description || '—'}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Cost Price</div>
                      <div className="font-medium">{formatMoney(Number(item.cost_price || 0))}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Sales Price</div>
                      <div className="font-medium">{formatMoney(Number(item.selling_price || 0))}</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="text-sm font-medium">Accounting & Tax</div>
                  <div className="text-xs text-muted-foreground">These accounts apply when you sell or purchase this item.</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    <div className="p-3 rounded border">
                      <div className="text-xs text-muted-foreground">Sales Account</div>
                      <div className="text-sm">
                        {mapping?.sales_account_id && accountDisplay?.[mapping.sales_account_id] ? (
                          `${accountDisplay[mapping.sales_account_id].code} — ${accountDisplay[mapping.sales_account_id].name}`
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                    <div className="p-3 rounded border">
                      <div className="text-xs text-muted-foreground">Purchase Account</div>
                      <div className="text-sm">
                        {mapping?.purchase_account_id && accountDisplay?.[mapping.purchase_account_id] ? (
                          `${accountDisplay[mapping.purchase_account_id].code} — ${accountDisplay[mapping.purchase_account_id].name}`
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                    <div className="p-3 rounded border">
                      <div className="text-xs text-muted-foreground">Inventory Account</div>
                      <div className="text-sm">
                        {mapping?.inventory_account_id && accountDisplay?.[mapping.inventory_account_id] ? (
                          `${accountDisplay[mapping.inventory_account_id].code} — ${accountDisplay[mapping.inventory_account_id].name}`
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                    <div className="p-3 rounded border">
                      <div className="text-xs text-muted-foreground">Taxable</div>
                      <div className="text-sm">{mapping?.is_taxable ? 'Yes' : 'No'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="xl:col-span-8 xl:order-1 space-y-6">
          <Tabs defaultValue="usage" className="space-y-4">
            <TabsList>
              <TabsTrigger value="usage" className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4" /> Usage History
              </TabsTrigger>
              <TabsTrigger value="purchases" className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" /> Purchase History
              </TabsTrigger>
              <TabsTrigger value="sales" className="flex items-center gap-2">
                <Package className="w-4 h-4" /> Sales History
              </TabsTrigger>
              <TabsTrigger value="stock" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Stock by Location
              </TabsTrigger>
            </TabsList>

            <TabsContent value="usage">
              <Card>
                <CardHeader>
                  <CardTitle>Item Usage History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto rounded-lg border">
                    <Table className="min-w-[720px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Job Card</TableHead>
                          <TableHead className="text-right">Qty Used</TableHead>
                          <TableHead className="hidden sm:table-cell text-right">Unit Cost</TableHead>
                          <TableHead className="hidden sm:table-cell text-right">Total Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usageHistory.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">No usage recorded.</TableCell>
                          </TableRow>
                        ) : (
                          usageHistory.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell>{formatDate(new Date(row.created_at))}</TableCell>
                              <TableCell className="font-medium">{row.job_cards?.job_number || '—'}</TableCell>
                              <TableCell className="text-right">{row.quantity_used}</TableCell>
                              <TableCell className="hidden sm:table-cell text-right">{formatMoney(Number(row.unit_cost || 0))}</TableCell>
                              <TableCell className="hidden sm:table-cell text-right">{formatMoney(Number(row.total_cost || 0))}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="purchases">
              <Card>
                <CardHeader>
                  <CardTitle>Purchase History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto rounded-lg border">
                    <Table className="min-w-[720px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Purchase #</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="hidden sm:table-cell text-right">Unit Cost</TableHead>
                          <TableHead className="hidden sm:table-cell text-right">Total Cost</TableHead>
                          <TableHead className="hidden md:table-cell">Vendor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchaseHistory.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">No purchases recorded.</TableCell>
                          </TableRow>
                        ) : (
                          purchaseHistory.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell>{formatDate(new Date(row.created_at))}</TableCell>
                              <TableCell className="font-medium">{row.purchases?.purchase_number || '—'}</TableCell>
                              <TableCell className="text-right">{row.quantity}</TableCell>
                              <TableCell className="hidden sm:table-cell text-right">{formatMoney(Number(row.unit_cost || 0))}</TableCell>
                              <TableCell className="hidden sm:table-cell text-right">{formatMoney(Number(row.total_cost || 0))}</TableCell>
                              <TableCell className="hidden md:table-cell">{row.purchases?.vendor_name || '—'}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sales">
              <Card>
                <CardHeader>
                  <CardTitle>Sales History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto rounded-lg border">
                    <Table className="min-w-[720px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Sale #</TableHead>
                          <TableHead className="hidden md:table-cell">Customer</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="hidden sm:table-cell text-right">Unit Price</TableHead>
                          <TableHead className="hidden sm:table-cell text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesHistory.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">No sales recorded.</TableCell>
                          </TableRow>
                        ) : (
                          salesHistory.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell>{formatDate(new Date(row.created_at))}</TableCell>
                              <TableCell className="font-medium">{row.sales?.sale_number || '—'}</TableCell>
                              <TableCell className="hidden md:table-cell">{row.sales?.customer_name || 'Walk-in Customer'}</TableCell>
                              <TableCell className="text-right">{row.quantity}</TableCell>
                              <TableCell className="hidden sm:table-cell text-right">{formatMoney(Number(row.unit_price || 0))}</TableCell>
                              <TableCell className="hidden sm:table-cell text-right">{formatMoney(Number(row.total_price || 0))}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stock">
              <Card>
                <CardHeader>
                  <CardTitle>Stock by Location</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto rounded-lg border">
                    <Table className="min-w-[520px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Location</TableHead>
                          <TableHead className="text-right">Available Qty</TableHead>
                          <TableHead className="hidden md:table-cell text-right">Share</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {levelsByWarehouse.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground">No stock levels found.</TableCell>
                          </TableRow>
                        ) : (
                          levelsByWarehouse.map((lvl, idx) => {
                            const qty = Number(lvl.quantity || 0);
                            const share = onHand > 0 ? Math.round((qty / onHand) * 100) : 0;
                            return (
                              <TableRow key={`${lvl.warehouse_id}-${idx}`}>
                                <TableCell className="font-medium">{(lvl as any).warehouses?.name || '—'}</TableCell>
                                <TableCell className="text-right">{qty}</TableCell>
                                <TableCell className="hidden md:table-cell text-right">{share}%</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={isEditAccountsOpen} onOpenChange={setIsEditAccountsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Accounts</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sales Account</Label>
              <Select
                value={editForm.sales_account_id}
                onValueChange={(v) => setEditForm({ ...editForm, sales_account_id: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={accountsLoading ? 'Loading...' : 'Select income account'} />
                </SelectTrigger>
                <SelectContent>
                  {incomeAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{`${a.account_code} - ${a.account_name}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {accountErrors.sales && (<p className="text-xs text-destructive">{accountErrors.sales}</p>)}
            </div>
            <div className="space-y-2">
              <Label>Purchase Account</Label>
              <Select
                value={editForm.purchase_account_id}
                onValueChange={(v) => setEditForm({ ...editForm, purchase_account_id: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={accountsLoading ? 'Loading...' : 'Select expense account'} />
                </SelectTrigger>
                <SelectContent>
                  {expenseAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{`${a.account_code} - ${a.account_name}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {accountErrors.purchase && (<p className="text-xs text-destructive">{accountErrors.purchase}</p>)}
            </div>
            <div className="space-y-2">
              <Label>Inventory Account</Label>
              <Select
                value={editForm.inventory_account_id}
                onValueChange={(v) => setEditForm({ ...editForm, inventory_account_id: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={accountsLoading ? 'Loading...' : 'Select asset account (Stock)'} />
                </SelectTrigger>
                <SelectContent>
                  {assetAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{`${a.account_code} - ${a.account_name}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {accountErrors.inventory && (<p className="text-xs text-destructive">{accountErrors.inventory}</p>)}
            </div>
            <div className="space-y-2">
              <Label>Taxable</Label>
              <div className="flex h-10 items-center px-3 rounded-md border">
                <Switch checked={editForm.is_taxable} onCheckedChange={(v) => setEditForm({ ...editForm, is_taxable: v })} />
                <span className="ml-2 text-sm text-muted-foreground">Charge tax when selling this item</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditAccountsOpen(false)}>Cancel</Button>
            <Button onClick={saveAccounts}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoreHorizontal, Pencil, Trash2, Eye, ArrowRight, Calendar as CalendarIcon, Search, TrendingUp, Package, MapPin, Activity } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { addDays, format, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

interface InventoryItem { id: string; name: string; cost_price?: number | null; selling_price?: number | null; unit?: string | null }
interface Location { id: string; name: string; }
interface LevelRow { id: string; item_id: string; location_id: string; quantity: number; inventory_items?: { name: string }; business_locations?: { name: string }; }

interface TransferRow { id: string; item_id: string; from_location_id: string; to_location_id: string; quantity: number; created_at: string; updated_at: string; notes?: string; inventory_items?: { name: string; cost_price?: number | null; selling_price?: number | null; unit?: string | null }; from_location?: { name: string }; to_location?: { name: string }; }

export default function StockTransfers() {
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [viewOpen, setViewOpen] = useState<boolean>(false);
  const [editOpen, setEditOpen] = useState<boolean>(false);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRow | null>(null);
  const [editForm, setEditForm] = useState({ item_id: "", from_location_id: "", to_location_id: "", quantity: "", notes: "" });

  const [form, setForm] = useState({ item_id: "", from_location_id: "", to_location_id: "", quantity: "" });
  const qty = Number(form.quantity || 0);

  // Listing filters and dashboard state
  const [searchText, setSearchText] = useState<string>("");
  const [quickRange, setQuickRange] = useState<string>("last_30");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({ from: subDays(new Date(), 29), to: new Date() }));

  const fetchRefs = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, locsRes, levelsRes, transfersRes] = await Promise.all([
        supabase.from("inventory_items").select("id, name, cost_price, selling_price, unit").eq("type", "good").eq("is_active", true).order("name"),
        supabase.from("business_locations").select("id, name").order("name"),
        supabase
          .from("inventory_levels")
          .select(
            `id, item_id, location_id, quantity,
             inventory_items(name),
             business_locations(name)`
          ),
        supabase
          .from("inventory_transfers")
          .select(
            `id, item_id, from_location_id, to_location_id, quantity, created_at, updated_at, notes,
             inventory_items(name, cost_price, selling_price, unit)`
          )
          .order("created_at", { ascending: false }),
      ]);
      setItems(itemsRes.data || []);
      setLocations(locsRes.data || []);
      setLevels((levelsRes.data || []) as LevelRow[]);
      setTransfers((transfersRes.data || []) as TransferRow[]);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchRefs(); }, [fetchRefs]);

  const getAvailableQty = (itemId: string, locationId: string) => {
    const row = levels.find(l => l.item_id === itemId && l.location_id === locationId);
    return Number(row?.quantity || 0);
  };

  const submitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.item_id || !form.from_location_id || !form.to_location_id || qty) {
      // keep original validations below
    }
    if (!form.item_id || !form.from_location_id || !form.to_location_id || !qty) {
      toast({ title: "Missing data", description: "Select item, locations and quantity", variant: "destructive" });
      return;
    }
    if (form.from_location_id === form.to_location_id) {
      toast({ title: "Invalid selection", description: "From and To locations must differ", variant: "destructive" });
      return;
    }
    const available = getAvailableQty(form.item_id, form.from_location_id);
    if (qty > available) {
      toast({ title: "Insufficient stock", description: `Only ${available} available at source location`, variant: "destructive" });
      return;
    }

    try {
      // Record transfer
      await supabase.from("inventory_transfers").insert([
        {
          item_id: form.item_id,
          from_location_id: form.from_location_id,
          to_location_id: form.to_location_id,
          quantity: qty,
          notes: null,
        },
      ]);

      toast({ title: "Transfer completed", description: "Stock moved between locations" });
      setForm({ item_id: "", from_location_id: "", to_location_id: "", quantity: "" });
      fetchRefs();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to complete transfer", variant: "destructive" });
    }
  };

  const openView = (t: TransferRow) => {
    setSelectedTransfer(t);
    setViewOpen(true);
  };

  const openEdit = (t: TransferRow) => {
    setSelectedTransfer(t);
    setEditForm({
      item_id: t.item_id,
      from_location_id: t.from_location_id,
      to_location_id: t.to_location_id,
      quantity: String(t.quantity || 0),
      notes: t.notes || "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!selectedTransfer) return;
    const newQty = Number(editForm.quantity || 0);
    if (!editForm.item_id || !editForm.from_location_id || !editForm.to_location_id || newQty <= 0) {
      toast({ title: "Missing data", description: "Fill all required fields", variant: "destructive" });
      return;
    }

    try {
      // Revert original inventory move
      const orig = selectedTransfer;
      // Add back to source
      const { data: srcLevels } = await supabase
        .from("inventory_levels")
        .select("id, quantity")
        .eq("item_id", orig.item_id)
        .eq("location_id", orig.to_location_id)
        .limit(1);
      if (srcLevels && srcLevels.length > 0) {
        await supabase
          .from("inventory_levels")
          .update({ quantity: Number(srcLevels[0].quantity || 0) - Number(orig.quantity || 0) })
          .eq("id", srcLevels[0].id);
      }
      const { data: dstLevels } = await supabase
        .from("inventory_levels")
        .select("id, quantity")
        .eq("item_id", orig.item_id)
        .eq("location_id", orig.from_location_id)
        .limit(1);
      if (dstLevels && dstLevels.length > 0) {
        await supabase
          .from("inventory_levels")
          .update({ quantity: Number(dstLevels[0].quantity || 0) + Number(orig.quantity || 0) })
          .eq("id", dstLevels[0].id);
      } else {
        await supabase
          .from("inventory_levels")
          .insert([{ item_id: orig.item_id, location_id: orig.from_location_id, quantity: Number(orig.quantity || 0) }]);
      }

      // Apply new inventory move
      // Decrease from new source
      const { data: newSrc } = await supabase
        .from("inventory_levels")
        .select("id, quantity")
        .eq("item_id", editForm.item_id)
        .eq("location_id", editForm.from_location_id)
        .limit(1);
      if (newSrc && newSrc.length > 0) {
        await supabase
          .from("inventory_levels")
          .update({ quantity: Number(newSrc[0].quantity || 0) - newQty })
          .eq("id", newSrc[0].id);
      }
      // Increase at new destination
      const { data: newDst } = await supabase
        .from("inventory_levels")
        .select("id, quantity")
        .eq("item_id", editForm.item_id)
        .eq("location_id", editForm.to_location_id)
        .limit(1);
      if (newDst && newDst.length > 0) {
        await supabase
          .from("inventory_levels")
          .update({ quantity: Number(newDst[0].quantity || 0) + newQty })
          .eq("id", newDst[0].id);
      } else {
        await supabase
          .from("inventory_levels")
          .insert([{ item_id: editForm.item_id, location_id: editForm.to_location_id, quantity: newQty }]);
      }

      // Update transfer record
      await supabase
        .from("inventory_transfers")
        .update({
          item_id: editForm.item_id,
          from_location_id: editForm.from_location_id,
          to_location_id: editForm.to_location_id,
          quantity: newQty,
          notes: editForm.notes || null,
        })
        .eq("id", selectedTransfer.id);

      toast({ title: "Transfer updated", description: "Changes saved" });
      setEditOpen(false);
      setSelectedTransfer(null);
      fetchRefs();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to update transfer", variant: "destructive" });
    }
  };

  const deleteTransfer = async (t: TransferRow) => {
    try {
      // Revert the transfer in inventory
      const { data: dst } = await supabase
        .from("inventory_levels")
        .select("id, quantity")
        .eq("item_id", t.item_id)
        .eq("location_id", t.to_location_id)
        .limit(1);
      if (dst && dst.length > 0) {
        await supabase
          .from("inventory_levels")
          .update({ quantity: Number(dst[0].quantity || 0) - Number(t.quantity || 0) })
          .eq("id", dst[0].id);
      }
      const { data: src } = await supabase
        .from("inventory_levels")
        .select("id, quantity")
        .eq("item_id", t.item_id)
        .eq("location_id", t.from_location_id)
        .limit(1);
      if (src && src.length > 0) {
        await supabase
          .from("inventory_levels")
          .update({ quantity: Number(src[0].quantity || 0) + Number(t.quantity || 0) })
          .eq("id", src[0].id);
      } else {
        await supabase
          .from("inventory_levels")
          .insert([{ item_id: t.item_id, location_id: t.from_location_id, quantity: Number(t.quantity || 0) }]);
      }

      await supabase.from("inventory_transfers").delete().eq("id", t.id);
      toast({ title: "Transfer deleted", description: "Inventory reverted" });
      fetchRefs();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to delete transfer", variant: "destructive" });
    }
  };

  const formatMoney = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount || 0));

  // Derived filters & dashboard data
  const filteredTransfers = useMemo(() => {
    const s = searchText.trim().toLowerCase();
    return transfers.filter((t) => {
      const inRange = (() => {
        if (!dateRange?.from && !dateRange?.to) return true;
        const d = new Date(t.created_at);
        const fromOk = dateRange?.from ? d >= new Date(dateRange.from.setHours(0, 0, 0, 0)) : true;
        const toOk = dateRange?.to ? d <= new Date(dateRange.to.setHours(23, 59, 59, 999)) : true;
        return fromOk && toOk;
      })();
      if (!inRange) return false;
      if (!s) return true;
      const itemName = t.inventory_items?.name || items.find((i) => i.id === t.item_id)?.name || "";
      const fromName = locations.find((l) => l.id === t.from_location_id)?.name || "";
      const toName = locations.find((l) => l.id === t.to_location_id)?.name || "";
      return (
        itemName.toLowerCase().includes(s) ||
        fromName.toLowerCase().includes(s) ||
        toName.toLowerCase().includes(s) ||
        (t.notes || "").toLowerCase().includes(s)
      );
    });
  }, [transfers, searchText, dateRange, items, locations]);

  const kpis = useMemo(() => {
    const totalTransfers = filteredTransfers.length;
    const totalQuantity = filteredTransfers.reduce((sum, t) => sum + Number(t.quantity || 0), 0);
    const uniqueItems = new Set(filteredTransfers.map((t) => t.item_id)).size;
    const uniqueLocations = new Set(
      filteredTransfers.flatMap((t) => [t.from_location_id, t.to_location_id])
    ).size;
    return { totalTransfers, totalQuantity, uniqueItems, uniqueLocations };
  }, [filteredTransfers]);

  const chartData = useMemo(() => {
    // Group by date (YYYY-MM-DD)
    const map = new Map<string, number>();
    filteredTransfers.forEach((t) => {
      const key = new Date(t.created_at).toISOString().slice(0, 10);
      map.set(key, (map.get(key) || 0) + Number(t.quantity || 0));
    });
    const entries = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, qty]) => ({ date, qty }));
    return entries;
  }, [filteredTransfers]);

  const applyQuickRange = (key: string) => {
    setQuickRange(key);
    const today = new Date();
    switch (key) {
      case "today":
        setDateRange({ from: today, to: today });
        break;
      case "last_7":
        setDateRange({ from: subDays(today, 6), to: today });
        break;
      case "last_30":
        setDateRange({ from: subDays(today, 29), to: today });
        break;
      case "this_month":
        setDateRange({ from: startOfMonth(today), to: endOfMonth(today) });
        break;
      case "ytd":
        setDateRange({ from: startOfYear(today), to: endOfYear(today) });
        break;
      case "all_time":
        setDateRange(undefined);
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Stock Transfers</h2>
          <p className="text-muted-foreground">Move stock between locations and review historical transfers</p>
        </div>
      </div>

      {/* Mini Dashboard */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transfers</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalTransfers}</div>
            <p className="text-xs text-muted-foreground">{dateRange?.from || dateRange?.to ? "Filtered" : "All time"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quantity Moved</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalQuantity}</div>
            <p className="text-xs text-muted-foreground">Units transferred</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Items Moved</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.uniqueItems}</div>
            <p className="text-xs text-muted-foreground">Unique products</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locations Involved</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.uniqueLocations}</div>
            <p className="text-xs text-muted-foreground">Across transfers</p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart + Filters */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Transfer Quantity Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ qty: { label: "Quantity", color: "hsl(var(--primary))" } }}
              className="h-[180px] w-full"
            >
              <AreaChart data={chartData} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => format(new Date(v), "MM/dd")}
                  minTickGap={24}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="qty"
                  type="monotone"
                  stroke="var(--color-qty)"
                  fill="var(--color-qty)"
                  fillOpacity={0.15}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Select value={quickRange} onValueChange={(v) => applyQuickRange(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Quick range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="last_7">Last 7 days</SelectItem>
                  <SelectItem value="last_30">Last 30 days</SelectItem>
                  <SelectItem value="this_month">This month</SelectItem>
                  <SelectItem value="ytd">Year to date</SelectItem>
                  <SelectItem value="all_time">All time</SelectItem>
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <span>
                          {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                        </span>
                      ) : (
                        <span>{format(dateRange.from, "LLL dd, y")}</span>
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={(range) => setDateRange(range)}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by item, location, or notes"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="new" className="space-y-6">
        <TabsList>
          <TabsTrigger value="new">New Transfer</TabsTrigger>
          <TabsTrigger value="levels">Levels</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="new">
          {/* New Transfer Card */}
          <Card>
            <CardHeader>
              <CardTitle>New Transfer</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitTransfer} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                  <Label>Item</Label>
                  <Select value={form.item_id} onValueChange={(v) => setForm({ ...form, item_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((it) => (
                        <SelectItem key={it.id} value={it.id}>
                          {it.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>From Location</Label>
                  <Select value={form.from_location_id} onValueChange={(v) => setForm({ ...form, from_location_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.item_id && form.from_location_id && (
                    <div className="text-xs text-muted-foreground">
                      Available: {getAvailableQty(form.item_id, form.from_location_id)}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>To Location</Label>
                  <Select value={form.to_location_id} onValueChange={(v) => setForm({ ...form, to_location_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                </div>
                <div>
                  <Button type="submit">Transfer</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="levels">
          {/* Levels Card */}
          <Card>
            <CardHeader>
              <CardTitle>Current Levels</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Location</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!loading &&
                      levels.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.business_locations?.name || row.location_id}</TableCell>
                          <TableCell>{row.inventory_items?.name || row.item_id}</TableCell>
                          <TableCell className="text-right">{Number(row.quantity || 0)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Transfer History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!loading &&
                      filteredTransfers.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>{new Date(t.created_at).toLocaleString()}</TableCell>
                          <TableCell>{t.inventory_items?.name || items.find((i) => i.id === t.item_id)?.name || t.item_id}</TableCell>
                          <TableCell>{locations.find((l) => l.id === t.from_location_id)?.name || t.from_location_id}</TableCell>
                          <TableCell>{locations.find((l) => l.id === t.to_location_id)?.name || t.to_location_id}</TableCell>
                          <TableCell className="text-right">{Number(t.quantity || 0)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => openView(t)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openEdit(t)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-red-600" onClick={() => deleteTransfer(t)}>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Sheet */}
      <Sheet open={viewOpen} onOpenChange={setViewOpen}>
        <SheetContent side="right" className="sm:max-w-xl w-full">
          <SheetHeader>
            <SheetTitle>Transfer Details</SheetTitle>
          </SheetHeader>
          <div className="space-y-6 py-4">
            {selectedTransfer && (
              <div className="space-y-4">
                {/* Primary Info */}
                <div className="grid grid-cols-1 gap-4">
                  <div className="rounded-lg border bg-card">
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                      <div className="sm:col-span-2">
                        <div className="text-sm text-muted-foreground">Item</div>
                        <div className="font-semibold text-lg">
                          {selectedTransfer.inventory_items?.name ||
                            items.find((i) => i.id === selectedTransfer.item_id)?.name ||
                            selectedTransfer.item_id}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Unit: {selectedTransfer.inventory_items?.unit || 'Each'}
                        </div>
                      </div>
                      <div className="justify-self-end">
                        <Badge variant="secondary">Qty {Number(selectedTransfer.quantity || 0)}</Badge>
                      </div>
                    </div>
                    <Separator />
                    {/* Movement */}
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                      <div>
                        <div className="text-xs text-muted-foreground">From</div>
                        <div className="font-medium">{locations.find((l) => l.id === selectedTransfer.from_location_id)?.name || selectedTransfer.from_location_id}</div>
                        <div className="text-xs text-muted-foreground">Current stock: {getAvailableQty(selectedTransfer.item_id, selectedTransfer.from_location_id)}</div>
                      </div>
                      <div className="flex items-center justify-center">
                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">To</div>
                        <div className="font-medium">{locations.find((l) => l.id === selectedTransfer.to_location_id)?.name || selectedTransfer.to_location_id}</div>
                        <div className="text-xs text-muted-foreground">Current stock: {getAvailableQty(selectedTransfer.item_id, selectedTransfer.to_location_id)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financials */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Value Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const unitCost = Number(selectedTransfer.inventory_items?.cost_price || 0);
                      const unitPrice = Number(selectedTransfer.inventory_items?.selling_price || 0);
                      const quantity = Number(selectedTransfer.quantity || 0);
                      const totalCost = quantity * unitCost;
                      const totalSales = quantity * unitPrice;
                      const margin = totalSales - totalCost;
                      const marginPct = totalSales > 0 ? (margin / totalSales) * 100 : 0;
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <div className="rounded-md border p-3">
                            <div className="text-xs text-muted-foreground">Unit Cost</div>
                            <div className="font-semibold">{formatMoney(unitCost)}</div>
                          </div>
                          <div className="rounded-md border p-3">
                            <div className="text-xs text-muted-foreground">Unit Price</div>
                            <div className="font-semibold">{formatMoney(unitPrice)}</div>
                          </div>
                          <div className="rounded-md border p-3">
                            <div className="text-xs text-muted-foreground">Quantity</div>
                            <div className="font-semibold">{quantity}</div>
                          </div>
                          <div className="rounded-md border p-3">
                            <div className="text-xs text-muted-foreground">Total Cost Value</div>
                            <div className="font-semibold">{formatMoney(totalCost)}</div>
                          </div>
                          <div className="rounded-md border p-3">
                            <div className="text-xs text-muted-foreground">Total Sales Value</div>
                            <div className="font-semibold">{formatMoney(totalSales)}</div>
                          </div>
                          <div className="rounded-md border p-3">
                            <div className="text-xs text-muted-foreground">Margin</div>
                            <div className="font-semibold flex items-center gap-2">
                              {formatMoney(margin)}
                              <Badge variant={margin >= 0 ? 'default' : 'destructive'} className="text-xs">{marginPct.toFixed(1)}%</Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Meta */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Created</div>
                    <div className="font-medium">{new Date(selectedTransfer.created_at).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Updated</div>
                    <div className="font-medium">{new Date(selectedTransfer.updated_at).toLocaleString()}</div>
                  </div>
                </div>
                {selectedTransfer.notes && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Notes</div>
                    <div className="text-sm whitespace-pre-wrap">{selectedTransfer.notes}</div>
                  </div>
                )}
              </div>
            )}
          </div>
          <SheetFooter>
            <div className="flex gap-2 ml-auto">
              <Button variant="secondary" onClick={() => { setViewOpen(false); openEdit(selectedTransfer as TransferRow); }}>Edit</Button>
              <Button variant="destructive" onClick={() => { if (selectedTransfer) deleteTransfer(selectedTransfer); setViewOpen(false); }}>Delete</Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transfer</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <Label>Item</Label>
              <Select value={editForm.item_id} onValueChange={(v) => setEditForm({ ...editForm, item_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((it) => (
                    <SelectItem key={it.id} value={it.id}>
                      {it.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" min={0} value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>From Location</Label>
              <Select value={editForm.from_location_id} onValueChange={(v) => setEditForm({ ...editForm, from_location_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>To Location</Label>
              <Select value={editForm.to_location_id} onValueChange={(v) => setEditForm({ ...editForm, to_location_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Notes</Label>
              <Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Plus, Truck } from "lucide-react";
import { useSaas } from "@/lib/saas";

interface GoodsReceivedRow { id: string; grn_number: string | null; received_date: string; warehouse_id?: string | null; location_id: string; purchase_id: string; purchase?: { purchase_number: string; vendor_name: string } | null; warehouse?: { name: string } | null }

export default function GoodsReceived() {
  const navigate = useNavigate();
  const { organization } = useSaas();
  const [rows, setRows] = useState<GoodsReceivedRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      // Base fetch without FK joins to avoid relationship issues. Fallback if grn_number column is missing.
      const buildQuery = (includeGrn: boolean) => {
        let q = supabase
          .from("goods_received")
          .select(includeGrn ? "id, grn_number, received_date, warehouse_id, location_id, purchase_id" : "id, received_date, warehouse_id, location_id, purchase_id")
          .order("received_date", { ascending: false });
        if (organization?.id) {
          q = q.eq("organization_id", organization.id);
        }
        return q;
      };

      let data: any[] | null = null;
      try {
        const res = await buildQuery(true);
        if (res.error) throw res.error;
        data = res.data as any[] | null;
      } catch (err: any) {
        const msg = String(err?.message || "").toLowerCase();
        if (msg.includes("column") && msg.includes("grn_number") && msg.includes("does not exist")) {
          const res2 = await buildQuery(false);
          if (res2.error) throw res2.error;
          data = res2.data as any[] | null;
        } else {
          throw err;
        }
      }

      const list = (data || []) as Array<GoodsReceivedRow>;

      // Hydrate related purchase and warehouse display fields in parallel
      const purchaseIds = Array.from(new Set(list.map(r => r.purchase_id).filter(Boolean)));
      const warehouseIds = Array.from(new Set(list.map(r => r.warehouse_id).filter(Boolean))) as string[];

      const [purchasesRes, warehousesRes] = await Promise.all([
        purchaseIds.length
          ? supabase.from("purchases").select("id, purchase_number, vendor_name").in("id", purchaseIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        warehouseIds.length
          ? supabase.from("warehouses").select("id, name").in("id", warehouseIds)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      const purchasesMap = new Map<string, { purchase_number: string; vendor_name: string }>();
      for (const p of ((purchasesRes.data || []) as any[])) {
        purchasesMap.set(p.id, { purchase_number: p.purchase_number, vendor_name: p.vendor_name });
      }
      const warehousesMap = new Map<string, { name: string }>();
      for (const w of ((warehousesRes.data || []) as any[])) {
        warehousesMap.set(w.id, { name: w.name });
      }

      const hydrated = list.map(r => ({
        ...r,
        purchase: purchasesMap.get(r.purchase_id) || null,
        warehouse: (r.warehouse_id ? warehousesMap.get(r.warehouse_id) : undefined) || null,
      }));

      setRows(hydrated);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  const filtered = rows.filter(r => {
    const t = search.toLowerCase();
    return (
      (r.grn_number || '').toLowerCase().includes(t) ||
      (r.purchase?.purchase_number || '').toLowerCase().includes(t) ||
      (r.purchase?.vendor_name || '').toLowerCase().includes(t) ||
      (r.warehouse?.name || '').toLowerCase().includes(t)
    );
  });

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 pb-24 sm:pb-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2.5 bg-gradient-to-br from-emerald-600 to-green-600 rounded-xl shadow-lg">
            <Truck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Goods Received</h1>
            <p className="text-slate-600">All purchase receipts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate("/goods-received/new")} className="bg-gradient-to-r from-emerald-600 to-green-600"> <Plus className="h-4 w-4 mr-2"/> New Receipt</Button>
          <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-2"/>Refresh</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Receipts</CardTitle>
          <CardDescription>Search and manage receipts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Input placeholder="Search GRN, purchase #, vendor or warehouse" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GRN #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Purchase</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6}>Loading...</TableCell>
                  </TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>No receipts found</TableCell>
                  </TableRow>
                )}
                {!loading && filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{r.grn_number || r.id.slice(0,8)}</TableCell>
                    <TableCell>{(r.received_date || '').slice(0,10)}</TableCell>
                    <TableCell>{r.purchase?.purchase_number}</TableCell>
                    <TableCell>{r.purchase?.vendor_name}</TableCell>
                    <TableCell>{r.warehouse?.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/goods-received/${r.id}/edit`)}>Open</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
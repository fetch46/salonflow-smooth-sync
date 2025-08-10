import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Plus, Truck } from "lucide-react";

interface GoodsReceivedRow { id: string; grn_number: string | null; received_date: string; location_id: string; purchase_id: string; purchase?: { purchase_number: string; vendor_name: string } | null; location?: { name: string } | null }

export default function GoodsReceived() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<GoodsReceivedRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("goods_received")
        .select("id, grn_number, received_date, location_id, purchase_id, purchase:purchases(purchase_number, vendor_name), location:business_locations(name)")
        .order("received_date", { ascending: false });
      if (error) throw error;
      setRows((data || []) as any);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r => {
    const t = search.toLowerCase();
    return (
      (r.grn_number || '').toLowerCase().includes(t) ||
      (r.purchase?.purchase_number || '').toLowerCase().includes(t) ||
      (r.purchase?.vendor_name || '').toLowerCase().includes(t) ||
      (r.location?.name || '').toLowerCase().includes(t)
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
            <Input placeholder="Search GRN, purchase #, vendor or location" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GRN #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Purchase</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{r.grn_number || r.id.slice(0,8)}</TableCell>
                    <TableCell>{(r.received_date || '').slice(0,10)}</TableCell>
                    <TableCell>{r.purchase?.purchase_number}</TableCell>
                    <TableCell>{r.purchase?.vendor_name}</TableCell>
                    <TableCell>{r.location?.name}</TableCell>
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
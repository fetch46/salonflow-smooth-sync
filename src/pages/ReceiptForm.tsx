import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { useOrganizationTaxRate } from "@/lib/saas/hooks";

interface ServiceOption {
  id: string;
  name: string;
  price: number | null;
  commission_percentage: number | null;
}

interface StaffOption { id: string; full_name: string }
interface ClientOption { id: string; full_name: string }

interface JobCardOption {
  id: string;
  job_number: string;
  client_id: string | null;
  location_id: string | null;
}

interface BusinessLocation { id: string; name: string }

interface LineItem {
  id: string; // local temp id
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  staff_id: string | null;
  commission_percentage: number; // derived from service or 0
}

export default function ReceiptForm() {
  const navigate = useNavigate();
  const params = useParams();
  const { format: formatMoney } = useOrganizationCurrency();
  const orgTaxRate = useOrganizationTaxRate();
  const isEdit = Boolean(params.id);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const [services, setServices] = useState<ServiceOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [jobCards, setJobCards] = useState<JobCardOption[]>([]);

  const [receiptNumber, setReceiptNumber] = useState<string>("");
  const [status, setStatus] = useState<string>("open");
  const [customerId, setCustomerId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [applyTax, setApplyTax] = useState<boolean>(false);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [items, setItems] = useState<LineItem[]>([]);
  const [locationId, setLocationId] = useState<string>("");
  const [jobCardId, setJobCardId] = useState<string>("");

  const subtotal = useMemo(() => items.reduce((sum, it) => sum + Number(it.total_price || 0), 0), [items]);
  const total = useMemo(() => Math.max(0, subtotal + Number(taxAmount || 0) - Number(discountAmount || 0)), [subtotal, taxAmount, discountAmount]);

  // Auto-calc tax from subtotal when applyTax is enabled or org tax rate changes
  useEffect(() => {
    if (applyTax) {
      const pct = typeof orgTaxRate === 'number' ? orgTaxRate : 0;
      const calc = Number(((subtotal * (pct / 100))).toFixed(2));
      setTaxAmount(calc);
    }
  }, [applyTax, orgTaxRate, subtotal]);

  const loadOptions = useCallback(async (): Promise<{ services: ServiceOption[]; staff: StaffOption[]; clients: ClientOption[]; locations: BusinessLocation[]; jobCards: JobCardOption[] }> => {
    try {
      // Services
      const { data: svc } = await supabase
        .from("services")
        .select("id, name, price, commission_percentage")
        .order("name");
      const mappedServices: ServiceOption[] = (svc || []).map((s: any) => ({ id: s.id, name: s.name, price: s.price ?? 0, commission_percentage: s.commission_percentage ?? null }));
      setServices(mappedServices);

      // Staff
      const { data: st } = await supabase
        .from("staff")
        .select("id, full_name")
        .order("full_name");
      const mappedStaff = (st || []) as StaffOption[];
      setStaff(mappedStaff);

      // Clients
      const { data: cl } = await supabase
        .from("clients")
        .select("id, full_name")
        .order("full_name");
      const mappedClients = (cl || []) as ClientOption[];
      setClients(mappedClients);

      // Locations
      let locs: BusinessLocation[] = [];
      try {
        const { data: locData } = await supabase.from('business_locations').select('id, name').order('name');
        locs = (locData || []) as any;
      } catch {
        locs = [];
      }
      setLocations(locs);

      // Completed job cards without receipts
      let jobs: JobCardOption[] = [];
      try {
        const { data: jobData } = await supabase
          .from('job_cards')
          .select('id, job_number, client_id, location_id, status')
          .eq('status', 'completed')
          .order('created_at', { ascending: false });
        const allJobs = (jobData || []).map((j: any) => ({ id: j.id, job_number: j.job_number, client_id: j.client_id || null, location_id: (j as any).location_id || null }));
        const jobIds = allJobs.map(j => j.id);
        if (jobIds.length > 0) {
          try {
            const { data: recs } = await supabase.from('receipts').select('job_card_id').in('job_card_id', jobIds);
            const withReceipts = new Set<string>((recs || []).map((r: any) => r.job_card_id).filter(Boolean));
            jobs = allJobs.filter(j => !withReceipts.has(j.id));
          } catch {
            jobs = allJobs; // fallback: show all completed
          }
        } else {
          jobs = [];
        }
      } catch {
        jobs = [];
      }
      setJobCards(jobs);

      return { services: mappedServices, staff: mappedStaff, clients: mappedClients, locations: locs, jobCards: jobs };
    } catch (e) {
      console.error(e);
      return { services: [], staff: [], clients: [], locations: [], jobCards: [] };
    }
  }, []);

  const loadExisting = useCallback(async (id: string, servicesList: ServiceOption[]) => {
    try {
      const { getReceiptByIdWithFallback, getReceiptItemsWithFallback } = await import("@/utils/mockDatabase");
      const r = await getReceiptByIdWithFallback(supabase, id);
      if (!r) throw new Error("Receipt not found");
      setReceiptNumber(r.receipt_number || "");
      setStatus(r.status || "open");
      setCustomerId(r.customer_id || "");
      setNotes(r.notes || "");
      setTaxAmount(Number(r.tax_amount || 0));
      setDiscountAmount(Number(r.discount_amount || 0));
      setLocationId((r as any).location_id || "");
      setJobCardId((r as any).job_card_id || "");
      const existingItems = await getReceiptItemsWithFallback(supabase, id);
      setItems((existingItems || []).map((it: any, idx: number) => {
        const svc = servicesList.find(s => s.id === it.service_id);
        const commissionPct = (it.commission_percentage ?? (svc?.commission_percentage ?? 0)) as number;
        return {
          id: it.id || `line_${idx}`,
          service_id: it.service_id || null,
          description: it.description || "Service",
          quantity: Number(it.quantity || 1),
          unit_price: Number(it.unit_price || 0),
          total_price: Number(it.total_price || (Number(it.quantity || 1) * Number(it.unit_price || 0))),
          staff_id: it.staff_id || null,
          commission_percentage: Number(commissionPct || 0),
        } as LineItem;
      }));
    } catch (e) {
      console.error(e);
      toast.error("Failed to load receipt");
    }
  }, []);

  const prefillFromJobCard = useCallback(async (jcId: string) => {
    try {
      // Load job card basic info
      const { data: jc } = await supabase
        .from('job_cards')
        .select('id, client_id, location_id')
        .eq('id', jcId)
        .maybeSingle();
      if (jc) {
        setCustomerId(jc.client_id || "");
        setLocationId((jc as any).location_id || "");
      }

      // Load job card services with joins for names and commission
      const { data: jcs } = await supabase
        .from('job_card_services')
        .select('service_id, staff_id, quantity, unit_price, commission_percentage, services:service_id(name, commission_percentage)')
        .eq('job_card_id', jcId);

      const mapped: LineItem[] = (jcs || []).map((row: any, idx: number) => {
        const qty = Number(row.quantity || 1);
        const price = Number(row.unit_price || 0);
        const svcName = Array.isArray(row.services) ? row.services[0]?.name : row.services?.name;
        const svcComm = Array.isArray(row.services) ? row.services[0]?.commission_percentage : row.services?.commission_percentage;
        const commissionPct = typeof row.commission_percentage === 'number' ? row.commission_percentage : (typeof svcComm === 'number' ? svcComm : 0);
        return {
          id: `line_${Date.now()}_${idx}`,
          service_id: row.service_id || null,
          description: svcName || 'Service',
          quantity: qty,
          unit_price: price,
          total_price: Number((qty * price).toFixed(2)),
          staff_id: row.staff_id || null,
          commission_percentage: Number(commissionPct || 0),
        };
      });

      if (mapped.length > 0) setItems(mapped);
    } catch (e) {
      console.error('Failed to prefill from job card', e);
      toast.error('Failed to load job card details');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      const { services: loadedServices } = await loadOptions();
      if (!isMounted) return;
      if (isEdit && params.id) {
        await loadExisting(params.id, loadedServices);
      } else {
        // Initialize with one blank line
        setItems([
          {
            id: `line_${Date.now()}`,
            service_id: null,
            description: "",
            quantity: 1,
            unit_price: 0,
            total_price: 0,
            staff_id: null,
            commission_percentage: 0,
          },
        ]);
      }
      if (isMounted) setLoading(false);
    })();
    return () => { isMounted = false; };
  }, [isEdit, params.id, loadOptions, loadExisting]);

  const handleServiceChange = (lineId: string, serviceId: string) => {
    setItems(prev => prev.map(li => {
      if (li.id !== lineId) return li;
      const svc = services.find(s => s.id === serviceId);
      const price = Number(svc?.price || 0);
      const commissionPct = Number(svc?.commission_percentage || 0);
      const quantity = Number(li.quantity || 1);
      return {
        ...li,
        service_id: serviceId,
        description: svc?.name || li.description,
        unit_price: price,
        quantity,
        total_price: Number((quantity * price).toFixed(2)),
        commission_percentage: commissionPct,
      };
    }));
  };

  const handleQuantityChange = (lineId: string, value: string) => {
    const qty = Math.max(1, parseInt(value || "1", 10));
    setItems(prev => prev.map(li => li.id === lineId ? { ...li, quantity: qty, total_price: Number((qty * Number(li.unit_price || 0)).toFixed(2)) } : li));
  };

  const handleUnitPriceChange = (lineId: string, value: string) => {
    const price = Number(value || 0);
    setItems(prev => prev.map(li => li.id === lineId ? { ...li, unit_price: price, total_price: Number((Number(li.quantity || 1) * price).toFixed(2)) } : li));
  };

  const handleStaffChange = (lineId: string, staffId: string) => {
    setItems(prev => prev.map(li => li.id === lineId ? { ...li, staff_id: staffId } : li));
  };

  const handleSelectJobCard = async (id: string) => {
    setJobCardId(id);
    await prefillFromJobCard(id);
  };

  const addLine = () => {
    setItems(prev => ([
      ...prev,
      {
        id: `line_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
        service_id: null,
        description: "",
        quantity: 1,
        unit_price: 0,
        total_price: 0,
        staff_id: null,
        commission_percentage: 0,
      },
    ]));
  };

  const removeLine = (lineId: string) => {
    setItems(prev => prev.filter(li => li.id !== lineId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { toast.error("Add at least one service"); return; }
    try {
      setSaving(true);
      const payload = {
        receipt_number: receiptNumber || `RC-${Date.now()}`,
        customer_id: customerId || null,
        job_card_id: jobCardId || null,
        subtotal: subtotal,
        tax_amount: Number(taxAmount || 0),
        discount_amount: Number(discountAmount || 0),
        total_amount: total,
        status: status || 'open',
        notes: notes || null,
        location_id: locationId || null,
      };

      const linePayload = items.map(it => ({
        description: it.description || (services.find(s => s.id === it.service_id)?.name || 'Service'),
        quantity: Number(it.quantity || 1),
        unit_price: Number(it.unit_price || 0),
        total_price: Number(it.total_price || (Number(it.quantity || 1) * Number(it.unit_price || 0))),
        service_id: it.service_id || null,
        product_id: null,
        staff_id: it.staff_id || null,
        commission_percentage: Number(it.commission_percentage || 0),
      }));

      if (!isEdit) {
        const { createReceiptWithFallback } = await import("@/utils/mockDatabase");
        const created = await createReceiptWithFallback(supabase as any, payload, linePayload);
        toast.success("Sales receipt created");
        navigate(`/receipts/${(created as any)?.id}`);
      } else if (params.id) {
        const { updateReceiptWithFallback } = await import("@/utils/mockDatabase");
        await updateReceiptWithFallback(supabase as any, params.id, payload);
        // Replace items: try DB first, fallback to local
        try {
          await supabase.from('receipt_items').delete().eq('receipt_id', params.id);
          if (linePayload.length > 0) {
            const dbItems = linePayload.map(li => ({
              receipt_id: params.id,
              description: li.description,
              quantity: li.quantity,
              unit_price: li.unit_price,
              total_price: li.total_price,
              service_id: li.service_id,
              product_id: null,
              staff_id: li.staff_id,
            }));
            await supabase.from('receipt_items').insert(dbItems as any);
          }
        } catch (dbErr) {
          // Local fallback
          try {
            const stored = JSON.parse(localStorage.getItem('mockDb') || '{}');
            stored.receipt_items = (stored.receipt_items || []).filter((x: any) => x.receipt_id !== params.id);
            const nowIso = new Date().toISOString();
            for (const it of linePayload) {
              stored.receipt_items.push({
                id: `ritem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                receipt_id: params.id,
                service_id: it.service_id || null,
                product_id: null,
                description: it.description,
                quantity: it.quantity,
                unit_price: it.unit_price,
                total_price: it.total_price,
                staff_id: it.staff_id || null,
                created_at: nowIso,
                updated_at: nowIso,
              });
            }
            localStorage.setItem('mockDb', JSON.stringify(stored));
          } catch (e) {
            console.error('Local fallback failed to update items', e);
          }
        }
        toast.success("Sales receipt updated");
        navigate(`/receipts/${params.id}`);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to save receipt');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-xl font-semibold">{isEdit ? 'Edit Sales Receipt' : 'Create Sales Receipt'}</div>
          <div className="text-sm text-muted-foreground">Select services to auto-fill pricing and commission, and assign staff per line.</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Sales Receipt Number</Label>
            <Input value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} placeholder="Auto or manual" />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <select className="border rounded px-3 py-2 w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="open">Open</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Customer</Label>
            <Select value={customerId || ""} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer (optional)" />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Select value={locationId || ""} onValueChange={setLocationId}>
              <SelectTrigger>
                <SelectValue placeholder={locations.length ? 'Select location' : 'No locations'} />
              </SelectTrigger>
              <SelectContent>
                {locations.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Job Card</Label>
            <Select value={jobCardId || ""} onValueChange={handleSelectJobCard}>
              <SelectTrigger>
                <SelectValue placeholder={jobCards.length ? 'Select completed job card' : 'No completed job cards'} />
              </SelectTrigger>
              <SelectContent>
                {jobCards.map(j => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.job_number} {(() => { const c = clients.find(x => x.id === j.client_id); return c ? `• ${c.full_name}` : ''; })()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">Selecting a completed job card will prefill services, staff and commissions.</div>
          </div>
          <div className="space-y-2">
            <Label>Tax</Label>
            <div className="flex items-center gap-2">
              <Input type="number" step="0.01" value={taxAmount} onChange={(e) => { setTaxAmount(Number(e.target.value || 0)); setApplyTax(false); }} />
              <label className="flex items-center gap-1 text-sm text-muted-foreground">
                <input type="checkbox" className="h-4 w-4" checked={applyTax} onChange={(e) => setApplyTax(e.target.checked)} />
                Apply org tax ({typeof orgTaxRate === 'number' ? `${orgTaxRate}%` : '—'})
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Discount</Label>
            <Input type="number" step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(Number(e.target.value || 0))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Services</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Service</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Commission %</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      <Select value={it.service_id || ""} onValueChange={(val) => handleServiceChange(it.id, val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select service" />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {it.description && (
                        <div className="text-xs text-muted-foreground mt-1">{it.description}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select value={it.staff_id || ""} onValueChange={(val) => handleStaffChange(it.id, val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Assign staff" />
                        </SelectTrigger>
                        <SelectContent>
                          {staff.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input type="number" min={1} value={it.quantity} onChange={(e) => handleQuantityChange(it.id, e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" value={it.unit_price} onChange={(e) => handleUnitPriceChange(it.id, e.target.value)} />
                    </TableCell>
                    <TableCell className="font-medium">{formatMoney(Number(it.total_price || 0))}</TableCell>
                    <TableCell>{Number(it.commission_percentage || 0).toFixed(2)}%</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => removeLine(it.id)}>Remove</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button variant="outline" onClick={addLine}>Add Service</Button>
        </CardContent>
      </Card>

      <Card className="bg-slate-50">
        <CardContent className="p-4">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span className="font-semibold">{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax:</span>
                <span className="font-semibold">{formatMoney(Number(taxAmount || 0))}</span>
              </div>
              {Number(discountAmount || 0) > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Discount:</span>
                  <span className="font-semibold">-{formatMoney(Number(discountAmount || 0))}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-violet-600">{formatMoney(total)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
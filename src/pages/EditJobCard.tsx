import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/lib/saas/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
// import { Receipt } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Staff {
  id: string;
  full_name: string;
  commission_rate?: number | null;
}

interface Client {
  id: string;
  full_name: string;
}

interface JobCardRecord {
  id: string;
  job_number: string;
  client_id: string | null;
  staff_id: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  location_id?: string | null;
}

interface JobServiceRow {
  id: string;
  job_card_id: string;
  service_id: string;
  staff_id: string | null;
  quantity: number;
  unit_price: number;
  commission_percentage?: number | null;
  services?: { id: string; name: string; commission_percentage?: number | null } | null;
  staff?: { id: string; full_name: string; commission_rate?: number | null } | null;
}

function computeCommissionRate(row: JobServiceRow, staffList: Staff[], overrideStaffId?: string | null, overrideCommission?: number | null) {
  if (typeof overrideCommission === 'number' && overrideCommission >= 0) return overrideCommission;
  if (typeof row.commission_percentage === 'number' && row.commission_percentage >= 0) return row.commission_percentage;
  if (typeof row.services?.commission_percentage === 'number' && row.services.commission_percentage >= 0) return row.services.commission_percentage;
  const sid = overrideStaffId ?? row.staff_id;
  const st = staffList.find((s) => s.id === sid);
  if (typeof st?.commission_rate === 'number') return st.commission_rate as number;
  return 0;
}

function computeCommissionAmount(row: JobServiceRow, rate: number) {
  const qty = Number(row.quantity || 1);
  const price = Number(row.unit_price || 0);
  return (qty * price * (Number(rate) || 0)) / 100;
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function toInputDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  // format to YYYY-MM-DDTHH:mm for input[type=datetime-local]
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromInputDateTimeLocal(value: string) {
  // Convert back to ISO string
  return value ? new Date(value).toISOString() : null;
}

export default function EditJobCard() {
  const { id } = useParams<{ id: string }>();
  const { organization } = useOrganization();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [staff, setStaff] = useState<Staff[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const [jobCard, setJobCard] = useState<JobCardRecord | null>(null);

  const [jobServices, setJobServices] = useState<JobServiceRow[]>([]);
  const [serviceEdits, setServiceEdits] = useState<Record<string, { staff_id?: string | null; commission_percentage?: number | null }>>({});
  const [savingServices, setSavingServices] = useState<boolean>(false);

  // Local form state
  const [clientId, setClientId] = useState<string | "">("");
  const [staffId, setStaffId] = useState<string | "">("");
  const [status, setStatus] = useState<string>("in_progress");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<string>("0");
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [locationId, setLocationId] = useState<string>("");
  const [hasReceipt, setHasReceipt] = useState<boolean>(false);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const [staffRes, clientsRes, cardRes] = await Promise.all([
          supabase.from("staff").select("id, full_name, commission_rate").eq("is_active", true),
          supabase.from("clients").select("id, full_name").eq("client_status", "active"),
          supabase
            .from("job_cards")
            .select("id, job_number, client_id, staff_id, start_time, end_time, status, total_amount, created_at, updated_at")
            .eq("id", id)
            .single(),
        ]);
        const { data: locs } = await supabase
          .from('business_locations')
          .select('id, name')
          .eq('organization_id', organization?.id || '')
          .order('name');
        setLocations((locs || []) as any);

        if (staffRes.data) setStaff(staffRes.data);
        if (clientsRes.data) setClients(clientsRes.data);
        if (cardRes.error) throw cardRes.error;
        if (cardRes.data) {
          setJobCard(cardRes.data as JobCardRecord);
          setClientId(cardRes.data.client_id ?? "");
          setStaffId(cardRes.data.staff_id ?? "");
          setStatus(cardRes.data.status ?? "in_progress");
          setStartTime(toInputDateTimeLocal(cardRes.data.start_time));
          setEndTime(toInputDateTimeLocal(cardRes.data.end_time));
          setTotalAmount(String(cardRes.data.total_amount ?? 0));
          setLocationId((cardRes.data as any)?.location_id || "");
        }

        // Load services assigned to this job card
        const { data: jcsData, error: jcsErr } = await supabase
          .from('job_card_services')
          .select(`
            id, job_card_id, service_id, staff_id, quantity, unit_price, commission_percentage,
            services:service_id ( id, name, commission_percentage ),
            staff:staff_id ( id, full_name, commission_rate )
          `)
          .eq('job_card_id', id);
        if (jcsErr) throw jcsErr;
        setJobServices((jcsData || []) as any);

        // Check if a receipt already exists for this job card (fallback aware)
        try {
          const { data: rData, error: rErr } = await supabase
            .from('receipts')
            .select('id')
            .eq('job_card_id', id)
            .limit(1);
          if (rErr) throw rErr;
          setHasReceipt((rData || []).length > 0);
        } catch {
          // receipts feature removed
        }
      } catch (e: any) {
        console.error("Failed to load job card:", e);
        toast.error(e?.message ? `Failed to load: ${e.message}` : "Failed to load job card");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const canSave = useMemo(() => {
    if (!jobCard) return false;
    if (!status) return false;
    if (totalAmount === "" || isNaN(Number(totalAmount))) return false;
    return true;
  }, [jobCard, status, totalAmount]);

// receipts feature removed

  const handleSave = async () => {
    if (!id || !jobCard) return;
    setSaving(true);
    try {
      const normalizedStatus = ['paused', 'overdue', 'pending'].includes(status) ? 'in_progress' : status;
      const payload: any = {
        client_id: clientId || null,
        staff_id: staffId || null,
        status: normalizedStatus,
        total_amount: Number(totalAmount) || 0,
      };

      // Only include times if provided
      if (startTime) payload.start_time = fromInputDateTimeLocal(startTime);
      else payload.start_time = null;

      if (endTime) payload.end_time = fromInputDateTimeLocal(endTime);
      else payload.end_time = null;

      const { error } = await supabase
        .from("job_cards")
        .update(payload)
        .eq("id", id);

      if (error) throw error;
      toast.success("Job card updated");
      navigate("/job-cards");
    } catch (e: any) {
      console.error("Failed to update job card:", e);
      toast.error(e?.message ? `Update failed: ${e.message}` : "Failed to update job card");
    } finally {
      setSaving(false);
    }
  };

  const servicesSubtotal = useMemo(() => {
    return jobServices.reduce((sum, row) => sum + Number(row.quantity || 1) * Number(row.unit_price || 0), 0);
  }, [jobServices]);

  const commissionsTotal = useMemo(() => {
    return jobServices.reduce((sum, row) => {
      const edit = serviceEdits[row.id] || {};
      const rate = computeCommissionRate(row, staff, edit.staff_id ?? undefined, edit.commission_percentage ?? undefined);
      return sum + computeCommissionAmount(row, Number(rate) || 0);
    }, 0);
  }, [jobServices, serviceEdits, staff]);

  const updateServiceEdit = (rowId: string, changes: { staff_id?: string | null; commission_percentage?: number | null }) => {
    setServiceEdits((prev) => ({ ...prev, [rowId]: { ...prev[rowId], ...changes } }));
  };

  const handleSaveServices = async () => {
    if (jobServices.length === 0) return;
    setSavingServices(true);
    try {
      const updates = Object.entries(serviceEdits).map(([rowId, changes]) => ({ rowId, changes }));
      if (updates.length === 0) {
        toast.info('No service changes to save');
        return;
      }
      await Promise.all(
        updates.map(async ({ rowId, changes }) => {
          const payload: any = {};
          if (typeof changes.staff_id !== 'undefined') payload.staff_id = changes.staff_id;
          if (typeof changes.commission_percentage !== 'undefined' && changes.commission_percentage !== null) payload.commission_percentage = changes.commission_percentage;
          if (Object.keys(payload).length === 0) return;
          const { error } = await supabase.from('job_card_services').update(payload).eq('id', rowId);
          if (error) throw error;
        })
      );
      // Reload rows after save
      const { data: jcsData } = await supabase
        .from('job_card_services')
        .select(`
          id, job_card_id, service_id, staff_id, quantity, unit_price, commission_percentage,
          services:service_id ( id, name, commission_percentage ),
          staff:staff_id ( id, full_name, commission_rate )
        `)
        .eq('job_card_id', id);
      setJobServices((jcsData || []) as any);
      setServiceEdits({});
      toast.success('Service changes saved');
    } catch (e: any) {
      console.error('Failed to save service changes:', e);
      toast.error(e?.message || 'Failed to save service changes');
    } finally {
      setSavingServices(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!jobCard) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">Job card not found.</p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="w-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Edit Job Card</h1>
          <p className="text-sm text-muted-foreground mt-1">Update client, staff, times, and status</p>
        </div>
        <div className="text-sm text-muted-foreground">#{jobCard.job_number}</div>
      </div>

      <Card>
        <CardHeader className="bg-gradient-to-r from-accent/30 to-accent/10">
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={(v) => setClientId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Staff</Label>
              <Select value={staffId} onValueChange={(v) => setStaffId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={locationId} onValueChange={(v) => setLocationId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder={locations.length ? 'Select location' : 'No locations'} />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Total Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
              />
              <div className="text-xs text-muted-foreground">Services subtotal: {servicesSubtotal.toFixed(2)} · Estimated commissions: {commissionsTotal.toFixed(2)}</div>
            </div>
          </div>

          <Separator />

          <Card className="border">
            <CardHeader>
              <CardTitle>Services & Commissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Assigned Staff</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                      <TableHead className="text-right">Commission %</TableHead>
                      <TableHead className="text-right">Commission Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobServices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">No services assigned</TableCell>
                      </TableRow>
                    ) : (
                      jobServices.map((row) => {
                        const edit = serviceEdits[row.id] || {};
                        const currentStaffId = typeof edit.staff_id !== 'undefined' ? edit.staff_id : row.staff_id || '';
                        const rate = computeCommissionRate(row, staff, edit.staff_id ?? undefined, edit.commission_percentage ?? undefined);
                        const commissionDue = computeCommissionAmount(row, Number(rate) || 0);
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.services?.name || 'Service'}</TableCell>
                            <TableCell>
                              <Select value={(currentStaffId || '') === '' ? '__none__' : currentStaffId} onValueChange={(v) => updateServiceEdit(row.id, { staff_id: v === '__none__' ? null : v })}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select staff" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">—</SelectItem>
                                  {staff.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right">{Number(row.quantity || 1)}</TableCell>
                            <TableCell className="text-right">{Number(row.unit_price || 0).toFixed(2)}</TableCell>
                            <TableCell className="text-right">{(Number(row.quantity || 1) * Number(row.unit_price || 0)).toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                className="w-24 text-right"
                                type="number"
                                step="0.01"
                                value={
                                  typeof edit.commission_percentage === 'number'
                                    ? String(edit.commission_percentage)
                                    : String(
                                        typeof row.commission_percentage === 'number' && row.commission_percentage !== null
                                          ? row.commission_percentage
                                          : typeof row.services?.commission_percentage === 'number'
                                          ? row.services?.commission_percentage
                                          : ''
                                      )
                                }
                                placeholder={String(rate)}
                                onChange={(e) => updateServiceEdit(row.id, { commission_percentage: e.target.value === '' ? null : Number(e.target.value) })}
                              />
                            </TableCell>
                            <TableCell className="text-right">{Number(commissionDue || 0).toFixed(2)}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                    {jobServices.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={4}></TableCell>
                        <TableCell className="text-right font-medium">{servicesSubtotal.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">Total</TableCell>
                        <TableCell className="text-right font-medium">{commissionsTotal.toFixed(2)}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-end gap-3 mt-4">
                <Button variant="outline" onClick={handleSaveServices} disabled={savingServices || Object.keys(serviceEdits).length === 0}>
                  {savingServices ? 'Saving…' : 'Save Service Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => navigate(-1)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={!canSave || saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface Staff {
  id: string;
  full_name: string;
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
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [staff, setStaff] = useState<Staff[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const [jobCard, setJobCard] = useState<JobCardRecord | null>(null);

  // Local form state
  const [clientId, setClientId] = useState<string | "">("");
  const [staffId, setStaffId] = useState<string | "">("");
  const [status, setStatus] = useState<string>("in_progress");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<string>("0");

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const [staffRes, clientsRes, cardRes] = await Promise.all([
          supabase.from("staff").select("id, full_name").eq("is_active", true),
          supabase.from("clients").select("id, full_name").eq("client_status", "active"),
          supabase
            .from("job_cards")
            .select("id, job_number, client_id, staff_id, start_time, end_time, status, total_amount, created_at, updated_at")
            .eq("id", id)
            .single(),
        ]);

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

  const handleSave = async () => {
    if (!id || !jobCard) return;
    setSaving(true);
    try {
      const payload: any = {
        client_id: clientId || null,
        staff_id: staffId || null,
        status,
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
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit Job Card</h1>
        <div className="text-sm text-muted-foreground">#{jobCard.job_number}</div>
      </div>

      <Card>
        <CardHeader>
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
            </div>
          </div>

          <Separator />

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
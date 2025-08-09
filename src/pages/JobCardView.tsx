import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Calendar, Clock, User, DollarSign, Pencil, ArrowLeft } from "lucide-react";

interface JobCardRecord {
  id: string;
  job_number: string;
  client_id: string | null;
  staff_id: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  total_amount: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

interface Party {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
}

export default function JobCardView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<JobCardRecord | null>(null);
  const [client, setClient] = useState<Party | null>(null);
  const [staff, setStaff] = useState<Party | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const { data: jc, error } = await supabase
          .from("job_cards")
          .select("*")
          .eq("id", id)
          .single();
        if (error) throw error;
        setCard(jc as any);
        if (jc?.client_id) {
          const { data: cli } = await supabase
            .from("clients")
            .select("id, full_name, email, phone")
            .eq("id", jc.client_id)
            .maybeSingle();
          if (cli) setClient(cli as any);
        }
        if (jc?.staff_id) {
          const { data: st } = await supabase
            .from("staff")
            .select("id, full_name, email, phone")
            .eq("id", jc.staff_id)
            .maybeSingle();
          if (st) setStaff(st as any);
        }
      } catch (e: any) {
        console.error("Failed to load job card:", e);
        toast.error(e?.message || "Failed to load job card");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">Job card not found.</p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Job Card</h1>
          <div className="text-sm text-muted-foreground">#{card.job_number}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button onClick={() => navigate(`/job-cards/${card.id}/edit`)}>
            <Pencil className="w-4 h-4 mr-2" /> Edit
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4" />
              <span>Start: {card.start_time ? new Date(card.start_time).toLocaleString() : '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4" />
              <span>End: {card.end_time ? new Date(card.end_time).toLocaleString() : '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4" />
              <span>Client: {client?.full_name || '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4" />
              <span>Staff: {staff?.full_name || '—'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline">Status: {card.status}</Badge>
            <div className="flex items-center gap-1 text-sm">
              <DollarSign className="w-4 h-4" />
              <span>{Number(card.total_amount || 0).toFixed(2)}</span>
            </div>
          </div>

          {card.notes && (
            <>
              <Separator />
              <div>
                <div className="text-sm font-medium mb-1">Notes</div>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {card.notes}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
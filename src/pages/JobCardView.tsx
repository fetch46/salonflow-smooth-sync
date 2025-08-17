import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  User,
  DollarSign,
  Pencil,
  ArrowLeft,
  Download,
  ClipboardList,
    Package,
  FileText,
 } from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

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
  email?: string | null;
  phone?: string | null;
}

interface ServiceItem {
  id: string;
  service_id: string;
  staff_id: string | null;
  quantity: number;
  unit_price: number;
  services?: { name: string } | null;
  staff?: { id: string; full_name: string } | null;
}

interface ProductUsageItem {
  id: string;
  inventory_item_id: string;
  quantity_used: number;
  unit_cost: number;
  total_cost: number;
  inventory_items?: { id: string; name: string; unit?: string | null } | null;
}

export default function JobCardView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<JobCardRecord | null>(null);
  const [client, setClient] = useState<Party | null>(null);
  const [staff, setStaff] = useState<Party | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [products, setProducts] = useState<ProductUsageItem[]>([]);

  const pdfRef = useRef<HTMLDivElement>(null);

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

        // Load linked parties
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

        // Load services on this job card
        const { data: svcData, error: svcErr } = await supabase
          .from("job_card_services")
          .select(
            `id, service_id, staff_id, quantity, unit_price,
             services:service_id ( name ),
             staff:staff_id ( id, full_name )`
          )
          .eq("job_card_id", id);
        if (svcErr) throw svcErr;
        setServices((svcData || []) as any);

        // Load product usage on this job card
        const { data: prodData } = await supabase
          .from("job_card_products")
          .select(
            `id, inventory_item_id, quantity_used, unit_cost, total_cost,
             inventory_items:inventory_item_id ( id, name, unit )`
          )
          .eq("job_card_id", id);
        setProducts((prodData || []) as any);
      } catch (e: any) {
        console.error("Failed to load job card:", e);
        toast.error(e?.message || "Failed to load job card");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const parsedNotes = useMemo(() => {
    if (!card?.notes) return null;
    try {
      return typeof card.notes === "string" ? JSON.parse(card.notes) : card.notes;
    } catch {
      return null;
    }
  }, [card?.notes]);

  const servicesSubtotal = useMemo(() => {
    return services.reduce((sum, s) => sum + (s.quantity || 0) * (s.unit_price || 0), 0);
  }, [services]);

  const productsSubtotal = useMemo(() => {
    return products.reduce((sum, p) => sum + (p.total_cost || 0), 0);
  }, [products]);

  const handleExportPDF = async () => {
    try {
      const element = pdfRef.current;
      if (!element) return;
      

      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        windowWidth: element.scrollWidth,
      });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "pt", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;

      while (heightLeft > 0) {
        pdf.addPage();
        position = margin - (imgHeight - heightLeft);
        pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - margin * 2;
      }

      pdf.save(`${card?.job_number || "job-card"}.pdf`);
    } catch (e: any) {
      console.error("Failed to export PDF", e);
      toast.error(e?.message || "Failed to export PDF");
    }
  };

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
        <Button className="mt-4" variant="secondary" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Job Card</h1>
          <div className="text-sm text-muted-foreground">#{card.job_number}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-2" /> Export PDF
          </Button>
          <Button variant="outline" onClick={() => navigate(`/invoices?fromJobCard=${card.id}`)}>
            <FileText className="w-4 h-4 mr-2" /> Create Invoice
          </Button>
          <Button onClick={() => navigate(`/job-cards/${card.id}/edit`)}>
            <Pencil className="w-4 h-4 mr-2" /> Edit
          </Button>
        </div>
      </div>

      <div ref={pdfRef} className="space-y-6 bg-background">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4" />
                <span>
                  Start: {card.start_time ? new Date(card.start_time).toLocaleString() : "—"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4" />
                <span>End: {card.end_time ? new Date(card.end_time).toLocaleString() : "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4" />
                <span>Total: {Number(card.total_amount || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4" />
                <span>Client: {client?.full_name || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4" />
                <span>Primary Staff: {staff?.full_name || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline">Status: {card.status}</Badge>
              </div>
            </div>

            {parsedNotes && (
              <div className="pt-2">
                <Separator className="my-2" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  {parsedNotes.technicianType && (
                    <div>
                      <div className="font-medium">Technician Type</div>
                      <div className="text-muted-foreground capitalize">{parsedNotes.technicianType}</div>
                    </div>
                  )}
                  {parsedNotes.preferredStyle && (
                    <div>
                      <div className="font-medium">Preferred Style</div>
                      <div className="text-muted-foreground">{parsedNotes.preferredStyle}</div>
                    </div>
                  )}
                  {parsedNotes.allergies && (
                    <div className="md:col-span-3">
                      <div className="font-medium">Allergies / Sensitivities</div>
                      <div className="text-muted-foreground whitespace-pre-wrap">
                        {parsedNotes.allergies}
                      </div>
                    </div>
                  )}
                  {parsedNotes.specialConcerns && (
                    <div className="md:col-span-3">
                      <div className="font-medium">Special Concerns</div>
                      <div className="text-muted-foreground whitespace-pre-wrap">
                        {parsedNotes.specialConcerns}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" /> Services Performed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Assigned Staff</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No services recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    services.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.services?.name || "Service"}</TableCell>
                        <TableCell>{s.staff?.full_name || "—"}</TableCell>
                        <TableCell className="text-right">{s.quantity || 1}</TableCell>
                        <TableCell className="text-right">{Number(s.unit_price || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          {Number((s.quantity || 1) * (s.unit_price || 0)).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {services.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-right font-medium">
                        Subtotal
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {servicesSubtotal.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" /> Products / Materials Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No products recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {p.inventory_items?.name || "Item"}
                          {p.inventory_items?.unit ? (
                            <span className="text-xs text-muted-foreground ml-2">({p.inventory_items.unit})</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">{p.quantity_used}</TableCell>
                        <TableCell className="text-right">{Number(p.unit_cost || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right">{Number(p.total_cost || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  {products.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-medium">
                        Subtotal
                      </TableCell>
                      <TableCell className="text-right font-medium">{productsSubtotal.toFixed(2)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {parsedNotes?.technicianNotes || parsedNotes?.clientFeedback ? (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {parsedNotes?.technicianNotes && (
                <div>
                  <div className="text-sm font-medium mb-1">Technician Notes</div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {parsedNotes.technicianNotes}
                  </div>
                </div>
              )}
              {parsedNotes?.clientFeedback && (
                <div>
                  <div className="text-sm font-medium mb-1">Client Feedback</div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {parsedNotes.clientFeedback}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
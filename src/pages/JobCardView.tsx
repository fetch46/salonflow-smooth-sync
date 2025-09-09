import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import JobCardStatusManager from "@/components/JobCardStatusManager";
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
import { usePermissions } from "@/lib/saas/hooks";
import { useRegionalSettings } from "@/hooks/useRegionalSettings";

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
  const { canPerformAction } = usePermissions();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<JobCardRecord | null>(null);
  const [client, setClient] = useState<Party | null>(null);
  const [staff, setStaff] = useState<Party | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [products, setProducts] = useState<ProductUsageItem[]>([]);
  const [invoice, setInvoice] = useState<any | null>(null);

  const pdfRef = useRef<HTMLDivElement>(null);
  const { formatCurrency } = useRegionalSettings();

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

        // Load associated invoice (by jobcard_id or jobcard_reference)
        try {
          const { data: invById } = await supabase
            .from('invoices')
            .select('*')
            .eq('jobcard_id', id)
            .order('created_at', { ascending: false })
            .limit(1);
          let found = invById && invById.length ? invById[0] : null;

          if (!found) {
            const { data: invByRef } = await supabase
              .from('invoices')
              .select('*')
              .eq('jobcard_reference', id)
              .order('created_at', { ascending: false })
              .limit(1);
            found = invByRef && invByRef.length ? invByRef[0] : null;
          }
          setInvoice(found as any);
        } catch (invErr) {
          console.warn('Failed to load linked invoice', invErr);
          setInvoice(null);
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
    <div className="w-full max-w-[1600px] 2xl:max-w-[1760px] mx-auto px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 py-4 space-y-5">
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 lg:gap-6 xl:gap-8">
        <div className="lg:col-span-9 xl:col-span-9 2xl:col-span-10">
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
                <span>Total: {Number(card.total_amount || 0)}</span>
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
                <JobCardStatusManager 
                  jobCardId={card.id} 
                  currentStatus={card.status} 
                  hideStatic
                  onStatusChange={(newStatus) => setCard(prev => prev ? {...prev, status: newStatus} : null)}
                />
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
                          {Number((s.quantity || 1) * (s.unit_price || 0))}
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
                        {servicesSubtotal}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {canPerformAction('view', 'material_costs') && (
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
                          <TableCell className="text-right">{Number(p.unit_cost || 0)}</TableCell>
                          <TableCell className="text-right">{Number(p.total_cost || 0)}</TableCell>
                        </TableRow>
                      ))
                    )}
                    {products.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-right font-medium">
                          Subtotal
                        </TableCell>
                        <TableCell className="text-right font-medium">{productsSubtotal}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

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
        <div className="lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" /> Invoice
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!invoice ? (
                <div className="text-sm text-muted-foreground">
                  No invoice linked. You can create one from the top right.
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Invoice #</span>
                    <span className="font-medium">{invoice.invoice_number}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize bg-secondary text-secondary-foreground">
                      {invoice.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold">{formatCurrency(Number(invoice.total_amount || 0))}</span>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Customer</span>
                      <span className="font-medium">{invoice.customer_name || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-medium">{invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : '—'}</span>
                    </div>
                    {invoice.due_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Due</span>
                        <span className="font-medium">{new Date(invoice.due_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  <div className="pt-2 flex gap-2">
                    <Button variant="outline" className="w-full" onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>
                      View / Edit
                    </Button>
                    <Button className="w-full" onClick={() => navigate(`/payments/received/new?invoiceId=${invoice.id}`)}>
                      Record Payment
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
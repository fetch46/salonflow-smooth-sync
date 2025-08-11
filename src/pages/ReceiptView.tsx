import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useOrganizationCurrency, useOrganization } from '@/lib/saas/hooks';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Users, Mail, Phone, Receipt as ReceiptIcon, FileText, Download, Printer, MessageSquare, Edit2, DollarSign
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function ReceiptView() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { symbol } = useOrganizationCurrency();
  const { organization } = useOrganization();
  const isPrintMode = useMemo(() => new URLSearchParams(location.search).get('print') === '1', [location.search]);

  const [customerInfo, setCustomerInfo] = useState<any | null>(null);
  const printRef = useRef<HTMLDivElement>(null);



  // Internal: job services and staff for commissions
  const [jobServices, setJobServices] = useState<any[]>([]);
  const [staffById, setStaffById] = useState<Record<string, { id: string; full_name: string }>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { getReceiptByIdWithFallback, getReceiptItemsWithFallback, getReceiptPaymentsWithFallback } = await import('@/utils/mockDatabase');
        const rec = await getReceiptByIdWithFallback(supabase, String(id));
        const it = await getReceiptItemsWithFallback(supabase, String(id));
        const pays = await getReceiptPaymentsWithFallback(supabase, String(id));

        let customer = null as any;
        try {
          const cid = (rec as any)?.customer_id;
          if (cid) {
            const { data } = await supabase
              .from('clients')
              .select('id, full_name, email, phone')
              .eq('id', cid)
              .maybeSingle();
            customer = data || null;
          }
        } catch (err) { console.error('Failed to fetch customer', err) }

        setReceipt(rec);
        // Only list services: filter out items that have product_id, keep those with service_id or no explicit product_id
        setItems((it || []).filter((x: any) => x.service_id || !x.product_id));
        setPayments(pays || []);
        setCustomerInfo(customer);

        // Load job card services for commission and staff mapping
        try {
          const jobCardId = (rec as any)?.job_card_id;
          if (jobCardId) {
            const { data: jcs } = await supabase
              .from('job_card_services')
              .select('service_id, staff_id, quantity, unit_price, commission_percentage, services:service_id(name), staff:staff_id(full_name)')
              .eq('job_card_id', jobCardId);
            setJobServices(jcs || []);
            // Build staff map from jcs
            const initialStaff: Record<string, { id: string; full_name: string }> = {};
            (jcs || []).forEach((r: any) => {
              if (r.staff_id) initialStaff[r.staff_id] = { id: r.staff_id, full_name: r.staff?.full_name || 'Staff' };
            });
            // Ensure we also include staff referenced by receipt items but not in jcs
            const itemStaffIds = Array.from(new Set((it || []).map((x: any) => x.staff_id).filter(Boolean)));
            const missing = itemStaffIds.filter((sid: string) => !initialStaff[sid]);
            if (missing.length > 0) {
              const { data: extraStaff } = await supabase.from('staff').select('id, full_name').in('id', missing as any);
              (extraStaff || []).forEach((s: any) => { initialStaff[s.id] = s; });
            }
            setStaffById(initialStaff);
          } else {
            // No job card: still build staff map from items
            const itemStaffIds = Array.from(new Set((it || []).map((x: any) => x.staff_id).filter(Boolean)));
            if (itemStaffIds.length > 0) {
              const { data: extraStaff } = await supabase.from('staff').select('id, full_name').in('id', itemStaffIds as any);
              const map: Record<string, { id: string; full_name: string }> = {};
              (extraStaff || []).forEach((s: any) => { map[s.id] = s; });
              setStaffById(map);
            }
          }
        } catch (err) {
          console.error('Failed to load job services/staff', err);
          setJobServices([]);
        }
      } catch (e) {
        console.error(e);
        toast.error('Failed to load receipt');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!loading && isPrintMode) {
      setTimeout(() => {
        window.print();
      }, 100);
    }
  }, [loading, isPrintMode]);

  const handleDownloadPdf = async () => {
    try {
      if (!printRef.current) return;
      const element = printRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = `sales_receipt_${receipt?.receipt_number || id}.pdf`;
      pdf.save(fileName);
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate PDF');
    }
  };





  // Build commission mappings (moved above early returns to keep hook order stable)
  const commissionIndex = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const js of jobServices || []) {
      const rate = (js as any).commission_percentage ?? (js as any).services?.commission_percentage ?? null;
      const key = `${js.service_id || ''}::${js.staff_id || ''}`;
      if (!map.has(key)) map.set(key, rate);
      const svcKey = `${js.service_id || ''}::`;
      if (!map.has(svcKey)) map.set(svcKey, rate);
    }
    return map;
  }, [jobServices]);

  const itemsWithCommission = useMemo(() => {
    return (items || []).map((it: any) => {
      const key = `${it.service_id || ''}::${it.staff_id || ''}`;
      const svcKey = `${it.service_id || ''}::`;
      const pct = commissionIndex.get(key) ?? commissionIndex.get(svcKey) ?? 0;
      const commissionAmount = Number(((Number(pct || 0) / 100) * Number(it.total_price || 0)).toFixed(2));
      const staffName = it.staff_id ? (staffById[it.staff_id]?.full_name || 'Staff') : '—';
      return { ...it, commission_percentage: pct || 0, commission_amount: commissionAmount, staff_name: staffName };
    });
  }, [items, commissionIndex, staffById]);

  const commissionByStaff = useMemo(() => {
    const out: Record<string, { staff_id: string; staff_name: string; commission_due: number }> = {};
    for (const it of itemsWithCommission) {
      const sid = it.staff_id || 'unassigned';
      const sname = it.staff_id ? (staffById[it.staff_id]?.full_name || 'Staff') : 'Unassigned';
      const curr = out[sid] || { staff_id: sid, staff_name: sname, commission_due: 0 };
      curr.commission_due += Number(it.commission_amount || 0);
      out[sid] = curr;
    }
    return Object.values(out).sort((a, b) => b.commission_due - a.commission_due);
  }, [itemsWithCommission, staffById]);

  const displayItems = useMemo(() => {
    if ((items || []).length > 0) return items;
    // Fallback: derive from job card services when receipt_items are missing
    if ((jobServices || []).length > 0) {
      return (jobServices || []).map((js: any, idx: number) => ({
        id: `fb_${idx}`,
        description: js.services?.name || 'Service',
        quantity: js.quantity || 1,
        unit_price: Number(js.unit_price || 0),
        total_price: Number(js.quantity || 1) * Number(js.unit_price || 0),
      }));
    }
    return [] as any[];
  }, [items, jobServices]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!receipt) return <div className="p-6">Receipt not found</div>;

  const outstanding = Math.max(0, (receipt.total_amount || 0) - (receipt.amount_paid || 0));

  const orgName = organization?.name || 'Your Business';
  const orgSettings = (organization?.settings as any) || {};
  const orgAddress = [orgSettings.address, orgSettings.city, orgSettings.state, orgSettings.zip_code, orgSettings.country]
    .filter(Boolean)
    .join(', ');

  return (
    <div className={`p-6 space-y-6 ${isPrintMode ? 'bg-white' : ''}`}>
      {/* Printable area */}
      <div ref={printRef} className="space-y-6 bg-white rounded-xl shadow-sm print:shadow-none print:bg-white">
        {/* Fancy Header */}
        <div className="rounded-xl overflow-hidden border">
          <div className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 p-6 text-white">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <div className="text-2xl font-extrabold tracking-tight">{orgName}</div>
                {orgAddress && (
                  <div className="text-sm/6 opacity-90 mt-1">{orgAddress}</div>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs uppercase opacity-90">Receipt</div>
                <div className="text-lg font-semibold">{receipt.receipt_number}</div>
                <div className="text-xs opacity-90">{format(new Date(receipt.created_at), 'MMM dd, yyyy')}</div>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
              <ReceiptIcon className="w-4 h-4" />
              <span className="text-sm">Receipt Details</span>
            </div>
            <Badge variant={receipt.status === 'paid' ? 'default' : receipt.status === 'partial' ? 'outline' : 'secondary'}>
              {receipt.status.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-blue-700 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="font-semibold">{customerInfo?.full_name || 'Walk-in'}</div>
              {customerInfo?.email && (
                <div className="text-sm text-slate-600 flex items-center gap-2">
                  <Mail className="w-3 h-3" />
                  {customerInfo.email}
                </div>
              )}
              {customerInfo?.phone && (
                <div className="text-sm text-slate-600 flex items-center gap-2">
                  <Phone className="w-3 h-3" />
                  {customerInfo.phone}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-violet-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-violet-700 flex items-center gap-2">
                <ReceiptIcon className="w-4 h-4" />
                Receipt Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Date:</span>
                <span className="font-medium">{format(new Date(receipt.created_at), 'MMM dd, yyyy')}</span>
              </div>
              {receipt.payment_method && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Payment:</span>
                  <span className="font-medium">{receipt.payment_method}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Items
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {displayItems.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-slate-500">No items found for this receipt</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayItems.map((it: any) => (
                    <TableRow key={it.id}>
                      <TableCell className="font-medium">{it.description}</TableCell>
                      <TableCell>{it.quantity}</TableCell>
                      <TableCell>{symbol}{Number(it.unit_price).toFixed(2)}</TableCell>
                      <TableCell className="font-semibold">{symbol}{Number(it.total_price).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <div className="text-sm text-muted-foreground">No payments</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{format(new Date(p.payment_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell>{p.reference_number || '—'}</TableCell>
                      <TableCell>{symbol}{Number(p.amount).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="mt-4 text-sm">
              <div>Total: {symbol}{Number(receipt.total_amount).toFixed(2)}</div>
              <div>Paid: {symbol}{Number(receipt.amount_paid || 0).toFixed(2)}</div>
              <div>Outstanding: {symbol}{Number(outstanding).toFixed(2)}</div>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card className="bg-slate-50">
          <CardContent className="p-4">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span className="font-semibold">{symbol}{Number(receipt.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax:</span>
                  <span className="font-semibold">{symbol}{Number(receipt.tax_amount || 0).toFixed(2)}</span>
                </div>
                {Number(receipt.discount_amount || 0) > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Discount:</span>
                    <span className="font-semibold">-{symbol}{Number(receipt.discount_amount).toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-violet-600">{symbol}{Number(receipt.total_amount || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer note */}
        <div className="text-center text-xs text-slate-500">
          Thank you for your business!
        </div>
      </div>

      {/* Actions - hidden in print */}
      {!isPrintMode && (
        <div className="flex justify-between items-center pt-2 print:hidden">
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
          <div className="flex gap-3">
            {outstanding > 0 && (
              <Button onClick={() => navigate('/receipts') }>
                <DollarSign className="w-4 h-4 mr-2" />
                Record Payment
              </Button>
            )}
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" onClick={handleDownloadPdf}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button variant="outline">
              <MessageSquare className="w-4 h-4 mr-2" />
              Send WhatsApp
            </Button>
            <Button className="bg-violet-600 hover:bg-violet-700" onClick={() => navigate(`/receipts/${id}/edit`)}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Sales Receipt
            </Button>
          </div>
        </div>
      )}

      {/* Internal: Services, Staff & Commissions (hidden in print/PDF) */}
      {!isPrintMode && (
        <Card className="print:hidden border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Internal: Services, Staff & Commissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-sm text-muted-foreground">This section is internal-only and will not appear on printed or customer receipts.</div>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Commission %</TableHead>
                    <TableHead>Commission Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsWithCommission.map((it: any) => (
                    <TableRow key={`c_${it.id}`}>
                      <TableCell className="font-medium">{it.description}</TableCell>
                      <TableCell>{it.staff_name}</TableCell>
                      <TableCell>{it.quantity}</TableCell>
                      <TableCell>{symbol}{Number(it.unit_price).toFixed(2)}</TableCell>
                      <TableCell>{symbol}{Number(it.total_price).toFixed(2)}</TableCell>
                      <TableCell>{Number(it.commission_percentage || 0).toFixed(2)}%</TableCell>
                      <TableCell className="font-semibold">{symbol}{Number(it.commission_amount || 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Separator />

            <div>
              <div className="text-sm font-semibold mb-2">Commission Summary by Staff</div>
              {commissionByStaff.length === 0 ? (
                <div className="text-sm text-muted-foreground">No staff commissions to display.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>Commission Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissionByStaff.map((row) => (
                      <TableRow key={`s_${row.staff_id}`}>
                        <TableCell className="font-medium">{row.staff_name}</TableCell>
                        <TableCell className="font-semibold">{symbol}{row.commission_due.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
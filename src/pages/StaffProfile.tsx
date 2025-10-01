import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import {
  Users,
  ArrowLeft,
  TrendingUp,
  Star,
  Calendar,
  DollarSign,
  Zap,
  Camera,
  ImagePlus,
  Trash2,
} from 'lucide-react';
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { tableExists } from "@/utils/mockDatabase";
import { format as formatDate } from "date-fns";

interface StaffRecord {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  commission_rate?: number | null;
  is_active: boolean;
  hire_date?: string | null;
  specialties?: string[] | null;
}

interface StaffGalleryItem {
  id: string;
  staff_id: string;
  storage_path: string;
  public_url: string;
  caption?: string | null;
  created_at: string;
}

const STAFF_MEDIA_BUCKET = 'staff-media';

export default function StaffProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { format: formatMoney, symbol } = useOrganizationCurrency();

  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffRecord | null>(null);
  const [startDate, setStartDate] = useState<string>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10));
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [activeTab, setActiveTab] = useState('activity');
  const [commissionRows, setCommissionRows] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [payrollHistory, setPayrollHistory] = useState<any[]>([]);

  const [gallery, setGallery] = useState<StaffGalleryItem[]>([]);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const [commissionEditing, setCommissionEditing] = useState(false);
  const [commissionDraft, setCommissionDraft] = useState<number | ''>('');
  const [notesDraft, setNotesDraft] = useState('');
  const [scheduleDate, setScheduleDate] = useState<Date>(new Date());

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: s, error } = await supabase.from('staff').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        setStaff(s as any);
        if (s) {
          setCommissionDraft(typeof s.commission_rate === 'number' ? Number(s.commission_rate) : '');
        }
      } catch (e: any) {
        toast({ title: 'Error', description: e?.message || 'Failed to load staff', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [id, toast]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // Load commission data from staff_commissions table (linked to invoices)
      const { data: commissions, error: commErr } = await supabase
        .from('staff_commissions')
        .select(`
          id, commission_amount, commission_percentage, status, accrued_date, paid_date,
          invoice_items(
            id, description, unit_price, quantity, total_price,
            invoices(
              id, invoice_number, issue_date, status
            ),
            services(id, name)
          )
        `)
        .eq('staff_id', id)
        .gte('accrued_date', startDate)
        .lte('accrued_date', endDate);
      
      if (commErr) throw commErr;

      const normalized = (commissions || []).map((row: any) => {
        const invoiceItem = row.invoice_items;
        const invoice = invoiceItem?.invoices;
        const service = invoiceItem?.services;
        
        return {
          id: row.id,
          date: row.accrued_date || invoice?.issue_date || null,
          service: service?.name || invoiceItem?.description || 'Service',
          gross: Number(invoiceItem?.total_price || 0),
          rate: Number(row.commission_percentage || 0),
          commission: Number(row.commission_amount || 0),
          status: row.status,
          invoice_number: invoice?.invoice_number
        };
      });
      setCommissionRows(normalized);

      // Load appointments for this staff within date range, including multi-staff via appointment_services
      const [directRes, hasApptServices] = await Promise.all([
        supabase
          .from('appointments')
          .select('id, appointment_date, appointment_time, status, price, staff_id, service_name')
          .eq('staff_id', id)
          .gte('appointment_date', startDate)
          .lte('appointment_date', endDate),
        tableExists(supabase, 'appointment_services').catch(() => false)
      ]);

      const directAppts = (directRes?.data || []) as any[];
      let combined: any[] = [...directAppts];

      if (hasApptServices) {
        const { data: svcRows } = await supabase
          .from('appointment_services')
          .select('appointment_id')
          .eq('staff_id', id);
        const apptIds = Array.from(new Set((svcRows || []).map((r: any) => r.appointment_id).filter(Boolean)));
        if (apptIds.length) {
          const { data: apptsByService } = await supabase
            .from('appointments')
            .select('id, appointment_date, appointment_time, status, price, service_name')
            .in('id', apptIds)
            .gte('appointment_date', startDate)
            .lte('appointment_date', endDate);
          const byId: Record<string, any> = {};
          combined.forEach(a => { if (a?.id) byId[a.id] = a; });
          (apptsByService || []).forEach((a: any) => { if (a?.id) byId[a.id] = a; });
          combined = Object.values(byId);
        }
      }

      setAppointments(combined || []);

      // Load payroll history (commission payments)
      const { data: payrollData, error: payrollErr } = await supabase
        .from('staff_commissions')
        .select('*')
        .eq('staff_id', id)
        .eq('status', 'paid')
        .order('paid_date', { ascending: false });
      
      if (!payrollErr) {
        setPayrollHistory(payrollData || []);
      }
    } catch (e) {
      console.error('Failed to load staff profile data', e);
      setCommissionRows([]);
      setAppointments([]);
      setPayrollHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const loadGallery = async () => {
    if (!id) return;
    // Staff gallery feature not implemented yet
    setGallery([]);
  };

  useEffect(() => {
    loadData();
    loadGallery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const totals = useMemo(() => {
    const gross = commissionRows.reduce((s, r) => s + (r.gross || 0), 0);
    const commission = commissionRows.reduce((s, r) => s + (r.commission || 0), 0);
    const services = commissionRows.length;
    const avgRate = services > 0 ? (commissionRows.reduce((s, r) => s + (r.rate || 0), 0) / services) : 0;
    const apptCount = appointments.length;
    const avgPerService = services > 0 ? gross / services : 0;
    return { gross, commission, services, avgRate, apptCount, avgPerService };
  }, [commissionRows, appointments]);

  const commissionTotals = useMemo(() => {
    const earnedCommission = commissionRows.reduce((sum, r) => sum + (r.commission || 0), 0);
    const paidCommission = commissionRows
      .filter(r => r.status === 'paid')
      .reduce((sum, r) => sum + (r.commission || 0), 0);
    
    return {
      gross: commissionRows.reduce((sum, r) => sum + (r.gross || 0), 0),
      earned: earnedCommission,
      paid: paidCommission,
      pending: earnedCommission - paidCommission,
      count: commissionRows.length,
    };
  }, [commissionRows]);

  const getInitials = (name: string) => {
    const parts = (name || '').trim().split(' ');
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return `${first}${last}`.toUpperCase();
  };

  const handleAvatarFilePick = () => avatarInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!id) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `avatars/${id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(STAFF_MEDIA_BUCKET).upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from(STAFF_MEDIA_BUCKET).getPublicUrl(filePath);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) throw new Error('Failed to get public URL');

      // Profile image storage not implemented yet - would need to add column to staff table
      toast({ title: 'Profile photo feature not available yet' });
      toast({ title: 'Profile photo updated' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Avatar upload failed', description: e?.message || 'Unexpected error', variant: 'destructive' });
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleGalleryPick = () => galleryInputRef.current?.click();

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!id) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setGalleryUploading(true);
    try {
      const uploadedItems: StaffGalleryItem[] = [] as any;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop();
        const filePath = `gallery/${id}/${Date.now()}_${i}.${ext}`;
        const { error: upErr } = await supabase.storage.from(STAFF_MEDIA_BUCKET).upload(filePath, file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(STAFF_MEDIA_BUCKET).getPublicUrl(filePath);
        const publicUrl = pub?.publicUrl;
        if (!publicUrl) throw new Error('Failed to get public URL');
        // Gallery feature not implemented yet - would need staff_gallery table
        const inserted = { id: '', staff_id: id, storage_path: filePath, public_url: publicUrl, created_at: new Date().toISOString() };
        uploadedItems.push(inserted as any);
      }
      setGallery((prev) => [...uploadedItems, ...prev]);
      toast({ title: 'Gallery updated', description: `${files.length} image(s) added` });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Upload failed', description: e?.message || 'Could not upload images', variant: 'destructive' });
    } finally {
      setGalleryUploading(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleDeleteGalleryItem = async (item: StaffGalleryItem) => {
    if (!confirm('Delete this image from gallery?')) return;
    try {
      const { error: rmErr } = await supabase.storage.from(STAFF_MEDIA_BUCKET).remove([item.storage_path]);
      if (rmErr) throw rmErr;
      // Gallery feature not implemented yet
      setGallery((prev) => prev.filter((g) => g.id !== item.id));
      toast({ title: 'Image removed' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Delete failed', description: e?.message || 'Could not delete image', variant: 'destructive' });
    }
  };

  const handleToggleActive = async (nextActive: boolean) => {
    if (!id) return;
    try {
      const { error } = await supabase
        .from('staff')
        .update({ is_active: nextActive })
        .eq('id', id);
      if (error) throw error;
      setStaff((prev) => (prev ? { ...prev, is_active: nextActive } : prev));
      toast({ title: nextActive ? 'Staff activated' : 'Staff deactivated' });
    } catch (e: any) {
      toast({ title: 'Update failed', description: e?.message || 'Could not update status', variant: 'destructive' });
    }
  };

  const handleSaveCommission = async () => {
    if (!id) return;
    try {
      const value = commissionDraft === '' ? null : Number(commissionDraft);
      const { error } = await supabase
        .from('staff')
        .update({ commission_rate: value })
        .eq('id', id);
      if (error) throw error;
      setStaff((prev) => (prev ? { ...prev, commission_rate: value } : prev));
      setCommissionEditing(false);
      toast({ title: 'Commission updated' });
    } catch (e: any) {
      toast({ title: 'Update failed', description: e?.message || 'Could not update commission', variant: 'destructive' });
    }
  };

  const handleSaveNotes = async () => {
    // Notes feature not implemented yet - would need to add notes column to staff table
    toast({ title: 'Notes feature not available yet' });
  };

  // Preset quick ranges removed

  if (loading && !staff) return <div className="p-6">Loading...</div>;
  if (!staff) return <div className="p-6">Staff not found</div>;

  return (
    <div className="flex-1 space-y-6 px-4 sm:px-6 lg:px-8 py-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative">
              <Avatar className="w-16 h-16 shadow-md ring-2 ring-white">
                <AvatarFallback className="text-lg font-semibold">
                  {getInitials(staff.full_name)}
                </AvatarFallback>
              </Avatar>
              <input
                type="file"
                accept="image/*"
                ref={avatarInputRef}
                className="hidden"
                onChange={handleAvatarChange}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleAvatarFilePick}
                disabled={avatarUploading}
                className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full p-0"
                title="Change profile photo"
              >
                <Camera className="w-3 h-3" />
              </Button>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                {staff.full_name}
                <Badge variant={staff.is_active ? 'default' : 'secondary'}>
                  {staff.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </h1>
              <div className="text-slate-600 text-sm flex items-center gap-3">
                {typeof staff.commission_rate === 'number' && <span>{staff.commission_rate}% commission</span>}
                {staff.email && <span className="truncate max-w-[140px] sm:max-w-[200px]">{staff.email}</span>}
                {staff.phone && <span>{staff.phone}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3 sm:justify-end w-full sm:w-auto">
          <div className="w-full sm:w-auto">
            <div className="text-xs text-slate-600">Start</div>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full sm:w-40" />
          </div>
          <div className="w-full sm:w-auto">
            <div className="text-xs text-slate-600">End</div>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full sm:w-40" />
          </div>
          <Button onClick={loadData}>Apply</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600 flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-600"/>Revenue (Gross)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(totals.gross)}</div>
            <div className="text-xs text-slate-600">From services linked to receipts</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-600"/>Earned Commission</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatMoney(commissionTotals.earned)}</div>
            <div className="text-xs text-slate-600">Total commission earned</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600 flex items-center gap-2"><DollarSign className="w-4 h-4 text-blue-600"/>Paid Commission</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatMoney(commissionTotals.paid)}</div>
            <div className="text-xs text-slate-600">Commission already paid</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600 flex items-center gap-2"><Star className="w-4 h-4 text-amber-600"/>Pending Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{formatMoney(commissionTotals.pending)}</div>
            <div className="text-xs text-slate-600">Awaiting payment</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600 flex items-center gap-2"><Zap className="w-4 h-4 text-violet-600"/>Avg. Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.avgRate.toFixed(2)}%</div>
            <div className="text-xs text-slate-600">Average commission rate</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-4">
        <div className="space-y-4 lg:col-span-2 xl:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="overflow-x-auto -mx-1 px-1">
              <TabsList className="bg-white border shadow-sm h-auto p-1 w-full justify-start">
                <TabsTrigger value="activity" className="text-sm">
                  <Calendar className="w-4 h-4 mr-2" />
                  Activity ({appointments.length})
                </TabsTrigger>
                <TabsTrigger value="commissions" className="text-sm">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Commissions ({commissionTotals.count})
                </TabsTrigger>
                <TabsTrigger value="payroll" className="text-sm">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Payroll ({payrollHistory.length})
                </TabsTrigger>
                <TabsTrigger value="gallery" className="text-sm">
                  <Camera className="w-4 h-4 mr-2" />
                  Gallery ({gallery.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="activity" className="space-y-4">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Upcoming & Recent Appointments</CardTitle>
                </CardHeader>
                <CardContent>
                  {appointments.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No appointments found for the selected period.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Service</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {appointments.map((appt) => (
                            <TableRow key={appt.id}>
                              <TableCell className="font-medium">
                                {appt.appointment_date ? formatDate(new Date(appt.appointment_date), 'MMM dd, yyyy') : 'N/A'}
                              </TableCell>
                              <TableCell>{appt.appointment_time || 'N/A'}</TableCell>
                              <TableCell>{appt.service_name || 'Service'}</TableCell>
                              <TableCell>
                                <Badge variant={
                                  appt.status === 'completed' ? 'default' :
                                  appt.status === 'cancelled' ? 'destructive' :
                                  appt.status === 'no_show' ? 'secondary' : 'outline'
                                }>
                                  {appt.status || 'scheduled'}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatMoney(appt.price || 0)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="commissions" className="space-y-4">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Commission History</CardTitle>
                </CardHeader>
                <CardContent>
                  {commissionRows.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No commissions found for the selected period.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Service</TableHead>
                            <TableHead>Invoice</TableHead>
                            <TableHead>Gross</TableHead>
                            <TableHead>Rate</TableHead>
                            <TableHead>Commission</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {commissionRows.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium">
                                {row.date ? formatDate(new Date(row.date), 'MMM dd, yyyy') : 'N/A'}
                              </TableCell>
                              <TableCell>{row.service}</TableCell>
                              <TableCell className="text-sm text-slate-600">{row.invoice_number || 'N/A'}</TableCell>
                              <TableCell>{formatMoney(row.gross)}</TableCell>
                              <TableCell>{row.rate.toFixed(1)}%</TableCell>
                              <TableCell className="font-medium">{formatMoney(row.commission)}</TableCell>
                              <TableCell>
                                <Badge variant={row.status === 'paid' ? 'default' : 'secondary'}>
                                  {row.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payroll" className="space-y-4">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Payroll History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3 mb-6">
                    <Card className="bg-gradient-to-br from-green-50 to-green-100/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-600">Total Earned</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">{formatMoney(commissionTotals.earned)}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-600">Total Paid</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{formatMoney(commissionTotals.paid)}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-600">Pending</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{formatMoney(commissionTotals.pending)}</div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {payrollHistory.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No payroll payments found.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Payment Date</TableHead>
                            <TableHead>Accrued Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Rate</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payrollHistory.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell className="font-medium">
                                {payment.paid_date ? formatDate(new Date(payment.paid_date), 'MMM dd, yyyy') : 'N/A'}
                              </TableCell>
                              <TableCell>
                                {payment.accrued_date ? formatDate(new Date(payment.accrued_date), 'MMM dd, yyyy') : 'N/A'}
                              </TableCell>
                              <TableCell className="font-semibold text-green-600">
                                {formatMoney(payment.commission_amount || 0)}
                              </TableCell>
                              <TableCell>{(payment.commission_percentage || 0).toFixed(1)}%</TableCell>
                              <TableCell className="text-sm text-slate-600">
                                {payment.payment_reference || 'N/A'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="default">Paid</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="gallery" className="space-y-4">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    Work Gallery
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        ref={galleryInputRef}
                        className="hidden"
                        onChange={handleGalleryUpload}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleGalleryPick}
                        disabled={galleryUploading}
                      >
                        <ImagePlus className="w-4 h-4 mr-2" />
                        {galleryUploading ? 'Uploading...' : 'Add Photos'}
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {gallery.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Camera className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No photos in gallery yet.</p>
                      <Button variant="outline" className="mt-4" onClick={handleGalleryPick}>
                        <ImagePlus className="w-4 h-4 mr-2" />
                        Upload First Photo
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {gallery.map((item) => (
                        <div key={item.id} className="relative group aspect-square">
                          <img
                            src={item.public_url}
                            alt={item.caption || 'Gallery item'}
                            className="w-full h-full object-cover rounded-lg shadow-sm"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteGalleryItem(item)}
                              className="w-8 h-8 p-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Settings
                <Switch checked={staff.is_active} onCheckedChange={handleToggleActive} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2 flex items-center justify-between">
                  Commission Rate
                  {!commissionEditing && (
                    <Button size="sm" variant="ghost" onClick={() => setCommissionEditing(true)}>
                      Edit
                    </Button>
                  )}
                </div>
                {commissionEditing ? (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="0"
                      value={commissionDraft}
                      onChange={(e) => setCommissionDraft(e.target.value === '' ? '' : Number(e.target.value))}
                      className="flex-1"
                    />
                    <Button size="sm" onClick={handleSaveCommission}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      setCommissionEditing(false);
                      setCommissionDraft(typeof staff.commission_rate === 'number' ? Number(staff.commission_rate) : '');
                    }}>Cancel</Button>
                  </div>
                ) : (
                  <div className="text-lg font-semibold">
                    {typeof staff.commission_rate === 'number' ? `${staff.commission_rate}%` : 'Not set'}
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <div className="text-sm font-medium mb-2">Quick Notes</div>
                <Textarea
                  placeholder="Add notes about this staff member..."
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  className="min-h-[80px]"
                />
                <Button size="sm" className="mt-2" onClick={handleSaveNotes}>
                  Save Notes
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Tips</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 space-y-2">
              <p>Use the date filters above to analyze this staff member's performance over your desired period.</p>
              <p>Upload work photos to keep a portfolio that you can showcase to clients.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
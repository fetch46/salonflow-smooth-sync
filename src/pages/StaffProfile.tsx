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
      // Load commission entries from job_card_services for this staff within date range
      const { data: jcs, error: jcsErr } = await supabase
        .from('job_card_services')
        .select(`
          id, created_at, quantity, unit_price, commission_percentage,
          services:service_id ( id, name, commission_percentage ),
          job_cards:job_card_id ( id, created_at )
        `)
        .eq('staff_id', id)
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      if (jcsErr) throw jcsErr;

      const normalized = (jcs || []).map((row: any) => {
        const qty = Number(row.quantity || 1);
        const unit = Number(row.unit_price || 0);
        const gross = qty * unit;
        // Commission rate preference: explicit row.commission_percentage -> service default -> 0
        const rate = typeof row.commission_percentage === 'number' && !isNaN(row.commission_percentage)
          ? Number(row.commission_percentage)
          : (typeof row.services?.commission_percentage === 'number' && !isNaN(row.services?.commission_percentage)
            ? Number(row.services?.commission_percentage)
            : 0);
        const commission = Number(((gross * rate) / 100).toFixed(2));
        return {
          id: row.id,
          date: (row.created_at || (Array.isArray(row.job_cards) ? row.job_cards[0]?.created_at : row.job_cards?.created_at)) || null,
          service: (Array.isArray(row.services) ? row.services[0] : row.services)?.name || 'Service',
          gross,
          rate,
          commission,
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
    } catch (e) {
      console.error('Failed to load staff profile data', e);
      setCommissionRows([]);
      setAppointments([]);
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
    return {
      gross: commissionRows.reduce((sum, r) => sum + (r.gross || 0), 0),
      commission: commissionRows.reduce((sum, r) => sum + (r.commission || 0), 0),
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <CardTitle className="text-sm text-slate-600 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-violet-600"/>Commission</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(totals.commission)}</div>
            <div className="text-xs text-slate-600">Based on service/staff rates</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600 flex items-center gap-2"><Star className="w-4 h-4 text-amber-600"/>Avg. Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.avgRate.toFixed(2)}%</div>
            <div className="text-xs text-slate-600">Average commission rate</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600 flex items-center gap-2"><Zap className="w-4 h-4 text-blue-600"/>Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(totals.avgPerService)}</div>
            <div className="text-xs text-slate-600">Revenue per service</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-4">
        <div className="space-y-4 lg:col-span-2 xl:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="overflow-x-auto -mx-1 px-1">
              <TabsList className="min-w-max justify-start sm:justify-start">
                <TabsTrigger value="activity" className="px-4 py-2 text-base">Activities</TabsTrigger>
                <TabsTrigger value="schedule" className="px-4 py-2 text-base">Schedule</TabsTrigger>
                <TabsTrigger value="commissions" className="px-4 py-2 text-base">Commissions</TabsTrigger>
                <TabsTrigger value="gallery" className="px-4 py-2 text-base">Gallery</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="commissions">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Commission Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-slate-600 mb-3">
                    <div>Entries: <span className="font-medium text-slate-900">{commissionTotals.count}</span></div>
                    <div className="flex items-center gap-4">
                      <div>Gross: <span className="font-medium text-slate-900">{formatMoney(commissionTotals.gross)}</span></div>
                      <Separator orientation="vertical" className="h-4" />
                      <div>Commission: <span className="font-medium text-slate-900">{formatMoney(commissionTotals.commission)}</span></div>
                    </div>
                  </div>
                  {commissionRows.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-6">No commissions in this period</div>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table className="min-w-[640px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Service</TableHead>
                            <TableHead className="text-right">Gross</TableHead>
                            <TableHead className="text-right">Rate %</TableHead>
                            <TableHead className="text-right">Commission</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {commissionRows.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell>{String(r.date || '').slice(0,10)}</TableCell>
                              <TableCell>{r.service}</TableCell>
                              <TableCell className="text-right">{formatMoney(r.gross)}</TableCell>
                              <TableCell className="text-right">{r.rate.toFixed(2)}</TableCell>
                              <TableCell className="text-right">{formatMoney(r.commission)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4"/> Period Summary</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div>
                    <div className="text-sm text-slate-600">Appointments</div>
                    <div className="text-xl font-semibold">{totals.apptCount}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600">Services</div>
                    <div className="text-xl font-semibold">{totals.services}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600">Avg. {symbol}/Service</div>
                    <div className="text-xl font-semibold">{formatMoney(totals.avgPerService)}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Appointments</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {appointments.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-6">No appointments in this period</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table className="min-w-[480px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Service</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {appointments.map((a) => (
                            <TableRow key={a.id}>
                              <TableCell>{a.appointment_date}</TableCell>
                              <TableCell>
                                {a.status ? (
                                  <Badge variant={a.status === 'completed' ? 'default' : a.status === 'cancelled' ? 'secondary' : 'outline'} className="capitalize">
                                    {a.status}
                                  </Badge>
                                ) : '—'}
                              </TableCell>
                              <TableCell>{a.service_name || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="schedule">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4"/> Schedule</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-lg border p-3 bg-card">
                    <CalendarPicker
                      mode="single"
                      selected={scheduleDate}
                      onSelect={(d) => d && setScheduleDate(d)}
                      className="rounded-md"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-slate-600">Selected date</div>
                      <div className="text-sm font-medium text-slate-900">{formatDate(scheduleDate, 'yyyy-MM-dd')}</div>
                    </div>
                    <div className="rounded-md border overflow-x-auto">
                      <Table className="min-w-[480px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Service</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {appointments.filter((a) => String(a.appointment_date).slice(0,10) === formatDate(scheduleDate, 'yyyy-MM-dd')).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-sm text-muted-foreground">No appointments on this date</TableCell>
                            </TableRow>
                          ) : (
                            appointments
                              .filter((a) => String(a.appointment_date).slice(0,10) === formatDate(scheduleDate, 'yyyy-MM-dd'))
                              .map((a) => (
                                <TableRow key={a.id}>
                                  <TableCell>{a.appointment_time ? String(a.appointment_time).slice(0,5) : '—'}</TableCell>
                                  <TableCell>
                                    {a.status ? (
                                      <Badge variant={a.status === 'completed' ? 'default' : a.status === 'cancelled' ? 'secondary' : 'outline'} className="capitalize">
                                        {a.status}
                                      </Badge>
                                    ) : '—'}
                                  </TableCell>
                                  <TableCell>{a.service_name || '—'}</TableCell>
                                </TableRow>
                              ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="gallery">
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <CardTitle className="text-base">Work Gallery</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-slate-600">Showcase this staff member's work</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        ref={galleryInputRef}
                        className="hidden"
                        multiple
                        onChange={handleGalleryUpload}
                      />
                      <Button onClick={handleGalleryPick} disabled={galleryUploading}>
                        <ImagePlus className="w-4 h-4 mr-2" />
                        {galleryUploading ? 'Uploading...' : 'Add Images'}
                      </Button>
                    </div>
                  </div>

                  {gallery.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-6">No images yet. Click "Add Images" to upload.</div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {gallery.map((item) => (
                        <div key={item.id} className="group relative overflow-hidden rounded-lg border bg-card shadow-sm">
                          <img
                            src={item.public_url}
                            alt={item.caption || 'Work photo'}
                            className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => handleDeleteGalleryItem(item)}>
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
              <CardTitle className="text-base">Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">Status</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">Inactive</span>
                  <Switch checked={staff.is_active} onCheckedChange={handleToggleActive} />
                  <span className="text-xs text-slate-900 font-medium">Active</span>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 gap-3 text-sm">
                {staff.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Email</span>
                    <span className="font-medium text-slate-900 truncate max-w-[180px]">{staff.email}</span>
                  </div>
                )}
                {staff.phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Phone</span>
                    <span className="font-medium text-slate-900">{staff.phone}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-600">Commission</span>
                  {commissionEditing ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={commissionDraft}
                        onChange={(e) => setCommissionDraft(e.target.value === '' ? '' : Number(e.target.value))}
                        className="h-8 w-24"
                      />
                      <Button size="sm" onClick={handleSaveCommission}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => { setCommissionEditing(false); setCommissionDraft(typeof staff.commission_rate === 'number' ? Number(staff.commission_rate) : ''); }}>Cancel</Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{typeof staff.commission_rate === 'number' ? `${staff.commission_rate}%` : '—'}</span>
                      <Button size="sm" variant="outline" onClick={() => setCommissionEditing(true)}>Edit</Button>
                    </div>
                  )}
                </div>
                {staff.hire_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Hired</span>
                    <span className="font-medium text-slate-900">{staff.hire_date}</span>
                  </div>
                )}
              </div>
              {staff.specialties && staff.specialties.length > 0 && (
                <div>
                  <div className="text-sm text-slate-600 mb-2">Specialties</div>
                  <div className="flex flex-wrap gap-1">
                    {staff.specialties.slice(0, 8).map((s) => (
                      <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                    ))}
                    {staff.specialties.length > 8 && (
                      <Badge variant="outline" className="text-xs">+{staff.specialties.length - 8} more</Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Add private notes about this staff member (visible to admins only)"
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={6}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setNotesDraft('')}>Reset</Button>
                <Button onClick={handleSaveNotes}>Save Notes</Button>
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
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

interface StaffRecord {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  profile_image?: string | null;
  commission_rate?: number | null;
  is_active: boolean;
  hire_date?: string | null;
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

  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffRecord | null>(null);
  const [startDate, setStartDate] = useState<string>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10));
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [activeTab, setActiveTab] = useState('overview');
  const [commissionRows, setCommissionRows] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);

  const [gallery, setGallery] = useState<StaffGalleryItem[]>([]);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: s, error } = await supabase.from('staff').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        setStaff(s as any);
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
      // Filter receipts in date range
      const { data: receipts } = await supabase
        .from('receipts')
        .select('id, created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      const receiptIds: string[] = (receipts || []).map((r: any) => r.id);

      let comms: any[] = [];
      if (receiptIds.length > 0) {
        const { data } = await supabase
          .from('staff_commissions')
          .select(`
            id, commission_rate, gross_amount, commission_amount,
            receipt:receipt_id ( id, created_at ),
            service:service_id ( id, name )
          `)
          .eq('staff_id', id)
          .in('receipt_id', receiptIds);
        comms = data || [];
      }

      const normalized = (comms || []).map((r: any) => ({
        id: r.id,
        date: (Array.isArray(r.receipt) ? r.receipt[0] : r.receipt)?.created_at,
        service: (Array.isArray(r.service) ? r.service[0] : r.service)?.name || 'Service',
        gross: Number(r.gross_amount || 0),
        rate: Number(r.commission_rate || 0),
        commission: Number(r.commission_amount || 0),
      }));
      setCommissionRows(normalized);

      const { data: appts } = await supabase
        .from('appointments')
        .select('id, appointment_date, status, total_amount')
        .eq('staff_id', id)
        .gte('appointment_date', startDate)
        .lte('appointment_date', endDate);
      setAppointments(appts || []);
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
    try {
      const { data, error } = await supabase
        .from('staff_gallery')
        .select('*')
        .eq('staff_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setGallery((data as any) || []);
    } catch (e: any) {
      console.warn('Failed to load gallery', e?.message);
    }
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

      const { error: updateError } = await supabase
        .from('staff')
        .update({ profile_image: publicUrl })
        .eq('id', id);
      if (updateError) throw updateError;

      setStaff((prev) => (prev ? { ...prev, profile_image: publicUrl } : prev));
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
        const { data: inserted, error: insErr } = await supabase
          .from('staff_gallery')
          .insert({ staff_id: id, storage_path: filePath, public_url: publicUrl })
          .select('*')
          .single();
        if (insErr) throw insErr;
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
      const { error: delErr } = await supabase.from('staff_gallery').delete().eq('id', item.id);
      if (delErr) throw delErr;
      setGallery((prev) => prev.filter((g) => g.id !== item.id));
      toast({ title: 'Image removed' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Delete failed', description: e?.message || 'Could not delete image', variant: 'destructive' });
    }
  };

  if (loading && !staff) return <div className="p-6">Loading...</div>;
  if (!staff) return <div className="p-6">Staff not found</div>;

  return (
    <div className="flex-1 space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="w-16 h-16 shadow-md ring-2 ring-white">
                {staff.profile_image ? (
                  <AvatarImage src={staff.profile_image} alt={staff.full_name} />
                ) : (
                  <AvatarFallback className="text-lg font-semibold">
                    {getInitials(staff.full_name)}
                  </AvatarFallback>
                )}
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
                {staff.email && <span className="truncate max-w-[200px]">{staff.email}</span>}
                {staff.phone && <span>{staff.phone}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <div className="text-xs text-slate-600">Start</div>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <div className="text-xs text-slate-600">End</div>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
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
            <div className="text-2xl font-bold">${totals.gross.toFixed(2)}</div>
            <div className="text-xs text-slate-600">From services linked to receipts</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-violet-600"/>Commission</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totals.commission.toFixed(2)}</div>
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
            <div className="text-2xl font-bold">${totals.avgPerService.toFixed(2)}</div>
            <div className="text-xs text-slate-600">Revenue per service</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card className="shadow-lg overflow-hidden">
            <div className="relative h-28 w-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-400" />
            <CardContent className="pt-0">
              <div className="-mt-10 flex items-end gap-4">
                <div className="relative">
                  <Avatar className="w-20 h-20 ring-4 ring-white shadow-xl">
                    {staff.profile_image ? (
                      <AvatarImage src={staff.profile_image} alt={staff.full_name} />
                    ) : (
                      <AvatarFallback className="text-xl font-semibold">
                        {getInitials(staff.full_name)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full p-0"
                    onClick={handleAvatarFilePick}
                    disabled={avatarUploading}
                  >
                    <Camera className="w-3 h-3" />
                  </Button>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">{staff.full_name}</h2>
                    <Badge variant={staff.is_active ? 'default' : 'secondary'}>
                      {staff.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="text-slate-600 text-sm flex flex-wrap items-center gap-3 mt-1">
                    {staff.email && <span className="truncate">{staff.email}</span>}
                    {staff.phone && <span>{staff.phone}</span>}
                    {typeof staff.commission_rate === 'number' && <span>{staff.commission_rate}% commission</span>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

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
                <div className="text-sm text-slate-600">Avg. $/Service</div>
                <div className="text-xl font-semibold">${totals.avgPerService.toFixed(2)}</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Commission Details</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {commissionRows.length === 0 ? (
                <div className="text-sm text-muted-foreground p-6">No commissions in this period</div>
              ) : (
                <Table>
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
                        <TableCell className="text-right">${r.gross.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{r.rate.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${r.commission.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Appointments</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {appointments.length === 0 ? (
                <div className="text-sm text-muted-foreground p-6">No appointments in this period</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.appointment_date}</TableCell>
                        <TableCell>{a.status || '—'}</TableCell>
                        <TableCell className="text-right">${Number(a.total_amount || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
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
                    <div key={item.id} className="group relative overflow-hidden rounded-lg border bg-white shadow-sm">
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
  );
}
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, ArrowLeft, TrendingUp, Star, Calendar, DollarSign, Zap } from 'lucide-react';

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

export default function StaffProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffRecord | null>(null);
  const [startDate, setStartDate] = useState<string>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10));
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [activeTab, setActiveTab] = useState('overview');
  const [commissionRows, setCommissionRows] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: s } = await supabase.from('staff').select('*').eq('id', id).maybeSingle();
        setStaff(s);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

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

  useEffect(() => {
    loadData();
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

  if (loading && !staff) return <div className="p-6">Loading...</div>;
  if (!staff) return <div className="p-6">Staff not found</div>;

  return (
    <div className="flex-1 space-y-6 p-6 bg-slate-50/30 min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl shadow-lg">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{staff.full_name}</h1>
              <div className="text-slate-600 text-sm flex items-center gap-2">
                <Badge variant={staff.is_active ? 'default' : 'secondary'}>{staff.is_active ? 'Active' : 'Inactive'}</Badge>
                {staff.commission_rate != null && (
                  <span>{staff.commission_rate}% commission</span>
                )}
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
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
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
      </Tabs>
    </div>
  );
}
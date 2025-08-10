import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  Star,
  Plus,
  ChevronRight,
  Activity,
  Target,
  Zap,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart,
  Receipt,
  UserCheck,
  Scissors,
  Eye,
  Settings,
  Bell,
  CheckCircle,
  AlertTriangle,
  Timer,
  MapPin,
  Crown,
  TrendingDown,
  RefreshCw,
  Calendar as CalendarIcon,
  Phone,
  Mail,
  MessageSquare,
  CreditCard
} from "lucide-react";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Utility helpers for safe percentage and averages
const safePercent = (current: number, previous: number) => {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

const average = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [timeRange, setTimeRange] = useState("today");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { user, organization, subscriptionPlan } = useSaas();
  const { symbol, format } = useOrganizationCurrency();

  // Load today's appointments and staff to show real data on dashboard
  type DashboardAppointment = {
    id: string;
    customer_name: string;
    service_name: string;
    staff_id: string | null;
    appointment_date: string;
    appointment_time: string;
    duration_minutes: number | null;
    status: string;
    price: number | null;
  };

  const [todayAppointments, setTodayAppointments] = useState<DashboardAppointment[]>([]);
  const [yesterdayAppointments, setYesterdayAppointments] = useState<DashboardAppointment[]>([]);
  const [staffMap, setStaffMap] = useState<Record<string, string>>({});
  // Derived counts will be computed from fetched arrays; no separate state for counts
  // const [activeStaffCount, setActiveStaffCount] = useState<number>(0);

  // Metrics state (no sample data)
  const [metrics, setMetrics] = useState({
    revenueToday: 0,
    revenueYesterday: 0,
    appointmentsToday: 0,
    appointmentsYesterday: 0,
    newClientsToday: 0,
    newClientsYesterday: 0,
    staffUtilizationToday: 0,
    staffUtilizationYesterday: 0,
    completionRateToday: 0,
    completionRateYesterday: 0,
    avgServiceTimeToday: 0,
    avgServiceTimeYesterday: 0,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const today = new Date();
        const yesterday = subDays(today, 1);
        const todayStr = formatDate(today, 'yyyy-MM-dd');
        const yesterdayStr = formatDate(yesterday, 'yyyy-MM-dd');

        const appointmentsQuery = supabase
          .from('appointments')
          .select('id, customer_name, service_name, staff_id, appointment_date, appointment_time, duration_minutes, status, price')
          .eq('appointment_date', todayStr)
          .order('appointment_time', { ascending: true });

        const appointmentsYesterdayQuery = supabase
          .from('appointments')
          .select('id, customer_name, service_name, staff_id, appointment_date, appointment_time, duration_minutes, status, price')
          .eq('appointment_date', yesterdayStr)
          .order('appointment_time', { ascending: true });

        const staffQuery = supabase
          .from('staff')
          .select('id, full_name')
          .eq('is_active', true);

        // New clients counts
        const clientsTodayQuery = supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startOfDay(today).toISOString())
          .lte('created_at', endOfDay(today).toISOString());

        const clientsYesterdayQuery = supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startOfDay(yesterday).toISOString())
          .lte('created_at', endOfDay(yesterday).toISOString());

        const [
          { data: appts, error: apptErr },
          { data: apptsY, error: apptYesterdayErr },
          { data: staff, error: staffErr },
          clientsToday,
          clientsYesterday,
        ] = await Promise.all([
          appointmentsQuery,
          appointmentsYesterdayQuery,
          staffQuery,
          clientsTodayQuery,
          clientsYesterdayQuery,
        ]);

        if (apptErr) throw apptErr;
        if (apptYesterdayErr) throw apptYesterdayErr;
        if (staffErr) throw staffErr;

        setTodayAppointments((appts || []) as DashboardAppointment[]);
        setYesterdayAppointments((apptsY || []) as DashboardAppointment[]);
        const map: Record<string, string> = {};
        (staff || []).forEach((s: any) => {
          if (s?.id) map[s.id] = s.full_name;
        });
        setStaffMap(map);
        const staffCount = (staff || []).length;

        // Compute appointment-based metrics
        const apptsToday = (appts || []) as DashboardAppointment[];
        const apptsYesterday = (apptsY || []) as DashboardAppointment[];
        const completionTodayNumerator = apptsToday.filter(a => (a.status || '').toLowerCase() === 'completed').length;
        const completionYesterdayNumerator = apptsYesterday.filter(a => (a.status || '').toLowerCase() === 'completed').length;
        const completionRateToday = apptsToday.length ? Math.round((completionTodayNumerator / apptsToday.length) * 100) : 0;
        const completionRateYesterday = apptsYesterday.length ? Math.round((completionYesterdayNumerator / apptsYesterday.length) * 100) : 0;
        const avgServiceTimeToday = Math.round(average(apptsToday.map(a => a.duration_minutes || 0).filter(v => v > 0)));
        const avgServiceTimeYesterday = Math.round(average(apptsYesterday.map(a => a.duration_minutes || 0).filter(v => v > 0)));
        const utilizedStaffToday = new Set(apptsToday.map(a => a.staff_id).filter(Boolean)).size;
        const utilizedStaffYesterday = new Set(apptsYesterday.map(a => a.staff_id).filter(Boolean)).size;
        const staffUtilizationToday = staffCount > 0 ? Math.round((utilizedStaffToday / (staffCount || 1)) * 100) : 0;
        const staffUtilizationYesterday = staffCount > 0 ? Math.round((utilizedStaffYesterday / (staffCount || 1)) * 100) : 0;

        // Revenue from receipts (prefer receipt_date if exists, else created_at range)
        let revenueToday = 0;
        let revenueYesterday = 0;
        try {
          const { data: receiptsToday, error: receiptsTodayErr } = await supabase
            .from('receipts')
            .select('total_amount')
            .eq('receipt_date', todayStr);
          if (receiptsTodayErr) throw receiptsTodayErr;
          revenueToday = (receiptsToday || []).reduce((sum: number, r: any) => sum + (Number(r.total_amount) || 0), 0);
        } catch (_) {
          const { data: receiptsToday, error: receiptsTodayErr } = await supabase
            .from('receipts')
            .select('total_amount, created_at')
            .gte('created_at', startOfDay(today).toISOString())
            .lte('created_at', endOfDay(today).toISOString());
          if (!receiptsTodayErr) {
            revenueToday = (receiptsToday || []).reduce((sum: number, r: any) => sum + (Number(r.total_amount) || 0), 0);
          }
        }

        try {
          const { data: receiptsYesterday, error: receiptsYesterdayErr } = await supabase
            .from('receipts')
            .select('total_amount')
            .eq('receipt_date', yesterdayStr);
          if (receiptsYesterdayErr) throw receiptsYesterdayErr;
          revenueYesterday = (receiptsYesterday || []).reduce((sum: number, r: any) => sum + (Number(r.total_amount) || 0), 0);
        } catch (_) {
          const { data: receiptsYesterday, error: receiptsYesterdayErr } = await supabase
            .from('receipts')
            .select('total_amount, created_at')
            .gte('created_at', startOfDay(yesterday).toISOString())
            .lte('created_at', endOfDay(yesterday).toISOString());
          if (!receiptsYesterdayErr) {
            revenueYesterday = (receiptsYesterday || []).reduce((sum: number, r: any) => sum + (Number(r.total_amount) || 0), 0);
          }
        }

        setMetrics({
          revenueToday,
          revenueYesterday,
          appointmentsToday: apptsToday.length,
          appointmentsYesterday: apptsYesterday.length,
          newClientsToday: clientsToday.count || 0,
          newClientsYesterday: clientsYesterday.count || 0,
          staffUtilizationToday,
          staffUtilizationYesterday,
          completionRateToday,
          completionRateYesterday,
          avgServiceTimeToday,
          avgServiceTimeYesterday,
        });
      } catch (e: any) {
        console.error('Failed to load dashboard data', e);
        setError(e?.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const todayStats = [
    {
      title: "Today's Revenue",
      value: `${symbol}${metrics.revenueToday.toLocaleString()}` as string,
      previousValue: metrics.revenueYesterday,
      change: safePercent(metrics.revenueToday, metrics.revenueYesterday),
      icon: DollarSign,
      gradient: "from-emerald-500 to-emerald-600",
      trend: metrics.revenueToday >= metrics.revenueYesterday ? "up" : "down"
    },
    {
      title: "Appointments",
      value: metrics.appointmentsToday.toString(),
      previousValue: metrics.appointmentsYesterday,
      change: safePercent(metrics.appointmentsToday, metrics.appointmentsYesterday),
      icon: Calendar,
      gradient: "from-blue-500 to-blue-600",
      trend: metrics.appointmentsToday >= metrics.appointmentsYesterday ? "up" : "down"
    },
    {
      title: "New Clients",
      value: metrics.newClientsToday.toString(),
      previousValue: metrics.newClientsYesterday,
      change: safePercent(metrics.newClientsToday, metrics.newClientsYesterday),
      icon: Users,
      gradient: "from-purple-500 to-purple-600",
      trend: metrics.newClientsToday >= metrics.newClientsYesterday ? "up" : "down"
    },
    {
      title: "Staff Utilization",
      value: `${metrics.staffUtilizationToday}%`,
      previousValue: metrics.staffUtilizationYesterday,
      change: safePercent(metrics.staffUtilizationToday, metrics.staffUtilizationYesterday),
      icon: TrendingUp,
      gradient: "from-amber-500 to-amber-600",
      trend: metrics.staffUtilizationToday >= metrics.staffUtilizationYesterday ? "up" : "down"
    },
    {
      title: "Completion Rate",
      value: `${metrics.completionRateToday}%`,
      previousValue: metrics.completionRateYesterday,
      change: safePercent(metrics.completionRateToday, metrics.completionRateYesterday),
      icon: CheckCircle,
      gradient: "from-green-500 to-green-600",
      trend: metrics.completionRateToday >= metrics.completionRateYesterday ? "up" : "down"
    },
    {
      title: "Avg Service Time",
      value: `${metrics.avgServiceTimeToday}min`,
      previousValue: metrics.avgServiceTimeYesterday,
      change: safePercent(metrics.avgServiceTimeToday, metrics.avgServiceTimeYesterday),
      icon: Timer,
      gradient: "from-cyan-500 to-cyan-600",
      trend: metrics.avgServiceTimeToday <= metrics.avgServiceTimeYesterday ? "up" : "down"
    }
  ];

  // Compute top performers from today's appointments
  const topPerformers = useMemo(() => {
    const byStaff: Record<string, { name: string; revenue: number; appointments: number; completionRate: number }> = {};
    const totalByStaff: Record<string, { completed: number; total: number }> = {};
    for (const a of todayAppointments) {
      if (!a.staff_id) continue;
      const key = a.staff_id;
      const price = Number(a.price) || 0;
      if (!byStaff[key]) {
        byStaff[key] = { name: staffMap[key] || 'Unassigned', revenue: 0, appointments: 0, completionRate: 0 };
        totalByStaff[key] = { completed: 0, total: 0 };
      }
      byStaff[key].revenue += price;
      byStaff[key].appointments += 1;
      totalByStaff[key].total += 1;
      if ((a.status || '').toLowerCase() === 'completed') totalByStaff[key].completed += 1;
    }
    const list = Object.entries(byStaff).map(([key, val]) => ({
      name: val.name,
      revenue: Math.round(val.revenue),
      appointments: val.appointments,
      rating: 0,
      specialties: [] as string[],
      completionRate: totalByStaff[key].total ? Math.round((totalByStaff[key].completed / totalByStaff[key].total) * 100) : 0,
      avatar: (val.name || 'NA').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || '—',
    }));
    return list.sort((a, b) => b.revenue - a.revenue).slice(0, 4);
  }, [todayAppointments, staffMap]);

  // Recent activities from real data (appointments recently created/updated)
  const [recentActivities, setRecentActivities] = useState<{
    type: string;
    message: string;
    time: string;
    icon: any;
    color: string;
  }[]>([]);

  useEffect(() => {
    const loadRecent = async () => {
      try {
        const since = subDays(new Date(), 1);
        const { data: recentAppts } = await supabase
          .from('appointments')
          .select('customer_name, status, created_at, updated_at, appointment_time')
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: false })
          .limit(10);
        const items = (recentAppts || []).map((a: any) => ({
          type: 'appointment',
          message: `${(a.status || '').toLowerCase() === 'completed' ? 'Completed' : 'Booked'} appointment for ${a.customer_name || 'Client'}`,
          time: new Date(a.created_at || a.updated_at || Date.now()).toLocaleString(),
          icon: Calendar,
          color: 'text-blue-600',
        }));
        setRecentActivities(items);
      } catch (e) {
        // swallow errors; keep empty
      }
    };
    loadRecent();
  }, []);

  const quickActions = [
    {
      title: "New Appointment",
      description: "Book appointment for client",
      icon: Calendar,
      color: "bg-blue-50 text-blue-600 hover:bg-blue-100",
      action: () => navigate("/appointments?create=1")
    },
    {
      title: "Add Client",
      description: "Register new customer",
      icon: Users,
      color: "bg-green-50 text-green-600 hover:bg-green-100",
      action: () => navigate("/clients?create=1")
    },
    {
      title: "Process Payment",
      description: "Handle transaction",
      icon: DollarSign,
      color: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100",
      action: () => navigate("/pos")
    },
    {
      title: "View Reports",
      description: "Analytics & insights",
      icon: BarChart3,
      color: "bg-purple-50 text-purple-600 hover:bg-purple-100",
      action: () => navigate("/reports")
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "completed":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "cancelled":
        return "bg-red-50 text-red-700 border-red-200";
      case "scheduled":
        return "bg-slate-50 text-slate-700 border-slate-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const refreshData = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoading(false);
  };

  // Error boundary
  if (error) {
          return (
        <div className="flex-1 space-y-6 p-4 sm:p-6 pb-24 sm:pb-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen overflow-x-hidden">
          <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-red-700">Dashboard Error</h2>
          <p className="text-red-600">{error}</p>
          <Button onClick={() => setError(null)}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 pb-24 sm:pb-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen overflow-x-hidden">


      {/* Modern Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl shadow-lg">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
              <p className="text-slate-600">Welcome back! Here's your salon overview for today.</p>
            </div>
          </div>
        </div>
        
        <div className="flex w-full lg:w-auto flex-wrap items-center gap-2 sm:gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            onClick={refreshData}
            disabled={loading}
            className="border-slate-300 hover:bg-slate-50 px-2 sm:px-4"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''} sm:mr-2`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          
          <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg px-2 sm:px-4" onClick={() => navigate('/appointments?create=1')}>
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">New Appointment</span>
          </Button>
        </div>
      </div>

      {/* Enhanced Statistics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {todayStats.map((stat, index) => (
          <Card key={index} className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-100`} />
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-2">
              <CardTitle className="text-sm font-medium text-white/90">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-white/80" />
            </CardHeader>
            <CardContent className="relative p-3 sm:p-4">
              <div className="text-xl sm:text-2xl font-bold text-white">{stat.value}</div>
              <div className="flex items-center mt-1">
                {stat.change > 0 ? (
                  <ArrowUpRight className="h-3 w-3 text-white/80 mr-1" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-white/80 mr-1" />
                )}
                <p className="text-xs text-white/80">
                  {stat.change > 0 ? '+' : ''}{stat.change.toFixed(1)}% from yesterday
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Today's Appointments - Enhanced */}
        <div className="md:col-span-2 lg:col-span-2">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    Today's Schedule
                  </CardTitle>
                  <CardDescription>
                    {todayAppointments.length} appointments • {format(todayAppointments.reduce((sum, apt) => sum + (apt.price || 0), 0), { decimals: 0 })} revenue
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/appointments')}>
                  View All
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-80 sm:max-h-96 overflow-y-auto">
                {todayAppointments.map((appointment) => {
                  const initials = (appointment.customer_name || '')
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase())
                    .join('') || '—';
                  const staffName = appointment.staff_id ? (staffMap[appointment.staff_id] || 'Unassigned') : 'Unassigned';
                  const durationLabel = appointment.duration_minutes ? `${appointment.duration_minutes}min` : '';
                  return (
                    <div
                      key={appointment.id}
                      className="flex items-center justify-between p-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-medium text-sm">
                            {initials}
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold text-slate-900 truncate">
                              {appointment.customer_name}
                            </h4>
                            <Badge className={`${getStatusColor(appointment.status)} text-xs border`}>
                              {appointment.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600 truncate">
                            {(appointment.service_name || 'Service')} • {staffName}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <div className="flex items-center text-xs text-slate-500">
                              <Clock className="w-3 h-3 mr-1" />
                              {appointment.appointment_time} {durationLabel ? `(${durationLabel})` : ''}
                            </div>
                            {typeof appointment.price === 'number' && (
                              <div className="text-sm font-semibold text-slate-900">
                                {symbol}{Number(appointment.price).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {todayAppointments.length === 0 && (
                  <div className="p-6 text-sm text-slate-500">No appointments scheduled for today.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Top Performing Staff */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-600" />
                Top Performers
              </CardTitle>
              <CardDescription>Today's leading staff members</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-1">
                {topPerformers.map((staff, index) => (
                  <div key={index} className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium text-xs">
                          {staff.avatar}
                        </div>
                        {index === 0 && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                            <Crown className="w-2 h-2 text-white" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-slate-900 text-sm truncate">{staff.name}</h4>
                          {typeof staff.rating === 'number' && staff.rating > 0 && (
                            <div className="flex items-center">
                              <Star className="w-3 h-3 text-amber-500 mr-1" />
                              <span className="text-xs text-slate-600">{staff.rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{symbol}{staff.revenue.toLocaleString()}</span>
                          <span>{staff.appointments} apts</span>
                          <span>{staff.completionRate}%</span>
                        </div>
                        <div className="mt-1">
                          <Progress value={staff.completionRate} className="h-1" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-violet-600" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className={`${action.color} border-0 flex-col h-auto p-3 space-y-1`}
                    onClick={action.action}
                  >
                    <action.icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{action.title}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Activity */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-600" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest updates and notifications</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-56 sm:max-h-64 overflow-y-auto">
              {recentActivities.map((activity, index) => (
                <div key={index} className="flex items-start gap-3 p-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors">
                  <div className={`p-2 rounded-lg bg-slate-50 ${activity.color}`}>
                    <activity.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900">{activity.message}</p>
                    <p className="text-xs text-slate-500 mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Performance Overview */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              Performance Overview
            </CardTitle>
            <CardDescription>Key metrics and goals</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-700">Monthly Revenue Goal</span>
                  <span className="text-sm text-slate-600">{symbol}45K / {symbol}50K</span>
                </div>
                <Progress value={90} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-700">Client Satisfaction</span>
                  <span className="text-sm text-slate-600">4.8 / 5.0</span>
                </div>
                <Progress value={96} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-700">Staff Efficiency</span>
                  <span className="text-sm text-slate-600">87%</span>
                </div>
                <Progress value={87} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-700">Booking Rate</span>
                  <span className="text-sm text-slate-600">78%</span>
                </div>
                <Progress value={78} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sticky Mobile Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card/80 backdrop-blur-md supports-[backdrop-filter]:bg-card/60 sm:hidden">
        <div className="grid grid-cols-4 gap-1 p-2 max-w-3xl mx-auto">
          <Button variant="ghost" className="flex flex-col gap-1 py-2" onClick={() => navigate('/appointments')}>
            <Calendar className="w-5 h-5" />
            <span className="text-[10px]">Appts</span>
          </Button>
          <Button variant="ghost" className="flex flex-col gap-1 py-2" onClick={() => navigate('/clients')}>
            <Users className="w-5 h-5" />
            <span className="text-[10px]">Clients</span>
          </Button>
          <Button variant="ghost" className="flex flex-col gap-1 py-2" onClick={() => navigate('/pos')}>
            <CreditCard className="w-5 h-5" />
            <span className="text-[10px]">POS</span>
          </Button>
          <Button className="flex flex-col gap-1 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white" onClick={() => navigate('/appointments?create=1')}>
            <Plus className="w-5 h-5" />
            <span className="text-[10px]">New</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
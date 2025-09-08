import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import { CreateButtonGate } from "@/components/features/FeatureGate";
import JobCardsList from "@/components/JobCardsList";
import { 
  Plus, 
  Search, 
  Calendar, 
  DollarSign, 
  Clock,
  CheckCircle,
  Timer,
  TrendingUp,
  Activity,
  Target,
  RefreshCw,
  Filter,
  Download,
  ChevronRight,
  LayoutGrid,
  List
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, isSameDay } from "date-fns";
import { toast } from "sonner";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { getReceiptsWithFallback } from "@/utils/mockDatabase";
import { useRegionalSettings } from "@/hooks/useRegionalSettings";

interface JobCard {
  id: string;
  job_number: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  estimated_duration: number | null;
  actual_duration: number | null;
  priority: string;
  service_type: string | null;
  notes: string | null;
  staff: { 
    id: string;
    full_name: string; 
  } | null;
  client: { 
    id: string;
    full_name: string; 
    email?: string;
    phone?: string;
  } | null;
}

interface JobCardStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  cancelled: number;
  totalRevenue: number;
  averageDuration: number;
  completionRate: number;
  todayCards: number;
  overdueCards: number;
}

const JOB_STATUSES = [
  { value: "pending", label: "Pending", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock, dotColor: "bg-amber-500" },
  { value: "in_progress", label: "In Progress", color: "bg-blue-50 text-blue-700 border-blue-200", icon: CheckCircle, dotColor: "bg-blue-500" },
  { value: "completed", label: "Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle, dotColor: "bg-emerald-500" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-50 text-red-700 border-red-200", icon: Clock, dotColor: "bg-red-500" },
];

const PRIORITY_LEVELS = [
  { value: "low", label: "Low", color: "bg-green-50 text-green-700 border-green-200" },
  { value: "medium", label: "Medium", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { value: "high", label: "High", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { value: "urgent", label: "Urgent", color: "bg-red-50 text-red-700 border-red-200" }
];

const DATE_FILTERS = [
  { label: "All Time", value: "all_time" },
  { label: "Today", value: "today" },
  { label: "This Week", value: "this_week" },
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" }
];

export default function JobCards() {
  const { formatCurrency, formatNumber } = useRegionalSettings();
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all_time");
  const navigate = useNavigate();
  const [jobCardsWithReceipts, setJobCardsWithReceipts] = useState<Set<string>>(new Set());

  const fetchJobCards = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    try {
      if (!silent) setLoading(true);
      let data: any[] | null = null;
      try {
        const res = await supabase
          .from("job_cards")
          .select(`
            id, job_number, start_time, end_time, status, total_amount, created_at, updated_at,
            staff:staff_id (id, full_name),
            client:client_id (id, full_name, email, phone)
          `)
          .order("created_at", { ascending: false });
        if (res.error) throw res.error;
        data = res.data as any[];
      } catch (relErr) {
        console.warn('Relational select failed, falling back to basic select', relErr);
        const fallback = await supabase
          .from('job_cards')
          .select('id, job_number, start_time, end_time, status, total_amount, created_at, updated_at, staff_id, client_id')
          .order('created_at', { ascending: false });
        if (fallback.error) throw fallback.error;
        data = (fallback.data || []).map((row: any) => ({
          ...row,
          staff: null,
          client: null,
        }));
      }
      
      const normalizedData = (data || []).map((card: any) => ({
        ...card,
        estimated_duration: card.estimated_duration ?? null,
        actual_duration: card.actual_duration ?? null,
        priority: card.priority ?? null,
        service_type: card.service_type ?? null,
        notes: card.notes ?? null,
        staff: card.staff ?? null,
        client: card.client ?? null,
      }));
      
      setJobCards(normalizedData as any);

      // Build a lookup of job cards that have at least one invoice, with fallback to local storage
      const jobIds = (data || []).map((c: any) => c.id);
      if (jobIds.length > 0) {
        try {
          // Prefer live DB when available - use explicit type to break inference
          const { data: invoicesData, error: invoicesError }: { data: any, error: any } = await (supabase as any)
            .from('invoices')
            .select('job_card_id')
            .in('job_card_id', jobIds);

          if (invoicesError) throw invoicesError;
          const idsWithReceipts = new Set<string>((invoicesData || [])
            .map((r: any) => r.job_card_id)
            .filter(Boolean));
          setJobCardsWithReceipts(idsWithReceipts);
        } catch {
          // Fallback path (table missing or RLS denies select)
          const allReceipts = await getReceiptsWithFallback(supabase as any);
          const idsWithReceipts = new Set<string>(
            (allReceipts || [])
              .map((r: any) => r.job_card_id)
              .filter(Boolean)
          );
          setJobCardsWithReceipts(idsWithReceipts);
        }
      } else {
        setJobCardsWithReceipts(new Set());
      }
    } catch (error) {
      console.error("Error fetching job cards:", error);
      toast.error("Failed to fetch job cards");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobCards();
  }, [fetchJobCards]);

  const refreshData = async () => {
    try {
      setRefreshing(true);
      await fetchJobCards({ silent: true });
      toast.success("Data refreshed successfully");
    } catch (error) {
      toast.error("Failed to refresh data");
    } finally {
      setRefreshing(false);
    }
  };

  const filteredJobCards = useMemo(() => {
    return jobCards.filter(card => {
      const matchesSearch = 
        card.job_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.client?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.staff?.full_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || card.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || card.priority === priorityFilter;
      
      let matchesDate = true;
      if (dateFilter !== "all_time") {
        const cardDate = new Date(card.created_at);
        const today = new Date();
        
        switch (dateFilter) {
          case "today":
            matchesDate = isSameDay(cardDate, today);
            break;
          case "this_week":
            const weekStart = startOfWeek(today);
            const weekEnd = endOfWeek(today);
            matchesDate = cardDate >= weekStart && cardDate <= weekEnd;
            break;
          case "this_month":
            const monthStart = startOfMonth(today);
            const monthEnd = endOfMonth(today);
            matchesDate = cardDate >= monthStart && cardDate <= monthEnd;
            break;
          case "last_month":
            const lastMonthStart = startOfMonth(subMonths(today, 1));
            const lastMonthEnd = endOfMonth(subMonths(today, 1));
            matchesDate = cardDate >= lastMonthStart && cardDate <= lastMonthEnd;
            break;
        }
      }
      
      return matchesSearch && matchesStatus && matchesPriority && matchesDate;
    });
  }, [jobCards, searchTerm, statusFilter, priorityFilter, dateFilter]);

  // Calculate stats
  const stats = useMemo((): JobCardStats => {
    const total = jobCards.length;
    const completed = jobCards.filter(card => card.status === 'completed').length;
    const inProgress = jobCards.filter(card => card.status === 'in_progress').length;
    const pending = jobCards.filter(card => card.status === 'pending').length;
    const cancelled = jobCards.filter(card => card.status === 'cancelled').length;
    const totalRevenue = jobCards.reduce((sum, card) => sum + card.total_amount, 0);
    const completionRate = total > 0 ? (completed / total) * 100 : 0;
    
    // Calculate today's cards
    const today = new Date();
    const todayCards = jobCards.filter(card => 
      isSameDay(new Date(card.created_at), today)
    ).length;
    
    // Placeholder for overdue cards logic
    const overdueCards = 0;
    
    // Placeholder for average duration
    const averageDuration = 0;

    return {
      total,
      completed,
      inProgress,
      pending,
      cancelled,
      totalRevenue,
      averageDuration,
      completionRate,
      todayCards,
      overdueCards
    };
  }, [jobCards]);

  return (
    <div className="container mx-auto p-1 sm:p-2 space-y-3 max-w-[1600px]">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-responsive-2xl font-bold text-foreground">Job Cards</h1>
          <p className="text-responsive-sm text-muted-foreground mt-1">Manage and track service job cards</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={refreshData} disabled={refreshing} className="btn-compact">
            <RefreshCw className={`icon-responsive-sm mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <CreateButtonGate feature="jobcards" onClick={() => navigate("/job-cards/new")}>
            <Button className="bg-primary hover:bg-primary/90 btn-compact">
              <Plus className="icon-responsive-sm mr-2" />
              New Job Card
            </Button>
          </CreateButtonGate>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
        <Card className="lg:col-span-1 freshsales-card-compact">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-responsive-xs font-medium text-muted-foreground">Total Cards</p>
                <p className="text-responsive-lg font-bold text-foreground">{stats.total}</p>
              </div>
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Calendar className="icon-responsive-sm text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-responsive-sm font-medium text-slate-600">Completed</p>
                <p className="text-responsive-lg font-bold text-emerald-600">{stats.completed}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="icon-responsive-sm text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-responsive-sm font-medium text-slate-600">In Progress</p>
                <p className="text-responsive-lg font-bold text-blue-600">{stats.inProgress}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Timer className="icon-responsive-sm text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-responsive-sm font-medium text-slate-600">Total Revenue</p>
                <p className="text-responsive-lg font-bold text-slate-900">{formatCurrency(stats.totalRevenue)}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="icon-responsive-sm text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-responsive-sm font-medium text-slate-600">Today</p>
                <p className="text-responsive-lg font-bold text-slate-900">{stats.todayCards}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Activity className="icon-responsive-sm text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-responsive-sm font-medium text-slate-600">Completion Rate</p>
                <p className="text-responsive-lg font-bold text-slate-900">{stats.completionRate.toFixed(1)}%</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Target className="icon-responsive-sm text-purple-600" />
              </div>
            </div>
            <div className="mt-3">
              <Progress value={stats.completionRate} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search job cards, clients, staff..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {JOB_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  {PRIORITY_LEVELS.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FILTERS.map((filter) => (
                    <SelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Job Cards List */}
      <JobCardsList onRefresh={() => fetchJobCards({ silent: true })} />
    </div>
  );
}
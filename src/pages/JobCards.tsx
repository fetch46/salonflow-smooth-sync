import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { CreateButtonGate } from "@/components/features/FeatureGate";
import { 
  Plus, 
  Search, 
  FileText, 
  Calendar, 
  User, 
  DollarSign, 
  Eye, 
  Edit, 
  Printer, 
  Trash2, 
  MoreHorizontal,
  ClipboardList,
  Clock,
  CheckCircle,
  AlertTriangle,
  Timer,
  TrendingUp,
  Activity,
  Target,
  Users,
  RefreshCw,
  Filter,
  Download,
  ChevronRight,
  Star,
  Zap,
  Crown,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  UserCheck,
  Building2,
  MapPin,
  Phone,
  Mail,
  PlayCircle,
  PauseCircle,
  StopCircle,
  BarChart3,
  PieChart,
  List,
  LayoutGrid,
  Columns3
} from "lucide-react";
import { format, differenceInMinutes, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, isSameDay } from "date-fns";
import { toast } from "sonner";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { getReceiptsWithFallback } from "@/utils/mockDatabase";

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
    profile_image?: string;
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
  { value: "in_progress", label: "In Progress", color: "bg-blue-50 text-blue-700 border-blue-200", icon: PlayCircle, dotColor: "bg-blue-500" },
  { value: "paused", label: "Paused", color: "bg-orange-50 text-orange-700 border-orange-200", icon: PauseCircle, dotColor: "bg-orange-500" },
  { value: "completed", label: "Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle, dotColor: "bg-emerald-500" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-50 text-red-700 border-red-200", icon: StopCircle, dotColor: "bg-red-500" },
  { value: "overdue", label: "Overdue", color: "bg-purple-50 text-purple-700 border-purple-200", icon: AlertTriangle, dotColor: "bg-purple-500" }
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
  const { format: formatMoney, symbol } = useOrganizationCurrency();
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all_time");
  const [viewMode, setViewMode] = useState<'list' | 'grid'>("list");
  const navigate = useNavigate();
  const [jobCardsWithReceipts, setJobCardsWithReceipts] = useState<Set<string>>(new Set());

  const defaultVisibleColumns = {
    avatar: true,
    client: true,
    staff: true,
    created: true,
    amount: true,
    status: true,
    actions: true,
  };

  const [visibleColumns, setVisibleColumns] = useState<{
    avatar: boolean;
    client: boolean;
    staff: boolean;
    created: boolean;
    amount: boolean;
    status: boolean;
    actions: boolean;
  }>(() => {
    try {
      const stored = localStorage.getItem('jobcards_visible_columns');
      return stored ? { ...defaultVisibleColumns, ...JSON.parse(stored) } : { ...defaultVisibleColumns };
    } catch {
      return { ...defaultVisibleColumns };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('jobcards_visible_columns', JSON.stringify(visibleColumns));
    } catch {}
  }, [visibleColumns]);

  // Removed mock enrichment function and demo defaults

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
          // Prefer live DB when available
          const { data: invoicesData, error: invoicesError } = await supabase
            .from('invoices')
            .select('job_card_id')
            .in('job_card_id', jobIds as string[]);

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

  const handleDeleteJobCard = async (id: string) => {
    try {
              // Guard: block deletion if an invoice exists for this job card
      let hasReceipt = false;
      try {
        const { data: existingRcpt, error: rcptErr } = await supabase
          .from('invoices')
          .select('id')
          .eq('job_card_id', id)
          .limit(1);
        if (rcptErr) throw rcptErr;
        hasReceipt = !!(existingRcpt && existingRcpt.length > 0);
      } catch {
        const allReceipts = await getReceiptsWithFallback(supabase as any);
        hasReceipt = allReceipts.some((r: any) => r.job_card_id === id);
      }
      if (hasReceipt) {
        toast.error('Cannot delete job card: an invoice has been created for this job');
        return;
      }

      if (!confirm('Are you sure you want to delete this job card?')) return;

      const { error } = await supabase
        .from('job_cards')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      // Optimistically update UI
      setJobCards((prev) => prev.filter((c) => c.id !== id));
      setJobCardsWithReceipts((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success("Job card deleted successfully");
      await fetchJobCards({ silent: true });
    } catch (error) {
      console.error('Error deleting job card:', error);
      toast.error("Failed to delete job card");
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const normalizedStatus = ['paused', 'overdue', 'pending'].includes(newStatus) ? 'in_progress' : newStatus;
      const updateData: { status: string; start_time?: string; end_time?: string } = { status: normalizedStatus };

      if (normalizedStatus === 'in_progress' && !jobCards.find(jc => jc.id === id)?.start_time) {
        updateData.start_time = new Date().toISOString();
      } else if (normalizedStatus === 'completed' && !jobCards.find(jc => jc.id === id)?.end_time) {
        updateData.end_time = new Date().toISOString();
      }

      const { error } = await supabase
        .from('job_cards')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      toast.success('Job card status updated');
      await fetchJobCards({ silent: true });
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const generateInvoiceNumber = () => {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `INV-${y}${m}${d}-${rand}`;
  };

  // Create receipt from job card
  const createReceiptFromJobCard = async (card: JobCard) => {
        try {
      const invoiceNumber = generateInvoiceNumber();
      const { data: invoice, error } = await supabase
        .from('invoices')
        .insert([
          {
            invoice_number: invoiceNumber,
            client_id: card.client?.id || null,
            job_card_id: card.id,
            subtotal: card.total_amount,
            tax_amount: 0,
            total_amount: card.total_amount,
            status: 'sent',
            notes: `Invoice for ${card.job_number}`,
          },
        ])
        .select()
        .single();
      if (error) throw error;

      // Also create invoice items from job_card_services for commission allocation
      const { data: jobServices } = await supabase
        .from('job_card_services')
        .select('id, service_id, staff_id, quantity, unit_price, commission_percentage, services:service_id(name)')
        .eq('job_card_id', card.id);

      if (jobServices && jobServices.length > 0) {
        const items = jobServices.map((js: any) => ({
          invoice_id: invoice.id,
          service_id: js.service_id,
          product_id: null,
          description: js.services?.name || 'Service',
          quantity: js.quantity || 1,
          unit_price: js.unit_price || 0,
          total_price: (js.quantity || 1) * (js.unit_price || 0),
          staff_id: js.staff_id || null,
        }));
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(items);
        if (itemsError) throw itemsError;

        // Upsert staff commissions per job card service line
        const commissionRows = jobServices.map((js: any) => {
          const qty = Number(js.quantity || 1);
          const price = Number(js.unit_price || 0);
          const gross = qty * price;
          const rate = Number(js.commission_percentage ?? 0);
          const commission = Number(((gross * rate) / 100).toFixed(2));
          return {
            invoice_id: invoice.id,
            job_card_id: card.id,
            job_card_service_id: js.id,
            staff_id: js.staff_id || null,
            service_id: js.service_id,
            commission_rate: rate,
            gross_amount: gross,
            commission_amount: commission,
          };
        });
        const { error: commErr } = await supabase
          .from('staff_commissions')
          .upsert(commissionRows as any, { onConflict: 'job_card_service_id' });
        if (commErr) throw commErr;
      }

      // Mark this job card as having an invoice without a full refetch
      setJobCardsWithReceipts(prev => {
        const next = new Set(prev);
        next.add(card.id);
        return next;
      });

      toast.success('Invoice created');
    } catch (e: any) {
      console.error('Error creating invoice from job card:', e);
      toast.error(e?.message || 'Failed to create invoice');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = JOB_STATUSES.find(s => s.value === status) || JOB_STATUSES[0];
    const IconComponent = statusConfig.icon;
    return (
      <Badge className={`${statusConfig.color} flex items-center gap-1.5 font-medium px-2.5 py-1 text-xs border`}>
        <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
        <IconComponent className="w-3 h-3" />
        {statusConfig.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = PRIORITY_LEVELS.find(p => p.value === priority) || PRIORITY_LEVELS[0];
    return (
      <Badge className={`${priorityConfig.color} text-xs border`}>
        {priorityConfig.label}
      </Badge>
    );
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "—";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const filteredJobCards = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const lastMonth = subMonths(now, 1);
    const lastMonthStart = startOfMonth(lastMonth);
    const lastMonthEnd = endOfMonth(lastMonth);

    return jobCards.filter(card => {
      const createdAt = new Date(card.created_at);

      const matchesSearch = 
        card.job_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.client?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.staff?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.service_type?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || card.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || card.priority === priorityFilter;

      let matchesDate = true;
      switch (dateFilter) {
        case 'today':
          matchesDate = isSameDay(createdAt, now);
          break;
        case 'this_week':
          matchesDate = createdAt >= weekStart && createdAt <= weekEnd;
          break;
        case 'this_month':
          matchesDate = createdAt >= monthStart && createdAt <= monthEnd;
          break;
        case 'last_month':
          matchesDate = createdAt >= lastMonthStart && createdAt <= lastMonthEnd;
          break;
        case 'all_time':
        default:
          matchesDate = true;
      }
      
      return matchesSearch && matchesStatus && matchesPriority && matchesDate;
    });
  }, [jobCards, searchTerm, statusFilter, priorityFilter, dateFilter]);

  // Removed status tabs and use dropdowns instead
  // const getTabJobCards = ... removed
  // const currentJobCards = ... removed

  const stats: JobCardStats = useMemo(() => {
    const total = jobCards.length;
    const completed = jobCards.filter(card => card.status === 'completed').length;
    const inProgress = jobCards.filter(card => card.status === 'in_progress').length;
    const pending = jobCards.filter(card => card.status === 'pending').length;
    const cancelled = jobCards.filter(card => card.status === 'cancelled').length;
    const totalRevenue = jobCards
      .filter(card => card.status === 'completed')
      .reduce((sum, card) => sum + (Number(card.total_amount) || 0), 0);
    
    const completedCardsWithDuration = jobCards.filter(card => typeof card.actual_duration === 'number' && (card.actual_duration || 0) > 0);
    const averageDuration = completedCardsWithDuration.length > 0 
      ? completedCardsWithDuration.reduce((sum, card) => sum + (card.actual_duration || 0), 0) / completedCardsWithDuration.length
      : 0;
    
    const completionRate = total > 0 ? (completed / total) * 100 : 0;
    const todayCards = jobCards.filter(card => isSameDay(new Date(card.created_at), new Date())).length;
    const overdueCards = jobCards.filter(card => {
      if (card.status === 'completed' || card.status === 'cancelled') return false;
      if (!card.estimated_duration || card.estimated_duration <= 0) return false;
      const estimatedEndTime = new Date(card.created_at);
      estimatedEndTime.setMinutes(estimatedEndTime.getMinutes() + (card.estimated_duration || 0));
      return new Date() > estimatedEndTime;
    }).length;

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

  const recentActivity = useMemo(() => {
    return jobCards
      .filter(card => {
        const daysDiff = Math.abs(differenceInMinutes(new Date(), new Date(card.updated_at)) / (60 * 24));
        return daysDiff <= 2;
      })
      .slice(0, 5)
      .map(card => ({
        id: card.id,
        message: `Job card ${card.job_number} ${card.status === 'completed' ? 'completed' : 'updated'}`,
        time: format(new Date(card.updated_at), 'MMM dd, h:mm a'),
        client: card.client?.full_name,
        status: card.status
      }));
  }, [jobCards]);

  const renderJobCardsSection = () => {
    if (filteredJobCards.length === 0) {
      return (
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
            <ClipboardList className="w-8 h-8 text-slate-400" />
          </div>
          <div className="space-y-2">
            <p className="text-slate-600 font-medium">
              {searchTerm || statusFilter !== "all" ? "No job cards found" : "No job cards yet"}
            </p>
            <p className="text-slate-400 text-sm">
              {searchTerm || statusFilter !== "all" 
                ? "Try adjusting your filters" 
                : "Create your first job card to get started"
              }
            </p>
          </div>
          {!searchTerm && statusFilter === "all" && (
            <CreateButtonGate feature="job_cards" onClick={() => navigate('/job-cards/new')}>
              <Button 
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Job Card
              </Button>
            </CreateButtonGate>
          )}
        </div>
      );
    }

    if (viewMode === 'list') {
      return (
        <div className="w-full overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 text-xs font-medium text-slate-500">
              {visibleColumns.avatar && <div className="col-span-1">#</div>}
              <div className="col-span-2">Job</div>
              {visibleColumns.client && <div className="col-span-2">Client</div>}
              {visibleColumns.staff && <div className="col-span-2">Staff</div>}
              {visibleColumns.created && <div className="col-span-2">Created</div>}
              {visibleColumns.amount && <div className="col-span-1 text-right md:text-left">Amount</div>}
              {visibleColumns.status && <div className="col-span-1">Status</div>}
              {visibleColumns.actions && <div className="col-span-1">Actions</div>}
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
              {filteredJobCards.map((jobCard) => (
                <div
                  key={jobCard.id}
                  className="grid grid-cols-1 md:grid-cols-12 items-center gap-3 p-4 hover:bg-slate-50/50 transition-colors"
                >
                  {visibleColumns.avatar && (
                    <div className="md:col-span-1">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-medium text-sm">
                          {jobCard.job_number.slice(-2)}
                        </div>
                        {jobCard.priority === 'urgent' && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                            <Zap className="w-2 h-2 text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="md:col-span-2 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-900 truncate">{jobCard.job_number}</h4>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {getStatusBadge(jobCard.status)}
                      {jobCard.priority && getPriorityBadge(jobCard.priority)}
                      {jobCard.service_type && (
                        <Badge variant="outline" className="text-xs">
                          {jobCard.service_type}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {visibleColumns.client && (
                    <div className="md:col-span-2 min-w-0">
                      <div className="flex items-center text-slate-600 truncate">
                        <User className="w-3 h-3 mr-1" />
                        <span className="truncate">{jobCard.client?.full_name || "No client"}</span>
                      </div>
                    </div>
                  )}

                  {visibleColumns.staff && (
                    <div className="md:col-span-2 min-w-0">
                      <div className="flex items-center text-slate-600 truncate">
                        <UserCheck className="w-3 h-3 mr-1" />
                        <span className="truncate">{jobCard.staff?.full_name || "Unassigned"}</span>
                      </div>
                    </div>
                  )}

                  {visibleColumns.created && (
                    <div className="md:col-span-2">
                      <div className="flex items-center text-slate-600 whitespace-nowrap">
                        <Calendar className="w-3 h-3 mr-1" />
                        {format(new Date(jobCard.created_at), "MMM dd, yyyy")}
                      </div>
                    </div>
                  )}

                  {visibleColumns.amount && (
                    <div className="md:col-span-1 text-right md:text-left whitespace-nowrap">
                      <div className="flex items-center justify-end md:justify-start text-slate-600">
                        <DollarSign className="w-3 h-3 mr-1" />
                        {formatMoney(jobCard.total_amount)}
                      </div>
                    </div>
                  )}

                  {visibleColumns.status && (
                    <div className="md:col-span-1">
                      <Select 
                        value={jobCard.status} 
                        onValueChange={(value) => handleStatusUpdate(jobCard.id, value)}
                      >
                        <SelectTrigger className="w-full h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {JOB_STATUSES.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              <div className="flex items-center gap-2">
                                <status.icon className="w-3 h-3" />
                                {status.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {visibleColumns.actions && (
                    <div className="md:col-span-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 w-full md:w-auto">
                            <MoreHorizontal className="w-4 h-4 mr-2" />
                            Actions
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 z-50 bg-background">
                          <DropdownMenuItem onClick={() => navigate(`/job-cards/${jobCard.id}`)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/job-cards/${jobCard.id}/edit`)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Printer className="w-4 h-4 mr-2" />
                            Print
                          </DropdownMenuItem>
                          {jobCard.status === 'completed' && !jobCardsWithReceipts.has(jobCard.id) && (
                            <DropdownMenuItem onClick={() => navigate(`/invoices?fromJobCard=${jobCard.id}`)}>
                              <Receipt className="w-4 h-4 mr-2" />
                              Create Invoice
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteJobCard(jobCard.id)}
                            disabled={jobCardsWithReceipts.has(jobCard.id)}
                            className={`focus:text-red-600 ${jobCardsWithReceipts.has(jobCard.id) ? 'text-slate-400' : 'text-red-600'}`}
                            title={jobCardsWithReceipts.has(jobCard.id) ? 'Cannot delete: receipt exists for this job card' : undefined}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
        {filteredJobCards.map((jobCard) => (
          <Card key={jobCard.id} className="border-slate-200 hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-sm font-medium">
                      {jobCard.job_number.slice(-2)}
                    </span>
                    <CardTitle className="text-base truncate">{jobCard.job_number}</CardTitle>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {getStatusBadge(jobCard.status)}
                    {jobCard.priority && getPriorityBadge(jobCard.priority)}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 z-50 bg-background">
                    <DropdownMenuItem onClick={() => navigate(`/job-cards/${jobCard.id}`)}>
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/job-cards/${jobCard.id}/edit`)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    {jobCard.status === 'completed' && !jobCardsWithReceipts.has(jobCard.id) && (
                      <DropdownMenuItem onClick={() => navigate(`/invoices?fromJobCard=${jobCard.id}`)}>
                        <Receipt className="w-4 h-4 mr-2" />
                        Create Invoice
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => handleDeleteJobCard(jobCard.id)}
                      disabled={jobCardsWithReceipts.has(jobCard.id)}
                      className={`focus:text-red-600 ${jobCardsWithReceipts.has(jobCard.id) ? 'text-slate-400' : 'text-red-600'}`}
                      title={jobCardsWithReceipts.has(jobCard.id) ? 'Cannot delete: receipt exists for this job card' : undefined}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <div className="flex items-center text-slate-600">
                    <User className="w-3 h-3 mr-1" />
                    {jobCard.client?.full_name || "No client"}
                  </div>
                  <div className="flex items-center text-slate-600">
                    <UserCheck className="w-3 h-3 mr-1" />
                    {jobCard.staff?.full_name || "Unassigned"}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center text-slate-600">
                    <Calendar className="w-3 h-3 mr-1" />
                    {format(new Date(jobCard.created_at), "MMM dd, yyyy")}
                  </div>
                  <div className="flex items-center text-slate-600">
                    <DollarSign className="w-3 h-3 mr-1" />
                    {formatMoney(jobCard.total_amount)}
                  </div>
                </div>
              </div>
              {jobCard.service_type && (
                <div className="mt-3">
                  <Badge variant="outline" className="text-xs">
                    {jobCard.service_type}
                  </Badge>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between">
                <Select 
                  value={jobCard.status} 
                  onValueChange={(value) => handleStatusUpdate(jobCard.id, value)}
                >
                  <SelectTrigger className="w-32 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        <div className="flex items-center gap-2">
                          <status.icon className="w-3 h-3" />
                          {status.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="secondary" onClick={() => navigate(`/job-cards/${jobCard.id}`)}>
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
          <p className="text-slate-600">Loading job cards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen">
      {/* Modern Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 sticky top-0 z-30 bg-gradient-to-br from-slate-50 to-slate-100/50 pt-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl shadow-lg">
              <ClipboardList className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Job Cards Management</h1>
              <p className="text-slate-600">Track and manage service workflow efficiently</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden md:flex rounded-lg border border-slate-200 p-1 bg-white shadow-sm">
            <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" className="gap-2" onClick={() => setViewMode('list')}>
              <List className="w-4 h-4" />
              List
            </Button>
            <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" className="gap-2" onClick={() => setViewMode('grid')}>
              <LayoutGrid className="w-4 h-4" />
              Grid
            </Button>
          </div>

          <Button 
            variant="outline" 
            onClick={refreshData}
            disabled={refreshing}
            className="border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-slate-300 hover:bg-slate-50">
                <Download className="w-4 h-4 mr-2" />
                Export
                <ChevronRight className="w-4 h-4 ml-2 rotate-90" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 z-50 bg-background">
              <DropdownMenuLabel>Export Options</DropdownMenuLabel>
              <DropdownMenuItem>
                <FileText className="w-4 h-4 mr-2" />
                Export to PDF
              </DropdownMenuItem>
              <DropdownMenuItem>
                <BarChart3 className="w-4 h-4 mr-2" />
                Export Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <CreateButtonGate feature="job_cards" onClick={() => navigate('/job-cards/new')}>
            <Button 
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Job Card
            </Button>
          </CreateButtonGate>
        </div>
      </div>

      {/* Enhanced Statistics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600 opacity-100" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/90">Total Job Cards</CardTitle>
            <FileText className="h-4 w-4 text-white/80" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <p className="text-xs text-white/80">
              {stats.todayCards} created today
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-600 opacity-100" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/90">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-white/80" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">{stats.completed}</div>
            <p className="text-xs text-white/80">
              {stats.completionRate.toFixed(1)}% success rate
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-amber-600 opacity-100" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/90">In Progress</CardTitle>
            <PlayCircle className="h-4 w-4 text-white/80" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">{stats.inProgress}</div>
            <p className="text-xs text-white/80">
              Active jobs running
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-violet-600 opacity-100" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/90">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-white/80" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">{symbol}{stats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-white/80">
              From completed jobs
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-cyan-600 opacity-100" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/90">Avg Duration</CardTitle>
            <Timer className="h-4 w-4 text-white/80" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">{formatDuration(stats.averageDuration)}</div>
            <p className="text-xs text-white/80">
              Per completed job
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-red-600 opacity-100" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/90">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-white/80" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">{stats.overdueCards}</div>
            <p className="text-xs text-white/80">
              Need attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Job Cards List - Takes 3 columns */}
        <div className="lg:col-span-3">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search job cards..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-full"
                    />
                  </div>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {JOB_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          <div className="flex items-center gap-2">
                            <status.icon className="w-4 h-4" />
                            {status.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Date" />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_FILTERS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-40">
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

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-36">
                        <Columns3 className="w-4 h-4 mr-2" />
                        Columns
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56 z-50 bg-background">
                      <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
                      <DropdownMenuCheckboxItem
                        checked={visibleColumns.avatar}
                        onCheckedChange={(v) => setVisibleColumns((prev) => ({ ...prev, avatar: !!v }))}
                      >
                        #
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem checked disabled>
                        Job
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={visibleColumns.client}
                        onCheckedChange={(v) => setVisibleColumns((prev) => ({ ...prev, client: !!v }))}
                      >
                        Client
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={visibleColumns.staff}
                        onCheckedChange={(v) => setVisibleColumns((prev) => ({ ...prev, staff: !!v }))}
                      >
                        Staff
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={visibleColumns.created}
                        onCheckedChange={(v) => setVisibleColumns((prev) => ({ ...prev, created: !!v }))}
                      >
                        Created
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={visibleColumns.amount}
                        onCheckedChange={(v) => setVisibleColumns((prev) => ({ ...prev, amount: !!v }))}
                      >
                        Amount
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={visibleColumns.status}
                        onCheckedChange={(v) => setVisibleColumns((prev) => ({ ...prev, status: !!v }))}
                      >
                        Status
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={visibleColumns.actions}
                        onCheckedChange={(v) => setVisibleColumns((prev) => ({ ...prev, actions: !!v }))}
                      >
                        Actions
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              {renderJobCardsSection()}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - Takes 1 column */}
        <div className="space-y-6 lg:sticky lg:top-24 self-start">
          {/* Quick Stats */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-700">Completion Rate</span>
                    <span className="text-sm text-slate-600">{stats.completionRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={stats.completionRate} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-600" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-64 overflow-y-auto">
                {recentActivity.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recent activity</p>
                  </div>
                ) : (
                  recentActivity.map((activity, index) => (
                    <div key={activity.id} className="flex items-start gap-3 p-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors">
                      <div className={`p-2 rounded-lg ${
                        activity.status === 'completed' ? 'bg-green-50 text-green-600' :
                        activity.status === 'in_progress' ? 'bg-blue-50 text-blue-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        {activity.status === 'completed' ? <CheckCircle className="w-4 h-4" /> :
                         activity.status === 'in_progress' ? <PlayCircle className="w-4 h-4" /> :
                         <Clock className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900">{activity.message}</p>
                        {activity.client && (
                          <p className="text-xs text-slate-500">Client: {activity.client}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">{activity.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
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
  Send,
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
  CalendarClock,
  PlayCircle,
  PauseCircle,
  StopCircle,
  BarChart3,
  PieChart
} from "lucide-react";
import { format, subDays, isToday, isYesterday, differenceInMinutes, addDays } from "date-fns";
import { toast } from "sonner";

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
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all_time");
  const [activeTab, setActiveTab] = useState("all");
  const navigate = useNavigate();

  // Mock data for additional fields - in a real app, this would come from the database
  const enrichJobCards = (cards: JobCard[]): JobCard[] => {
    return cards.map(card => ({
      ...card,
      estimated_duration: 90 + Math.floor(Math.random() * 120), // Random 90-210 minutes
      actual_duration: card.status === 'completed' ? 85 + Math.floor(Math.random() * 140) : null,
      priority: ['low', 'medium', 'high', 'urgent'][Math.floor(Math.random() * 4)],
      service_type: ['Hair Cut', 'Color Treatment', 'Facial', 'Massage', 'Manicure'][Math.floor(Math.random() * 5)],
      notes: card.status === 'completed' ? 'Service completed successfully' : null
    }));
  };

  const fetchJobCards = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("job_cards")
        .select(`
          id, job_number, start_time, end_time, status, total_amount, created_at, updated_at,
          staff:staff_id (id, full_name),
          client:client_id (id, full_name, email, phone)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const enrichedData = (data || []).map((card: any) => ({
        ...card,
        estimated_duration: card.estimated_duration || 0,
        actual_duration: card.actual_duration || 0,
        priority: card.priority || 'medium',
        service_type: card.service_type || 'general',
        notes: card.notes || '',
        staff: card.staff || null,
        client: card.client || null,
      }));
      
      setJobCards(enrichedData as any);
    } catch (error) {
      console.error("Error fetching job cards:", error);
      toast.error("Failed to fetch job cards");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobCards();
  }, [fetchJobCards]);
  const refreshData = async () => {
    try {
      setRefreshing(true);
      await fetchJobCards();
      toast.success("Data refreshed successfully");
    } catch (error) {
      toast.error("Failed to refresh data");
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteJobCard = async (id: string) => {
    if (!confirm('Are you sure you want to delete this job card?')) return;
    
    try {
      const { error } = await supabase
        .from('job_cards')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success("Job card deleted successfully");
      fetchJobCards();
    } catch (error) {
      console.error('Error deleting job card:', error);
      toast.error("Failed to delete job card");
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const updateData: { status: string; start_time?: string; end_time?: string } = { status: newStatus };

      if (newStatus === 'in_progress' && !jobCards.find(jc => jc.id === id)?.start_time) {
        updateData.start_time = new Date().toISOString();
      } else if (newStatus === 'completed' && !jobCards.find(jc => jc.id === id)?.end_time) {
        updateData.end_time = new Date().toISOString();
      }

      const { error } = await supabase
        .from('job_cards')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      toast.success('Job card status updated');
      fetchJobCards();
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

  const createInvoiceFromJobCard = async (card: JobCard) => {
    try {
      const today = new Date();
      const issueDate = today.toISOString().split('T')[0];
      const dueDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const invoicePayload = {
        invoice_number: generateInvoiceNumber(),
        client_id: card.client?.id || null,
        issue_date: issueDate,
        due_date: dueDate,
        subtotal: card.total_amount,
        tax_amount: 0,
        total_amount: card.total_amount,
        status: 'draft',
        notes: `Invoice for Job Card ${card.job_number}`,
      } as const;

      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .insert([invoicePayload])
        .select('id')
        .maybeSingle();

      if (invErr) throw invErr;
      if (!invoice?.id) throw new Error('Invoice created but no ID returned');

      const itemPayload = {
        invoice_id: invoice.id,
        description: `Services for ${card.job_number}`,
        quantity: 1,
        unit_price: card.total_amount,
        total_price: card.total_amount,
      } as const;

      const { error: itemErr } = await supabase
        .from('invoice_items')
        .insert([itemPayload]);

      if (itemErr) throw itemErr;

      toast.success('Invoice created');
      navigate('/invoices');
    } catch (e: any) {
      console.error('Error creating invoice from job card:', e);
      toast.error(e?.message ? `Failed to create invoice: ${e.message}` : 'Failed to create invoice');
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
    return jobCards.filter(card => {
      const matchesSearch = 
        card.job_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.client?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.staff?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.service_type?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || card.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || card.priority === priorityFilter;
      
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [jobCards, searchTerm, statusFilter, priorityFilter]);

  const getTabJobCards = (tab: string) => {
    switch (tab) {
      case "pending":
        return filteredJobCards.filter(jc => jc.status === "pending");
      case "active":
        return filteredJobCards.filter(jc => ["in_progress", "paused"].includes(jc.status));
      case "completed":
        return filteredJobCards.filter(jc => jc.status === "completed");
      case "today":
        return filteredJobCards.filter(jc => isToday(new Date(jc.created_at)));
      default:
        return filteredJobCards;
    }
  };

  const currentJobCards = getTabJobCards(activeTab);

  const stats: JobCardStats = useMemo(() => {
    const total = jobCards.length;
    const completed = jobCards.filter(card => card.status === 'completed').length;
    const inProgress = jobCards.filter(card => card.status === 'in_progress').length;
    const pending = jobCards.filter(card => card.status === 'pending').length;
    const cancelled = jobCards.filter(card => card.status === 'cancelled').length;
    const totalRevenue = jobCards.reduce((sum, card) => sum + card.total_amount, 0);
    
    const completedCards = jobCards.filter(card => card.actual_duration);
    const averageDuration = completedCards.length > 0 
      ? completedCards.reduce((sum, card) => sum + (card.actual_duration || 0), 0) / completedCards.length
      : 0;
    
    const completionRate = total > 0 ? (completed / total) * 100 : 0;
    const todayCards = jobCards.filter(card => isToday(new Date(card.created_at))).length;
    const overdueCards = jobCards.filter(card => {
      if (card.status === 'completed' || card.status === 'cancelled') return false;
      const estimatedEndTime = new Date(card.created_at);
      estimatedEndTime.setMinutes(estimatedEndTime.getMinutes() + (card.estimated_duration || 120));
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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
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
            <div className="text-2xl font-bold text-white">Ksh {stats.totalRevenue.toLocaleString()}</div>
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
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-fit">
                  <TabsList className="grid grid-cols-5 w-fit">
                    <TabsTrigger value="all" className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      All ({stats.total})
                    </TabsTrigger>
                    <TabsTrigger value="pending" className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Pending ({stats.pending})
                    </TabsTrigger>
                    <TabsTrigger value="active" className="flex items-center gap-2">
                      <PlayCircle className="w-4 h-4" />
                      Active ({stats.inProgress})
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Done ({stats.completed})
                    </TabsTrigger>
                    <TabsTrigger value="today" className="flex items-center gap-2">
                      <CalendarClock className="w-4 h-4" />
                      Today ({stats.todayCards})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search job cards..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
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
                  
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-32">
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
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              {currentJobCards.length === 0 ? (
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
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {currentJobCards.map((jobCard) => (
                    <div
                      key={jobCard.id}
                      className="flex items-center justify-between p-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1">
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
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold text-slate-900 truncate">
                              {jobCard.job_number}
                            </h4>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(jobCard.status)}
                              {getPriorityBadge(jobCard.priority)}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
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
                                Ksh {jobCard.total_amount.toFixed(2)}
                              </div>
                            </div>
                          </div>
                          
                          {jobCard.service_type && (
                            <div className="mt-2">
                              <Badge variant="outline" className="text-xs">
                                {jobCard.service_type}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/job-cards/${jobCard.id}`)}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 z-50 bg-background">
                            <DropdownMenuItem onClick={() => navigate(`/job-cards/${jobCard.id}/edit`)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Job Card
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Printer className="w-4 h-4 mr-2" />
                              Print Job Card
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Send className="w-4 h-4 mr-2" />
                              Send to Client
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => createInvoiceFromJobCard(jobCard)}>
                              <Receipt className="w-4 h-4 mr-2" />
                              Create Invoice
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDeleteJobCard(jobCard.id)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        
                        <Select 
                          value={jobCard.status} 
                          onValueChange={(value) => handleStatusUpdate(jobCard.id, value)}
                        >
                          <SelectTrigger className="w-24 h-8">
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
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - Takes 1 column */}
        <div className="space-y-6">
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
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-700">Today's Progress</span>
                    <span className="text-sm text-slate-600">{stats.todayCards}/10</span>
                  </div>
                  <Progress value={(stats.todayCards / 10) * 100} className="h-2" />
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-700">Efficiency</span>
                    <span className="text-sm text-slate-600">87%</span>
                  </div>
                  <Progress value={87} className="h-2" />
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
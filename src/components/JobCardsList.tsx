import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { 
  Search, 
  Filter, 
  Clock,
  CheckCircle,
  PlayCircle,
  PauseCircle,
  StopCircle,
  Calendar,
  Phone
} from "lucide-react";
import { toast } from "sonner";
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
  services?: Array<{
    id: string;
    name: string;
    price: number;
    duration_minutes: number;
  }>;
}

const JOB_STATUSES = [
  { value: "pending", label: "Pending", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock, dotColor: "bg-amber-500" },
  { value: "in_progress", label: "In Progress", color: "bg-blue-50 text-blue-700 border-blue-200", icon: PlayCircle, dotColor: "bg-blue-500" },
  { value: "paused", label: "Paused", color: "bg-orange-50 text-orange-700 border-orange-200", icon: PauseCircle, dotColor: "bg-orange-500" },
  { value: "completed", label: "Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle, dotColor: "bg-emerald-500" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-50 text-red-700 border-red-200", icon: StopCircle, dotColor: "bg-red-500" },
];

interface JobCardsListProps {
  onRefresh?: () => void;
}

export default function JobCardsList({ onRefresh }: JobCardsListProps) {
  const { formatCurrency } = useRegionalSettings();
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchJobCards = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch job cards with related data
      const { data: jobCardsData, error } = await supabase
        .from("job_cards")
        .select(`
          id, job_number, start_time, end_time, status, total_amount, created_at, updated_at, notes,
          staff:staff_id (id, full_name),
          client:client_id (id, full_name, email, phone)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch services for each job card
      const jobCardsWithServices = await Promise.all(
        (jobCardsData || []).map(async (jobCard) => {
          try {
            const { data: services } = await supabase
              .from("job_card_services")
              .select(`
                service_id,
                unit_price,
                duration_minutes,
                services (id, name, price, duration_minutes)
              `)
              .eq("job_card_id", jobCard.id);

            const serviceDetails = (services || [])
              .map((s: any) => s.services)
              .filter(Boolean);

            return {
              ...jobCard,
              services: serviceDetails
            };
          } catch (err) {
            console.warn(`Failed to fetch services for job card ${jobCard.id}:`, err);
            return {
              ...jobCard,
              services: []
            };
          }
        })
      );

      setJobCards(jobCardsWithServices);
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

  // Table columns for listing view
  const columns = useMemo<ColumnDef<JobCard>[]>(() => [
    {
      id: 'job_number',
      header: 'Job Card Number',
      accessor: (row) => (
        <Badge variant="outline" className="font-mono text-responsive-xs">{row.job_number}</Badge>
      ),
      sortAccessor: (row) => row.job_number,
    },
    {
      id: 'status',
      header: 'Status',
      accessor: (row) => getStatusBadge(row.status),
      sortAccessor: (row) => row.status,
      className: 'whitespace-nowrap',
    },
    {
      id: 'client',
      header: 'Client Details',
      accessor: (row) => (
        <div className="min-w-0">
          <div className="font-medium text-slate-900 truncate text-responsive-sm">{row.client?.full_name || 'Unknown Client'}</div>
          {row.client?.phone && (
            <div className="flex items-center gap-1 text-responsive-xs text-slate-500">
              <Phone className="w-3 h-3" />
              <span className="truncate">{row.client.phone}</span>
            </div>
          )}
        </div>
      ),
      sortAccessor: (row) => row.client?.full_name || '',
      className: 'max-w-[280px]'
    },
    {
      id: 'services',
      header: 'Services Details',
      accessor: (row) => (
        <div className="text-responsive-sm text-slate-700 truncate">
          {(row.services && row.services.length > 0)
            ? row.services.map((s) => s.name).join(', ')
            : '—'}
        </div>
      ),
      className: 'max-w-[380px]'
    },
    {
      id: 'staff',
      header: 'Staff',
      accessor: (row) => (
        <div className="text-responsive-sm text-slate-900">{row.staff?.full_name || 'Unassigned'}</div>
      ),
      sortAccessor: (row) => row.staff?.full_name || '',
      className: 'whitespace-nowrap'
    },
    {
      id: 'amount',
      header: 'Amount',
      accessor: (row) => (
        <div className="text-right font-medium">{formatCurrency(row.total_amount)}</div>
      ),
      sortAccessor: (row) => row.total_amount,
      className: 'text-right'
    },
  ], [formatCurrency]);

  const filteredJobCards = useMemo(() => {
    return jobCards.filter(card => {
      const matchesSearch = 
        card.job_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.client?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.staff?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (card.services || []).some(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === "all" || card.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [jobCards, searchTerm, statusFilter]);

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

  // No duration display in table view

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </div>
                <div className="w-20 h-6 bg-slate-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
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
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
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
        </div>
      </div>

      {/* Job Cards Table */}
      {filteredJobCards.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
              <Calendar className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">No job cards found</h3>
            <p className="text-slate-600 mb-4">
              {searchTerm || statusFilter !== "all" 
                ? "Try adjusting your search or filters" 
                : "Create your first job card to get started"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <DataTable<JobCard> columns={columns} data={filteredJobCards} pageSize={10} />
      )}
    </div>
  );
}
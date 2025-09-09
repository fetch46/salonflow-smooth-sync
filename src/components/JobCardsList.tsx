import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Trash2, 
  Receipt,
  Clock,
  CheckCircle,
  PlayCircle,
  PauseCircle,
  StopCircle,
  Calendar,
  Phone
} from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { toast } from "sonner";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
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
  searchTerm?: string;
  statusFilter?: string;
  viewMode?: "list" | "cards";
}

export default function JobCardsList({ onRefresh, searchTerm, statusFilter, viewMode }: JobCardsListProps) {
  const { formatCurrency } = useRegionalSettings();
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  const handleDeleteJobCard = async (id: string) => {
    if (!confirm('Are you sure you want to delete this job card?')) return;

    try {
      const { error } = await supabase
        .from('job_cards')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setJobCards(prev => prev.filter(card => card.id !== id));
      toast.success("Job card deleted successfully");
      onRefresh?.();
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
      await fetchJobCards();
      onRefresh?.();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const createInvoiceFromJobCard = async (card: JobCard) => {
    try {
      const invoiceNumber = `INV-${Date.now()}`;
      const { data: invoice, error } = await supabase
        .from('invoices')
        .insert([
          {
            invoice_number: invoiceNumber,
            client_id: card.client?.id || null,
            issue_date: new Date().toISOString().split('T')[0],
            subtotal: card.total_amount,
            tax_amount: 0,
            total_amount: card.total_amount,
            status: 'sent',
            notes: `Invoice for ${card.job_number}`,
            organization_id: null, // Will be set by RLS
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Create invoice items from job card services
      if (card.services && card.services.length > 0) {
        const items = card.services.map((service) => ({
          invoice_id: invoice.id,
          service_id: service.id,
          description: service.name,
          quantity: 1,
          unit_price: service.price,
          total_price: service.price,
        }));

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(items);

        if (itemsError) throw itemsError;
      }

      toast.success('Invoice created successfully');
      onRefresh?.();
    } catch (e: any) {
      console.error('Error creating invoice from job card:', e);
      toast.error(e?.message || 'Failed to create invoice');
    }
  };

  const filteredJobCards = useMemo(() => {
    const normalizedSearch = (searchTerm || '').toLowerCase();
    const normalizedStatus = statusFilter || 'all';
    return jobCards.filter(card => {
      const matchesSearch = 
        card.job_number.toLowerCase().includes(normalizedSearch) ||
        card.client?.full_name.toLowerCase().includes(normalizedSearch) ||
        card.staff?.full_name.toLowerCase().includes(normalizedSearch) ||
        (card.services || []).some(s => s.name.toLowerCase().includes(normalizedSearch));
      
      const matchesStatus = normalizedStatus === "all" || card.status === normalizedStatus;
      
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

  const getDuration = (startTime: string | null, endTime: string | null) => {
    if (!startTime) return null;
    const end = endTime ? new Date(endTime) : new Date();
    const start = new Date(startTime);
    const minutes = differenceInMinutes(end, start);
    
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

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
    <div className="space-y-4">
      {/* Job Cards Grid */}
      <div className="grid-responsive-cards">
        {filteredJobCards.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 mx-auto mb-3 bg-slate-100 rounded-full flex items-center justify-center">
                <Calendar className="icon-responsive-lg text-slate-400" />
              </div>
              <h3 className="text-responsive-lg font-medium text-slate-900 mb-1">No job cards found</h3>
              <p className="text-slate-600 text-responsive-sm">
                {searchTerm || statusFilter !== "all" 
                  ? "Try adjusting your search or filters" 
                  : "Create your first job card to get started"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredJobCards.map((card) => (
            <Card key={card.id} className="freshsales-card">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <Badge variant="outline" className="font-mono text-responsive-xs no-wrap-sm">
                          {card.job_number}
                        </Badge>
                        {getStatusBadge(card.status)}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-responsive-xs text-slate-500">
                          {format(new Date(card.created_at), 'MMM dd, yyyy')}
                        </div>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="font-bold text-emerald-600 text-responsive-base">
                      {formatCurrency(card.total_amount)}
                    </div>

                    {/* Client & Staff Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Client */}
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <Avatar className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0">
                          <AvatarFallback className="bg-blue-100 text-blue-600 text-responsive-xs">
                            {card.client?.full_name.split(' ').map(n => n[0]).join('') || 'C'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-900 truncate text-responsive-base">
                            {card.client?.full_name || 'Unknown Client'}
                          </div>
                          {card.client?.phone && (
                            <div className="flex items-center gap-1 text-responsive-xs text-slate-500 min-w-0">
                              <Phone className="icon-responsive-xs flex-shrink-0" />
                              <span className="truncate">{card.client.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Staff */}
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <Avatar className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0">
                          <AvatarFallback className="bg-orange-100 text-orange-600 text-responsive-xs">
                            {card.staff?.full_name.split(' ').map(n => n[0]).join('') || 'S'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-900 truncate text-responsive-base">
                            {card.staff?.full_name || 'Unassigned'}
                          </div>
                          <div className="text-responsive-xs text-slate-500">Staff Member</div>
                        </div>
                      </div>
                    </div>

                    {/* Services */}
                    {card.services && card.services.length > 0 && (
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-responsive-sm font-medium text-slate-600">Services</div>
                          <div className="ml-2 flex-1 flex flex-wrap gap-1.5 justify-end">
                            {card.services.map((service) => (
                              <Badge key={service.id} variant="secondary" className="text-responsive-xs">
                                {service.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Timing */}
                    {(card.start_time || card.end_time) && (
                      <div className="flex flex-wrap items-center gap-3 text-responsive-xs text-slate-500">
                        {card.start_time && (
                          <div className="flex items-center gap-1">
                            <Clock className="icon-responsive-xs" />
                            Started: {format(new Date(card.start_time), 'h:mm a')}
                          </div>
                        )}
                        {card.end_time && (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="icon-responsive-xs" />
                            Completed: {format(new Date(card.end_time), 'h:mm a')}
                          </div>
                        )}
                        {getDuration(card.start_time, card.end_time) && (
                          <div className="flex items-center gap-1">
                            <Clock className="icon-responsive-xs" />
                            Duration: {getDuration(card.start_time, card.end_time)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    {card.notes && (
                      <div className="text-responsive-sm text-slate-600 line-clamp-2">
                        {card.notes}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="ml-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="btn-compact-icon">
                          <MoreHorizontal className="icon-responsive-sm" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/job-cards/${card.id}`)}>
                          <Eye className="icon-responsive-sm mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/job-cards/${card.id}/edit`)}>
                          <Edit className="icon-responsive-sm mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {card.status !== 'completed' && (
                          <>
                            <DropdownMenuItem onClick={() => handleStatusUpdate(card.id, 'in_progress')}>
                              <PlayCircle className="icon-responsive-sm mr-2" />
                              Start
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusUpdate(card.id, 'completed')}>
                              <CheckCircle className="icon-responsive-sm mr-2" />
                              Complete
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem onClick={() => createInvoiceFromJobCard(card)}>
                          <Receipt className="icon-responsive-sm mr-2" />
                          Create Invoice
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteJobCard(card.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="icon-responsive-sm mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
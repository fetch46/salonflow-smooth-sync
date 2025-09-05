import React, { useState, useEffect, useMemo } from "react";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { useOrganization } from "@/lib/saas/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import PageHeader from "@/components/layout/PageHeader";
import ClientsTable from "@/components/clients/ClientsTable";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Users,
  UserPlus,
  Star,
  Eye,
  MoreVertical,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  TrendingUp,
  Activity,
  Target,
  RefreshCw,
  Download,
  ChevronRight,
  Filter,
  BarChart3,
  PieChart,
  Award,
  Heart,
  Gift,
  Crown,
  Clock,
  User,
  MessageSquare,
  CalendarClock,
  ArrowUpRight,
  ArrowDownRight,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  Info,
  Cake,
  Building2,
  Calendar as CalendarIcon,
  Zap,
  UserCheck,
  Timer,
  Sparkles,
  LayoutGrid,
  Table as TableIcon
 } from "lucide-react";
import { format as formatDate, subDays, isThisMonth, isThisYear, differenceInDays } from "date-fns";

interface Client {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  address?: string;
  date_of_birth?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  client_status?: string;
  preferred_technician_id?: string;
  total_spent?: number;
  total_visits?: number;
  last_visit_date?: string;
  loyalty_tier?: string;
  referral_source?: string;
  emergency_contact?: string;
  preferences?: string;
  anniversary_date?: string;
}

interface ClientStats {
  total: number;
  new: number;
  active: number;
  vip: number;
  returning: number;
  totalRevenue: number;
  averageSpent: number;
  averageVisits: number;
  retentionRate: number;
  newThisMonth: number;
}

const CLIENT_STATUSES = [
  { value: "new", label: "New", color: "bg-blue-50 text-blue-700 border-blue-200", icon: UserPlus },
  { value: "active", label: "Active", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle },
  { value: "vip", label: "VIP", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Crown },
  { value: "inactive", label: "Inactive", color: "bg-red-50 text-red-700 border-red-200", icon: AlertTriangle }
];

const LOYALTY_TIERS = [
  { name: "Bronze", color: "from-orange-600 to-orange-700", textColor: "text-orange-700", minSpent: 0 },
  { name: "Silver", color: "from-gray-400 to-gray-500", textColor: "text-gray-700", minSpent: 300 },
  { name: "Gold", color: "from-yellow-400 to-yellow-500", textColor: "text-yellow-700", minSpent: 600 },
  { name: "Platinum", color: "from-amber-500 to-yellow-600", textColor: "text-amber-700", minSpent: 1200 },
  { name: "VIP", color: "from-pink-500 to-rose-500", textColor: "text-pink-700", minSpent: 2000 }
];

const SORT_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "recent", label: "Recent" },
  { value: "spent", label: "Total Spent" },
  { value: "visits", label: "Visits" },
  { value: "last_visit", label: "Last Visit" }
];

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [activeTab, setActiveTab] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    address: "",
    date_of_birth: "",
    notes: "",
    emergency_contact: "",
    anniversary_date: "",
    preferences: "",
    referral_source: ""
  });

  // View mode toggle (cards | table)
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");
  const navigate = useNavigate();
  const { organization } = useOrganization();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') === '1') {
      setEditingClient(null);
      setIsModalOpen(true);
    }
  }, []);

  const handleViewProfile = (id: string) => navigate(`/clients/${id}`);
  const handleBookAppointment = (c: Client) => {
    const params = new URLSearchParams({
      name: c.full_name || "",
      email: c.email || "",
      phone: c.phone || "",
    });
    navigate(`/appointments/new?${params.toString()}`);
  };

  const { symbol, format } = useOrganizationCurrency();
  const formatMoney = (n: number) => format(n || 0);
  const formatLastVisit = (d?: string) => getDaysSinceLastVisit(d);


  useEffect(() => {
    fetchClients();
  }, [organization?.id]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      try {
        let query = supabase.from("clients").select("*");
        if (organization?.id) {
          query = query.eq("organization_id", organization.id);
        }
        const { data, error } = await query.order("created_at", { ascending: false });
        if (error) throw error;

        // If Supabase returns no rows, try fallback to local storage for demo/offline data
        if (!data || data.length === 0) {
          const storage = JSON.parse(localStorage.getItem('mockDb') || '{}');
          const localClients = (storage.clients || []) as any[];
          const filtered = organization?.id ? localClients.filter(c => c.organization_id === organization.id) : localClients;
          setClients(filtered);
        } else {
          setClients(data || []);
        }
      } catch (e: any) {
        // Fallback to local storage mock for demo/offline
        const storage = JSON.parse(localStorage.getItem('mockDb') || '{}');
        const localClients = (storage.clients || []) as any[];
        const filtered = organization?.id ? localClients.filter(c => c.organization_id === organization.id) : localClients;
        setClients(filtered);
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error("Failed to fetch clients");
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      setRefreshing(true);
      await fetchClients();
      toast.success("Data refreshed successfully");
    } catch (error) {
      toast.error("Failed to refresh data");
    } finally {
      setRefreshing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Import text utilities
      const { toSentenceCase, isValidPhoneNumber } = await import('@/utils/textUtils');
      
      // Enforce mobile number is required for all clients
      const trimmedPhone = (formData.phone || '').trim();
      if (!trimmedPhone) {
        toast.error('Mobile number is required');
        return;
      }
      
      // Validate phone number format
      if (!isValidPhoneNumber(trimmedPhone)) {
        toast.error('Please enter a valid mobile number');
        return;
      }
      
      // Auto sentence case for client name
      const formattedName = toSentenceCase(formData.full_name.trim());
      if (!formattedName) {
        toast.error('Client name is required');
        return;
      }
      if (trimmedPhone) {
        let dupQuery = supabase
          .from('clients')
          .select('id, phone')
          .eq('phone', trimmedPhone);
        if (organization?.id) {
          dupQuery = dupQuery.eq('organization_id', organization.id);
        }
        const { data: dup } = await dupQuery.maybeSingle();
        if (!editingClient && dup?.id) {
          toast.error('A client with this mobile number already exists');
          return;
        }
        if (editingClient && dup?.id && dup.id !== editingClient.id) {
          toast.error('Another client with this mobile number already exists');
          return;
        }
      }

      const basePayload = {
        full_name: formattedName,
        email: formData.email || null,
        phone: trimmedPhone,
        address: formData.address || null,
        notes: formData.notes || null,
      };

      if (editingClient) {
        const updatePayload = {
          ...basePayload,
          date_of_birth: formData.date_of_birth ? formData.date_of_birth : null,
        };
        try {
          const { error } = await supabase
            .from("clients")
            .update(updatePayload)
            .eq("id", editingClient.id);
          if (error) throw error as any;
        } catch (e: any) {
          const message = e?.message || '';
          const code = e?.code || '';
          const isUnique = code === '23505' || /duplicate key value violates unique constraint/i.test(message);
          if (isUnique) {
            toast.error('Another client with this mobile number already exists in your organization');
            return;
          }
          // Fallback local update (non-unique errors only)
          const storage = JSON.parse(localStorage.getItem('mockDb') || '{}');
          storage.clients = (storage.clients || []).map((c: any) => c.id === editingClient.id ? { ...c, ...updatePayload, updated_at: new Date().toISOString() } : c);
          localStorage.setItem('mockDb', JSON.stringify(storage));
        }
      } else {
        const insertPayload: any = {
          ...basePayload,
          // Intentionally exclude date_of_birth and any non-existent columns on create
        };
        if (organization?.id) {
          insertPayload.organization_id = organization.id;
        }
        try {
          const { error } = await supabase
            .from("clients")
            .insert([insertPayload]);
          if (error) throw error as any;
        } catch (e: any) {
          const message = e?.message || '';
          const code = e?.code || '';
          const isUnique = code === '23505' || /duplicate key value violates unique constraint/i.test(message);
          if (isUnique) {
            toast.error('A client with this mobile number already exists in your organization');
            return;
          }
          // Fallback: create locally for non-unique errors (e.g., offline/demo)
          const storage = JSON.parse(localStorage.getItem('mockDb') || '{}');
          const nowIso = new Date().toISOString();
          const localClient = { id: `client_${Date.now()}_${Math.random().toString(36).slice(2,9)}`, created_at: nowIso, updated_at: nowIso, client_status: 'active', total_spent: 0, total_visits: 0, ...insertPayload };
          storage.clients = [...(storage.clients || []), localClient];
          localStorage.setItem('mockDb', JSON.stringify(storage));
        }
      }

      toast.success(editingClient ? "Client updated successfully" : "Client created successfully");
      fetchClients();
      resetForm();
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving client:", error);
      toast.error("Failed to save client");
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      email: "",
      phone: "",
      address: "",
      date_of_birth: "",
      notes: "",
      emergency_contact: "",
      anniversary_date: "",
      preferences: "",
      referral_source: ""
    });
    setEditingClient(null);
  };

  const handleEdit = (client: Client) => {
    setFormData({
      full_name: client.full_name,
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      date_of_birth: client.date_of_birth || "",
      notes: client.notes || "",
      emergency_contact: client.emergency_contact || "",
      anniversary_date: client.anniversary_date || "",
      preferences: client.preferences || "",
      referral_source: client.referral_source || ""
    });
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this client?")) {
      try {
        try {
          const { error } = await supabase.from("clients").delete().eq("id", id);
          if (error) throw error;
        } catch {
          const storage = JSON.parse(localStorage.getItem('mockDb') || '{}');
          storage.clients = (storage.clients || []).filter((c: any) => c.id !== id);
          localStorage.setItem('mockDb', JSON.stringify(storage));
        }
        toast.success("Client deleted successfully");
        fetchClients();
      } catch (error) {
        console.error("Error deleting client:", error);
        toast.error("Failed to delete client");
      }
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getLoyaltyTier = (totalSpent: number) => {
    return LOYALTY_TIERS
      .slice()
      .reverse()
      .find(tier => totalSpent >= tier.minSpent) || LOYALTY_TIERS[0];
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = CLIENT_STATUSES.find(s => s.value === status) || CLIENT_STATUSES[1];
    const IconComponent = statusConfig.icon;
    return (
      <Badge className={`${statusConfig.color} flex items-center gap-1.5 font-medium px-2.5 py-1 text-xs border`}>
        <IconComponent className="w-3 h-3" />
        {statusConfig.label}
      </Badge>
    );
  };

  const getDaysSinceLastVisit = (lastVisitDate?: string) => {
    if (!lastVisitDate) return "Never";
    const days = differenceInDays(new Date(), new Date(lastVisitDate));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  const filteredClients = useMemo(() => {
    return clients
      .filter((client) => {
        const name = (client.full_name || "").toString();
        const email = (client.email || "").toString();
        const phone = (client.phone || "").toString();
        const matchesSearch =
          name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          phone.includes(searchTerm);
        const matchesStatus = statusFilter === "all" || client.client_status === statusFilter;
        const matchesTier =
          tierFilter === "all" || getLoyaltyTier(client.total_spent || 0).name === tierFilter;
        return matchesSearch && matchesStatus && matchesTier;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "recent": {
            const ta = new Date(a.created_at || 0).getTime();
            const tb = new Date(b.created_at || 0).getTime();
            return tb - ta;
          }
          case "spent":
            return (b.total_spent || 0) - (a.total_spent || 0);
          case "visits":
            return (b.total_visits || 0) - (a.total_visits || 0);
          case "last_visit": {
            const la = a.last_visit_date ? new Date(a.last_visit_date).getTime() : -Infinity;
            const lb = b.last_visit_date ? new Date(b.last_visit_date).getTime() : -Infinity;
            return lb - la;
          }
          default: {
            const na = (a.full_name || "").toString();
            const nb = (b.full_name || "").toString();
            return na.localeCompare(nb);
          }
        }
      });
  }, [clients, searchTerm, statusFilter, tierFilter, sortBy]);

  const getTabClients = (tab: string) => {
    switch (tab) {
      case "new":
        return filteredClients.filter(c => c.client_status === "new" || isThisMonth(new Date(c.created_at)));
      case "vip":
        return filteredClients.filter(c => c.client_status === "vip" || (c.total_spent || 0) > 1000);
      case "inactive":
        return filteredClients.filter(c => {
          if (!c.last_visit_date) return true;
          return differenceInDays(new Date(), new Date(c.last_visit_date)) > 60;
        });
      default:
        return filteredClients;
    }
  };

  const currentClients = getTabClients(activeTab);

  const stats: ClientStats = useMemo(() => {
    const total = clients.length;
    const newClients = clients.filter(c => isThisMonth(new Date(c.created_at))).length;
    const activeClients = clients.filter(c => c.client_status === "active").length;
    const vipClients = clients.filter(c => c.client_status === "vip" || (c.total_spent || 0) > 1000).length;
    const returningClients = clients.filter(c => (c.total_visits || 0) > 1).length;
    const totalRevenue = clients.reduce((sum, c) => sum + (c.total_spent || 0), 0);
    const averageSpent = total > 0 ? totalRevenue / total : 0;
    const averageVisits = total > 0 ? clients.reduce((sum, c) => sum + (c.total_visits || 0), 0) / total : 0;
    const retentionRate = total > 0 ? (returningClients / total) * 100 : 0;
    
    return {
      total,
      new: newClients,
      active: activeClients,
      vip: vipClients,
      returning: returningClients,
      totalRevenue,
      averageSpent,
      averageVisits,
      retentionRate,
      newThisMonth: newClients
    };
  }, [clients]);

  const topClients = useMemo(() => {
    return clients
      .filter(c => c.total_spent && c.total_spent > 0)
      .sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0))
      .slice(0, 5);
  }, [clients]);

  const recentActivity = useMemo(() => {
    return clients
      .filter(c => c.last_visit_date)
      .sort((a, b) => new Date(b.last_visit_date!).getTime() - new Date(a.last_visit_date!).getTime())
      .slice(0, 5)
      .map(client => ({
        id: client.id,
        name: client.full_name,
        action: "Visited salon",
        time: getDaysSinceLastVisit(client.last_visit_date),
        amount: client.total_spent || 0,
        tier: getLoyaltyTier(client.total_spent || 0)
      }));
  }, [clients]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-slate-600">Loading clients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen">
      <PageHeader
        title="Client Management"
        subtitle="Manage client relationships and track customer analytics"
        icon={<Users className="h-5 w-5" />}
        actions={
          <>
            <Button 
              variant="outline"
              onClick={refreshData}
              disabled={refreshing}
              className="btn-compact"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="btn-compact">
                  <Download className="w-4 h-4 mr-1.5" />
                  Export
                  <ChevronRight className="w-4 h-4 ml-1 rotate-90" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Export Options</DropdownMenuLabel>
                <DropdownMenuItem>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Client Report
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <PieChart className="w-4 h-4 mr-2" />
                  Analytics Report
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Mail className="w-4 h-4 mr-2" />
                  Mailing List
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="btn-compact"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Client
            </Button>
          </>
        }
      />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
              <DialogHeader className="pb-4 border-b">
                <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  {editingClient ? "Edit Client" : "Add New Client"}
                </DialogTitle>
                <DialogDescription className="text-slate-600">
                  {editingClient ? "Update client information and preferences" : "Add a new client to your database"}
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-600" />
                    Basic Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="full_name">Full Name *</Label>
                      <Input 
                        id="full_name" 
                        value={formData.full_name} 
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} 
                        placeholder="e.g., Sarah Johnson"
                        required 
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input 
                        id="email" 
                        type="email"
                        value={formData.email} 
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                        placeholder="sarah@example.com"
                      />
                    </div>
                    
                     <div>
                       <Label htmlFor="phone">Mobile Number *</Label>
                       <Input 
                         id="phone" 
                         value={formData.phone} 
                         onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
                         placeholder="+1 (555) 123-4567"
                         required
                       />
                       <p className="text-xs text-muted-foreground mt-1">
                         Mobile number is required for all clients
                       </p>
                     </div>
                    
                    {editingClient && (
                      <div>
                        <Label htmlFor="date_of_birth">Date of Birth</Label>
                        <Input 
                          id="date_of_birth" 
                          type="date"
                          value={formData.date_of_birth} 
                          onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} 
                        />
                      </div>
                    )}
                    
                    {editingClient && (
                      <div>
                        <Label htmlFor="anniversary_date">Anniversary Date</Label>
                        <Input 
                          id="anniversary_date" 
                          type="date"
                          value={formData.anniversary_date} 
                          onChange={(e) => setFormData({ ...formData, anniversary_date: e.target.value })} 
                        />
                      </div>
                    )}
                    
                    <div className="md:col-span-2">
                      <Label htmlFor="address">Address</Label>
                      <Textarea 
                        id="address" 
                        value={formData.address} 
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })} 
                        placeholder="123 Main St, City, State 12345"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-pink-600" />
                    Preferences & Details
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="referral_source">How did you hear about us?</Label>
                      <Select value={formData.referral_source} onValueChange={(value) => setFormData({ ...formData, referral_source: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Social Media">Social Media</SelectItem>
                          <SelectItem value="Friend Referral">Friend Referral</SelectItem>
                          <SelectItem value="Google Search">Google Search</SelectItem>
                          <SelectItem value="Walk-in">Walk-in</SelectItem>
                          <SelectItem value="Advertisement">Advertisement</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="emergency_contact">Emergency Contact</Label>
                      <Input 
                        id="emergency_contact" 
                        value={formData.emergency_contact} 
                        onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })} 
                        placeholder="Name and phone number"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <Label htmlFor="preferences">Service Preferences</Label>
                      <Textarea 
                        id="preferences" 
                        value={formData.preferences} 
                        onChange={(e) => setFormData({ ...formData, preferences: e.target.value })} 
                        placeholder="Preferred services, stylist, allergies, special requests..."
                        rows={2}
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea 
                        id="notes" 
                        value={formData.notes} 
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
                        placeholder="Additional notes about the client..."
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                  >
                    {editingClient ? "Update Client" : "Add Client"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

      {/* Enhanced Statistics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Card className="bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
            <p className="text-xs text-blue-600">
              {stats.active} active
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{formatMoney(stats.totalRevenue)}</div>
            <p className="text-xs text-green-600">
              From all clients
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-amber-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-700">Avg Spent</CardTitle>
            <Target className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">{formatMoney(stats.averageSpent)}</div>
            <p className="text-xs text-amber-600">
              Per client
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">VIP Clients</CardTitle>
            <Crown className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{stats.vip}</div>
            <p className="text-xs text-orange-600">
              Premium members
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-pink-700">New This Month</CardTitle>
            <UserPlus className="h-4 w-4 text-pink-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-pink-700">{stats.newThisMonth}</div>
            <p className="text-xs text-pink-600">
              Fresh faces
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-50 to-sky-50 border-cyan-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-cyan-700">Retention Rate</CardTitle>
            <Heart className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-700">{stats.retentionRate.toFixed(1)}%</div>
            <p className="text-xs text-cyan-600">
              Return clients
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Clients Table/Grid */}
      <div className="space-y-6">
        {/* Quick Actions Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-4 bg-gradient-to-r from-slate-50 to-blue-50 rounded-lg border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <UserPlus className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-slate-900">Quick Actions</h3>
              <p className="text-sm text-slate-600">Manage your client database efficiently</p>
            </div>
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={refreshData} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingClient(null);
                setIsModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Client
            </Button>
          </div>
        </div>
        {/* Main Content */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b border-slate-200">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search clients..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-full"
                  />
                </div>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {CLIENT_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        <div className="flex items-center gap-2">
                          <status.icon className="w-4 h-4" />
                          {status.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="hidden md:flex rounded-lg border border-border p-1 bg-card shadow-sm">
                  <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="sm" className="gap-2" onClick={() => setViewMode('table')}>
                    <TableIcon className="w-4 h-4" />
                    Table
                  </Button>
                  <Button variant={viewMode === 'cards' ? 'default' : 'ghost'} size="sm" className="gap-2" onClick={() => setViewMode('cards')}>
                    <LayoutGrid className="w-4 h-4" />
                    Cards
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
          {currentClients.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                <Users className="w-8 h-8 text-slate-400" />
              </div>
              <div className="space-y-2">
                <p className="text-slate-600 font-medium">
                  {searchTerm || statusFilter !== "all" ? "No clients found" : "No clients yet"}
                </p>
                <p className="text-slate-400 text-sm">
                  {searchTerm || statusFilter !== "all" 
                    ? "Try adjusting your filters" 
                    : "Add your first client to get started"
                  }
                </p>
              </div>
              {!searchTerm && statusFilter === "all" && (
                <Button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Client
                </Button>
              )}
            </div>
          ) : (
            <>{viewMode === "table" ? (
              <div className="p-6">
                <ClientsTable
                  clients={currentClients}
                  onViewProfile={handleViewProfile}
                  onBookAppointment={handleBookAppointment as any}
                  onEdit={(c) => handleEdit(c as any)}
                  onDelete={handleDelete}
                  getStatusBadge={(s) => getStatusBadge(s)}
                  formatMoney={(n) => format(n)}
                  formatLastVisit={(d) => getDaysSinceLastVisit(d)}
                />
              </div>
            ) : (
              <div className="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
                {currentClients.map((client) => {
                  const tier = getLoyaltyTier(client.total_spent || 0);
                  const initials = getInitials(client.full_name);
                  return (
                    <Card key={client.id} className="group hover:shadow-lg transition-all duration-300 border-slate-200">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${tier.color} flex items-center justify-center text-white font-semibold`}>
                              {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-slate-900 truncate">{client.full_name}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                {getStatusBadge(client.client_status || "active")}
                                <Badge className={`text-xs bg-gradient-to-r ${tier.color} text-white`}>
                                  {tier.name}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => handleViewProfile(client.id)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(client)}>
                                <Edit2 className="mr-2 h-4 w-4" />
                                Edit Client
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleBookAppointment(client)}>
                                <CalendarClock className="mr-2 h-4 w-4" />
                                Book Appointment
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Send Message
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(client.id)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-2">
                            {client.email && (
                              <div className="flex items-center text-slate-600 truncate">
                                <Mail className="w-4 h-4 mr-2 flex-shrink-0" />
                                <span className="truncate">{client.email}</span>
                              </div>
                            )}
                            {client.phone && (
                              <div className="flex items-center text-slate-600">
                                <Phone className="w-4 h-4 mr-2 flex-shrink-0" />
                                <span>{client.phone}</span>
                              </div>
                            )}
                            {client.address && (
                              <div className="flex items-center text-slate-600">
                                <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                                <span className="truncate">{client.address}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center text-slate-600">
                              <DollarSign className="w-4 h-4 mr-2" />
                              {symbol}{(client.total_spent || 0).toLocaleString()}
                            </div>
                            <div className="flex items-center text-slate-600">
                              <Calendar className="w-4 h-4 mr-2" />
                              {client.total_visits || 0} visits
                            </div>
                            <div className="flex items-center text-slate-600">
                              <Clock className="w-4 h-4 mr-2" />
                              {getDaysSinceLastVisit(client.last_visit_date)}
                            </div>
                          </div>
                        </div>
                        
                        {client.date_of_birth && (
                          <div className="flex items-center text-slate-600 text-sm pt-2 border-t">
                            <Cake className="w-4 h-4 mr-2" />
                            <span>
                              {formatDate(new Date(client.date_of_birth), "MMM dd")} birthday
                            </span>
                          </div>
                        )}
                        
                        
                        
                        {client.preferences && (
                          <div className="pt-2 border-t">
                            <div className="text-xs text-slate-500 font-medium mb-1">Preferences:</div>
                            <div className="text-xs text-slate-600 line-clamp-2">{client.preferences}</div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            </>
          )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

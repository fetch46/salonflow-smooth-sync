"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrganization } from "@/lib/saas/hooks";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { 
  Plus, 
  Search, 
  Receipt, 
  DollarSign, 
  FileText, 
  Edit2, 
  Trash2, 
  Eye, 
  Download, 
  Send, 
  Filter, 
  Calendar, 
  Users, 
  TrendingUp, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  Copy,
  Printer,
  Mail,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  ChevronDown,
  BarChart3,
  ArrowUpRight,
  Target,
  Banknote,
  FileCheck,
  Settings,
  Star,
  Zap,
  CreditCard,
  PieChart,
  Activity,
  Wallet,
  Phone,
  Building2,
  UserCheck,
  Timer,
  TrendingDown,
  X,
  Calculator,
  ClipboardList,
  Percent,
  Globe,
  Smartphone,
  Hash,
  QrCode,
  Share2
} from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval } from "date-fns";
import { toast } from "sonner";
import { 
  createInvoiceWithFallback, 
  getInvoicesWithFallback, 
  updateInvoiceWithFallback, 
  deleteInvoiceWithFallback,
  getInvoiceItemsWithFallback 
} from "@/utils/mockDatabase";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { useOrganizationTaxRate } from "@/lib/saas/hooks";
import { Database } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";
import { downloadInvoicePDF } from "@/utils/invoicePdf";
import { useRegionalSettings } from "@/hooks/useRegionalSettings";
import PageHeader from "@/components/layout/PageHeader";

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  status: string;
  due_date: string | null;
  payment_method: string | null;
  notes: string | null;
  jobcard_id: string | null;
  created_at: string;
  updated_at: string;
  commission_total?: number;
  location_id?: string | null;
}

interface InvoiceItem {
  id: string;
  invoice_id: string;
  service_id: string | null;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  staff_id: string | null;
  commission_percentage: number;
  commission_amount: number;
  total_price: number;
  staff_name?: string;
  service_name?: string;
}

interface Customer {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

interface Service {
  id: string;
  name: string;
  price: number;
}

interface Staff {
  id: string;
  full_name: string;
}

interface Jobcard {
  id: string;
  jobcard_number: string;
  customer_id: string;
  customer_name: string;
  staff_id: string;
  service_id: string;
  service_name: string;
  total_amount: number;
  status: string;
  created_at: string;
}

const INVOICE_STATUSES = [
  { value: "draft", label: "Draft", color: "bg-slate-100 text-slate-800 border-slate-200", icon: FileText, dotColor: "bg-slate-400" },
  { value: "sent", label: "Sent", color: "bg-blue-50 text-blue-700 border-blue-200", icon: Send, dotColor: "bg-blue-500" },
  { value: "paid", label: "Paid", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle, dotColor: "bg-emerald-500" },
  { value: "overdue", label: "Overdue", color: "bg-red-50 text-red-700 border-red-200", icon: AlertTriangle, dotColor: "bg-red-500" },
  { value: "cancelled", label: "Cancelled", color: "bg-gray-50 text-gray-700 border-gray-200", icon: X, dotColor: "bg-gray-400" },
  { value: "partial", label: "Partially Paid", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Timer, dotColor: "bg-amber-500" }
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: DollarSign },
  { value: "card", label: "Credit Card", icon: CreditCard },
  { value: "bank_transfer", label: "Bank Transfer", icon: TrendingUp },
  { value: "mobile_payment", label: "Mobile Payment", icon: MessageSquare }
];

const DATE_FILTERS = [
  { label: "All Time", value: "all_time" },
  { label: "Today", value: "today" },
  { label: "This Week", value: "this_week" },
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "Last 3 Months", value: "last_3_months" },
  { label: "This Year", value: "this_year" }
];

export default function Invoices() {
  const { formatCurrency, formatNumber } = useRegionalSettings();
  const orgTaxRate = useOrganizationTaxRate();
  const { organization } = useOrganization();
  const navigate = useNavigate();
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all_time");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [applyTax, setApplyTax] = useState<boolean>(true);
  const [locations, setLocations] = useState<Array<{ id: string; name: string; is_default?: boolean; is_active?: boolean }>>([]);
  const [isEditingLocation, setIsEditingLocation] = useState<boolean>(false);
  const [editLocationId, setEditLocationId] = useState<string>("");

  const safeFormatDate = (dateInput: string | Date | null | undefined, fmt: string): string => {
    const dateObj = typeof dateInput === 'string' ? new Date(dateInput) : dateInput instanceof Date ? dateInput : null;
    if (!dateObj || isNaN(dateObj.getTime())) return '—';
    return format(dateObj, fmt);
  };

  const [formData, setFormData] = useState({
    customer_id: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    due_date: "",
    payment_method: "",
    notes: "",
    jobcard_id: "",
    location_id: "",
  });

  const [newItem, setNewItem] = useState({
    service_id: "",
    description: "",
    quantity: 1,
    unit_price: "",
    discount_percentage: 0,
    staff_id: "",
    commission_percentage: 0,
  });

  const [selectedItems, setSelectedItems] = useState<InvoiceItem[]>([]);
  const [defaultLocationByStaffId, setDefaultLocationByStaffId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (organization?.id) {
      fetchInvoices();
      fetchCustomers();
      fetchServices();
      fetchStaff();
    }
  }, [organization?.id]);

  // Redirect to full-page create if coming from job card
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromJobCard = params.get('fromJobCard');
    if (fromJobCard) {
      navigate(`/invoices/new?fromJobCard=${fromJobCard}`);
    }
  }, [navigate]);

  const fetchInvoices = async () => {
    if (!organization?.id) return;
    
    try {
      setLoading(true);
      const data = await getInvoicesWithFallback(supabase);
      // Filter invoices by organization
      const orgSpecificInvoices = (data || []).filter((invoice: any) => 
        invoice.organization_id === organization?.id
      );
      setInvoices(orgSpecificInvoices || []);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      toast.error("Failed to fetch invoices");
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      setRefreshing(true);
      await fetchInvoices();
      toast.success("Data refreshed successfully");
    } catch (error) {
      toast.error("Failed to refresh data");
    } finally {
      setRefreshing(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, email, phone")
        .eq("is_active", true)
        .eq('organization_id', organization?.id || '')
        .order("full_name");

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, price")
        .eq("is_active", true)
        .eq('organization_id', organization?.id || '')
        .order("name");

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
    }
  };

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from("staff")
        .select("id, full_name")
        .eq("is_active", true)
        .eq('organization_id', organization?.id || '')
        .order("full_name");

      if (error) throw error;
      setStaff(data || []);
    } catch (error) {
      console.error("Error fetching staff:", error);
    }
  };

  const fetchLocations = async () => {
    try {
      const { data } = await supabase
        .from("business_locations")
        .select("id, name, is_default, is_active")
        .eq('organization_id', organization?.id || '')
        .order("name");
      const active = (data || []).filter((l: any) => l.is_active !== false);
      setLocations(active as any);
    } catch (error) {
      console.warn("Failed to fetch business_locations", error);
      setLocations([]);
    }
  };

  // Ensure locations are loaded for view modal and labels
  useEffect(() => {
    fetchLocations();
  }, [organization?.id]);

  useEffect(() => {
    if (formData.location_id) return;
    const preferred = locations.find((l) => (l as any).is_default) || locations[0];
    if (preferred?.id) {
      setFormData((prev) => ({ ...prev, location_id: preferred.id }));
    }
  }, [locations, formData.location_id]);

  const fetchInvoiceItems = async (invoiceId: string) => {
    try {
      const data = await getInvoiceItemsWithFallback(supabase, invoiceId);
      setInvoiceItems(data || []);
    } catch (error) {
      console.error("Error fetching invoice items:", error);
    }
  };

  const generateInvoiceNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `INV-${timestamp}`;
  };

  const addItemToInvoice = () => {
    if (!newItem.description || !newItem.unit_price) {
      toast.error("Please fill in all required fields");
      return;
    }

    const service = services.find(s => s.id === newItem.service_id);
    const staffMember = staff.find(s => s.id === newItem.staff_id);

    const unit = parseFloat(newItem.unit_price) || 0;
    const gross = newItem.quantity * unit * (newItem.discount_percentage / 100 < 1 ? (1 - newItem.discount_percentage / 100) : 1);
    const commissionPct = Number(newItem.commission_percentage || 0);

    const item = {
      id: `temp-${Date.now()}`,
      invoice_id: "",
      product_id: newItem.service_id,
      service_id: newItem.service_id,
      description: newItem.description || (service?.name || "Service"),
      quantity: newItem.quantity,
      unit_price: unit,
      discount_percentage: newItem.discount_percentage || 0,
      staff_id: newItem.staff_id || "",
      commission_percentage: commissionPct,
      // Attach default location if a staff with default is selected (used by downstream posting flows)
      location_id: newItem.staff_id ? (defaultLocationByStaffId[newItem.staff_id] || null) : null,
    } as any;

    const totalPrice = Number((item.quantity * item.unit_price * (1 - (item.discount_percentage / 100))).toFixed(2));
    (item as any).total_price = totalPrice;
    (item as any).staff_name = staffMember?.full_name || '';
    (item as any).service_name = service?.name || '';

    setSelectedItems(prev => [...prev, item as any]);

    setNewItem({
      service_id: "",
      description: "",
      quantity: 1,
      unit_price: "",
      discount_percentage: 0,
      staff_id: "",
      commission_percentage: 0,
    });
  };


  const removeItemFromInvoice = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = selectedItems.reduce((sum, item) => Number(sum) + Number(item.total_price), 0);
    const taxAmount = applyTax ? Number(subtotal) * ((Number(orgTaxRate) || 0) / 100) : 0;
    const total = Number(subtotal) + Number(taxAmount);
    return { subtotal, taxAmount, total };
  };

  // Create is now handled in full-page form

  const resetForm = () => {
    setFormData({
      customer_id: "",
      customer_name: "",
      customer_email: "",
      customer_phone: "",
      due_date: "",
      payment_method: "",
      notes: "",
      jobcard_id: "",
      location_id: "",
    });
    setSelectedItems([]);
    setEditingInvoice(null);
  };

  const handleStatusUpdate = async (invoiceId: string, newStatus: string) => {
    try {
      if (newStatus === "paid") {
        toast.error("Invoice can only be marked as paid by recording a payment");
        return;
      }
      await updateInvoiceWithFallback(supabase, invoiceId, { status: newStatus });
      toast.success("Invoice status updated");
      fetchInvoices();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    // Check if invoice has payments
    try {
      const { data: payments } = await supabase
        .from('invoice_payments')
        .select('id')
        .eq('invoice_id', invoiceId)
        .limit(1);
      
      if (payments && payments.length > 0) {
        toast.error("Cannot delete invoice with posted payments. Please delete payments first.");
        return;
      }
    } catch (error) {
      console.error("Error checking payments:", error);
      toast.error("Failed to check payment status");
      return;
    }

    if (confirm("Are you sure you want to delete this invoice?")) {
      try {
        await deleteInvoiceWithFallback(supabase, invoiceId);
        toast.success("Invoice deleted successfully");
        fetchInvoices();
      } catch (error) {
        console.error("Error deleting invoice:", error);
        toast.error("Failed to delete invoice");
      }
    }
  };

  const duplicateInvoice = async (invoice: Invoice) => {
    try {
      navigate(`/invoices/new?duplicateId=${invoice.id}`);
    } catch (error) {
      console.error("Error duplicating invoice:", error);
      toast.error("Failed to duplicate invoice");
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = INVOICE_STATUSES.find(s => s.value === status) || INVOICE_STATUSES[0];
    const IconComponent = statusConfig.icon;
    return (
      <Badge className={`${statusConfig.color} flex items-center gap-1.5 font-medium px-2.5 py-1 text-xs border`}>
        <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
        <IconComponent className="w-3 h-3" />
        {statusConfig.label}
      </Badge>
    );
  };

  const filterInvoicesByDateRange = (invoices: Invoice[], preset: string) => {
    if (preset === "all_time") return invoices;
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;
    switch (preset) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "this_week": {
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        break;
      }
      case "this_month":
        startDate = startOfMonth(now);
        break;
      case "last_month":
        startDate = startOfMonth(subMonths(now, 1));
        endDate = endOfMonth(subMonths(now, 1));
        break;
      case "last_3_months":
        startDate = startOfMonth(subMonths(now, 2));
        break;
      case "this_year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(0);
    }
    return invoices.filter((invoice) => {
      const created = new Date(invoice.created_at as any);
      if (isNaN(created.getTime())) return false;
      return isWithinInterval(created, { start: startDate, end: endDate });
    });
  };

  const filteredInvoices = invoices.filter(invoice => {
    const normalizedSearch = (searchTerm || "").toLowerCase();
    const matchesSearch = ((invoice.invoice_number || "").toLowerCase().includes(normalizedSearch)) ||
                         ((invoice.customer_name || "").toLowerCase().includes(normalizedSearch));
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    const matchesLocation = locationFilter === "all" || ((invoice as any).location_id || null) === locationFilter;
    return matchesSearch && matchesStatus && matchesLocation;
  });

  const dateFilteredInvoices = filterInvoicesByDateRange(filteredInvoices, dateFilter);

  // Statistics
  const totalInvoices = dateFilteredInvoices.length;
  const paidInvoices = dateFilteredInvoices.filter(i => i.status === "paid").length;
  const pendingInvoices = dateFilteredInvoices.filter(i => i.status === "sent").length;
  const overdueInvoices = dateFilteredInvoices.filter(i => i.status === "overdue").length;
  const draftInvoices = dateFilteredInvoices.filter(i => i.status === "draft").length;
  const totalRevenue = dateFilteredInvoices.filter(i => i.status === "paid").reduce((sum, i) => sum + i.total_amount, 0);
  const pendingRevenue = dateFilteredInvoices.filter(i => i.status === "sent" || i.status === "overdue").reduce((sum, i) => sum + i.total_amount, 0);
  const averageInvoiceValue = totalInvoices > 0 ? (totalRevenue / totalInvoices) : 0;
  const collectionRate = totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0;

  // Get invoices for each tab
  const getTabInvoices = (tab: string) => {
    switch (tab) {
      case "paid":
        return dateFilteredInvoices.filter(i => i.status === "paid");
      case "pending":
        return dateFilteredInvoices.filter(i => i.status === "sent" || i.status === "overdue");
      case "draft":
        return dateFilteredInvoices.filter(i => i.status === "draft");
      default:
        return dateFilteredInvoices;
    }
  };

  const currentInvoices = getTabInvoices(activeTab);

  return (
    <div className="flex-1 space-y-6 p-6 bg-slate-50/30 min-h-screen">
      <PageHeader
        title="Invoice Management"
        subtitle="Create, track and manage all your invoices"
        icon={<Receipt className="h-5 w-5" />}
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
            <Button
              onClick={() => navigate("/invoices/new")}
              className="btn-theme-primary btn-compact"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Invoice
            </Button>
          </>
        }
      />

      {/* Statistics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Total Invoices</CardTitle>
            <Receipt className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{totalInvoices}</div>
            <p className="text-xs text-blue-600">
              {draftInvoices} drafts, {paidInvoices} paid
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-green-600">
              From {paidInvoices} paid invoices
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">Pending Amount</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{formatCurrency(pendingRevenue)}</div>
            <p className="text-xs text-orange-600">
              {pendingInvoices + overdueInvoices} pending
            </p>
          </CardContent>
        </Card>

      </div>

      {/* Filters & Tabs */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-4 border-b border-slate-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-fit">
              <TabsList className="grid grid-cols-4 w-fit">
                <TabsTrigger value="all" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  All ({totalInvoices})
                </TabsTrigger>
                <TabsTrigger value="paid" className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Paid ({paidInvoices})
                </TabsTrigger>
                <TabsTrigger value="pending" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Pending ({pendingInvoices + overdueInvoices})
                </TabsTrigger>
                <TabsTrigger value="draft" className="flex items-center gap-2">
                  <Edit2 className="w-4 h-4" />
                  Draft ({draftInvoices})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {INVOICE_STATUSES.map((status) => (
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
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FILTERS.map((filter) => (
                    <SelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
                <p className="text-slate-600">Loading invoices...</p>
              </div>
            </div>
          ) : currentInvoices.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                <Receipt className="w-8 h-8 text-slate-400" />
              </div>
              <div className="space-y-2">
                <p className="text-slate-600 font-medium">
                  {searchTerm || statusFilter !== "all" ? "No invoices found" : "No invoices yet"}
                </p>
                <p className="text-slate-400 text-sm">
                  {searchTerm || statusFilter !== "all" 
                    ? "Try adjusting your filters" 
                    : "Create your first invoice to get started"
                  }
                </p>
              </div>
              {!searchTerm && statusFilter === "all" && (
                <Button 
                  onClick={() => navigate('/invoices/new')}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Invoice
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200">
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Options</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentInvoices.map((invoice) => (
                  <TableRow key={invoice.id} className="border-slate-100 hover:bg-slate-50/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-50 rounded-md">
                          <Receipt className="w-4 h-4 text-violet-600" />
                        </div>
                        <div>
                          <div className="font-semibold">{invoice.invoice_number}</div>
                          {invoice.jobcard_id && (
                            <div className="text-xs text-slate-500">Job: {invoice.jobcard_id}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{invoice.customer_name}</div>
                        {invoice.customer_email && (
                          <div className="text-sm text-slate-500">{invoice.customer_email}</div>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="font-semibold">{formatCurrency(invoice.total_amount)}</div>
                      <div className="text-xs text-slate-500">
                        Tax: {formatCurrency(invoice.tax_amount)}
                      </div>
                    </TableCell>
                    
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    
                    <TableCell>
                      <div className="text-slate-700">{safeFormatDate(invoice.created_at, "MMM dd, yyyy")}</div>
                      <div className="text-xs text-slate-500">{safeFormatDate(invoice.created_at, "h:mm a")}</div>
                    </TableCell>
                    
                    <TableCell>
                      {invoice.due_date ? (
                        <div className="text-slate-700">{safeFormatDate(invoice.due_date, "MMM dd, yyyy")}</div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            fetchInvoiceItems(invoice.id);
                            setIsViewModalOpen(true);
                          }}
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
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => duplicateInvoice(invoice)}>
                              <Copy className="w-4 h-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>
                              <Edit2 className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              downloadInvoicePDF(invoice, '80mm');
                            }}>
                              <Receipt className="w-4 h-4 mr-2" />
                              Download Receipt
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="w-4 h-4 mr-2" />
                              Send Email
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[#25D366] focus:text-[#25D366]">
                              <WhatsAppIcon className="w-4 h-4 mr-2" />
                              Send WhatsApp
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDeleteInvoice(invoice.id)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        
                        <Select value={invoice.status} onValueChange={(value) => handleStatusUpdate(invoice.id, value)} disabled={invoice.status === 'paid'}>
                          <SelectTrigger className="w-28 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INVOICE_STATUSES.filter((s) => s.value !== 'paid').map((status) => (
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Invoice Window */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-violet-600" />
                  {selectedInvoice?.invoice_number}
                </DialogTitle>
                <DialogDescription>
                  Complete invoice details and line items
                </DialogDescription>
              </div>
              {selectedInvoice && (
                <div className="text-right space-y-1">
                  {getStatusBadge(selectedInvoice.status)}
                  <div className="text-sm text-slate-500">
                    Created {safeFormatDate(selectedInvoice.created_at, "MMM dd, yyyy")}
                  </div>
                </div>
              )}
            </div>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-6">
              {/* Invoice Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-blue-500/10 border-blue-300">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-blue-700 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Bill To
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="font-semibold">{selectedInvoice.customer_name}</div>
                    {selectedInvoice.customer_email && (
                      <div className="text-sm text-slate-600 flex items-center gap-2">
                        <Mail className="w-3 h-3" />
                        {selectedInvoice.customer_email}
                      </div>
                    )}
                    {selectedInvoice.customer_phone && (
                      <div className="text-sm text-slate-600 flex items-center gap-2">
                        <Phone className="w-3 h-3" />
                        {selectedInvoice.customer_phone}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-violet-500/10 border-violet-300">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-violet-700 flex items-center gap-2">
                      <Receipt className="w-4 h-4" />
                      Invoice Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Date:</span>
                      <span className="font-medium">
                        {safeFormatDate(selectedInvoice.created_at, "MMM dd, yyyy")}
                      </span>
                    </div>
                    {selectedInvoice.due_date && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Due:</span>
                        <span className="font-medium">
                          {safeFormatDate(selectedInvoice.due_date, "MMM dd, yyyy")}
                        </span>
                      </div>
                    )}
                    {selectedInvoice.payment_method && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Payment:</span>
                        <span className="font-medium">{selectedInvoice.payment_method}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-600">Location:</span>
                      {isEditingLocation ? (
                        <div className="flex items-center gap-2 w-2/3">
                          <Select value={editLocationId} onValueChange={setEditLocationId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select location" />
                            </SelectTrigger>
                            <SelectContent>
                              {locations.map((loc) => (
                                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <span className="font-medium">{(() => { const lid = (selectedInvoice as any)?.location_id; return lid ? (locations.find(l => l.id === lid)?.name || '—') : '—'; })()}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Invoice Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Invoice Items
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {invoiceItems.length === 0 ? (
                    <div className="text-center py-8 space-y-2">
                      <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-slate-500">No items found for this invoice</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.description}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                            <TableCell className="font-semibold">{formatCurrency(item.total_price)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Invoice Totals */}
              <Card className="bg-slate-500/10">
                <CardContent className="p-4">
                  <div className="flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span className="font-semibold">{formatCurrency(selectedInvoice.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tax ({selectedInvoice.tax_amount > 0 ? (Number(orgTaxRate) || 0) : 0}%):</span>
                        <span className="font-semibold">{formatCurrency(selectedInvoice.tax_amount)}</span>
                      </div>
                      {selectedInvoice.tax_amount === 0 && (
                        <div className="text-xs text-muted-foreground">No VAT applied</div>
                      )}
                      {selectedInvoice.discount_amount > 0 && (
                        <div className="flex justify-between text-sm text-red-600">
                          <span>Discount:</span>
                          <span className="font-semibold">-{formatCurrency(selectedInvoice.discount_amount)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span className="text-violet-600">{formatCurrency(selectedInvoice.total_amount)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              {selectedInvoice.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600 whitespace-pre-wrap">{selectedInvoice.notes}</p>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline">
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      Download Invoice
                      <ChevronDown className="w-3 h-3 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      if (selectedInvoice) {
                        downloadInvoicePDF(selectedInvoice, 'standard');
                      }
                    }}>
                      <FileText className="w-4 h-4 mr-2" />
                      Standard PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      if (selectedInvoice) {
                        downloadInvoicePDF(selectedInvoice, '80mm');
                      }
                    }}>
                      <Receipt className="w-4 h-4 mr-2" />
                      80mm Receipt
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="whatsapp">
                  <WhatsAppIcon className="w-4 h-4" />
                  Send WhatsApp
                </Button>
                {isEditingLocation ? (
                  <>
                    <Button variant="outline" onClick={() => { setIsEditingLocation(false); setEditLocationId(selectedInvoice?.location_id || ""); }}>Cancel</Button>
                    <Button className="bg-violet-600 hover:bg-violet-700" onClick={async () => {
                      if (!selectedInvoice) return;
                      try {
                        await updateInvoiceWithFallback(supabase, selectedInvoice.id, { location_id: editLocationId || null });
                        toast.success('Invoice updated');
                        setIsEditingLocation(false);
                        setSelectedInvoice({ ...(selectedInvoice as any), location_id: editLocationId || null } as any);
                        fetchInvoices();
                      } catch (e) {
                        console.error(e);
                        toast.error('Failed to update invoice');
                      }
                    }}>Save</Button>
                  </>
                                 ) : (
                   <div className="flex gap-2">
                      <Button variant="default" onClick={() => { if (selectedInvoice) navigate(`/payments/received/new?invoiceId=${selectedInvoice.id}`); }}>
                        <DollarSign className="w-4 h-4 mr-2" />
                        Record Payment
                      </Button>
                     <Button className="bg-violet-600 hover:bg-violet-700" onClick={() => { if (selectedInvoice) navigate(`/invoices/${selectedInvoice.id}/edit`); }}>
                       <Edit2 className="w-4 h-4 mr-2" />
                       Edit Invoice
                     </Button>
                   </div>
                 )}
               </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

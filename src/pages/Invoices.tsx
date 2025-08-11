"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const { symbol, format: formatMoney } = useOrganizationCurrency();
  const orgTaxRate = useOrganizationTaxRate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all_time");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [activeTab, setActiveTab] = useState("all");

  const [formData, setFormData] = useState({
    customer_id: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    due_date: "",
    payment_method: "",
    notes: "",
    jobcard_id: "",
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

  useEffect(() => {
    fetchInvoices();
    fetchCustomers();
    fetchServices();
    fetchStaff();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const data = await getInvoicesWithFallback(supabase);
      setInvoices(data || []);
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
        .order("full_name");

      if (error) throw error;
      setStaff(data || []);
    } catch (error) {
      console.error("Error fetching staff:", error);
    }
  };

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

    const item = {
      id: `temp-${Date.now()}`,
      invoice_id: "",
      product_id: newItem.service_id,
      service_id: newItem.service_id,
      description: newItem.description,
      quantity: newItem.quantity,
      discount_percentage: newItem.discount_percentage,
      staff_id: newItem.staff_id,
      commission_percentage: newItem.commission_percentage,
      unit_price: parseFloat(newItem.unit_price) || 0,
      total_price: newItem.quantity * (parseFloat(newItem.unit_price) || 0) * (1 - newItem.discount_percentage / 100),
      commission_amount: (newItem.quantity * (parseFloat(newItem.unit_price) || 0) * (1 - newItem.discount_percentage / 100)) * (newItem.commission_percentage / 100),
      service_name: service?.name || "",
      staff_name: staffMember?.full_name || "",
    };

    setSelectedItems([...selectedItems, item]);
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
    const subtotal = selectedItems.reduce((sum, item) => sum + item.total_price, 0);
    const taxAmount = subtotal * ((orgTaxRate || 0) / 100);
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedItems.length === 0) {
      toast.error("Please add at least one item to the invoice");
      return;
    }

    try {
      const totals = calculateTotals();
      const invoiceData = {
        invoice_number: generateInvoiceNumber(),
        customer_id: formData.customer_id || null,
        customer_name: formData.customer_name,
        customer_email: formData.customer_email || null,
        customer_phone: formData.customer_phone || null,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        discount_amount: 0,
        total_amount: totals.total,
        status: "draft",
        due_date: formData.due_date || null,
        payment_method: formData.payment_method || null,
        notes: formData.notes || null,
        jobcard_id: formData.jobcard_id || null,
      };

      await createInvoiceWithFallback(supabase, invoiceData, selectedItems);
      toast.success("Invoice created successfully");
      setIsCreateModalOpen(false);
      resetForm();
      fetchInvoices();
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast.error("Failed to create invoice");
    }
  };

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
    });
    setSelectedItems([]);
    setEditingInvoice(null);
  };

  const handleStatusUpdate = async (invoiceId: string, newStatus: string) => {
    try {
      await updateInvoiceWithFallback(supabase, invoiceId, { status: newStatus });
      toast.success("Invoice status updated");
      fetchInvoices();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
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
      const items = await getInvoiceItemsWithFallback(supabase, invoice.id);
      
      setFormData({
        customer_id: invoice.customer_id || "",
        customer_name: invoice.customer_name,
        customer_email: invoice.customer_email || "",
        customer_phone: invoice.customer_phone || "",
        due_date: "",
        payment_method: invoice.payment_method || "",
        notes: invoice.notes || "",
        jobcard_id: invoice.jobcard_id || "",
      });
      
      setSelectedItems(items?.map(item => ({
        service_id: item.service_id || "",
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price.toString(),
        discount_percentage: item.discount_percentage,
        staff_id: item.staff_id || "",
        commission_percentage: item.commission_percentage,
        total_price: item.total_price,
        service_name: "",
        staff_name: "",
      })) || []);
      
      setIsCreateModalOpen(true);
      toast.success("Invoice duplicated for editing");
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

  const filterInvoicesByDate = (invoices: Invoice[], preset: string) => {
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
        endDate = endOfMonth(now);
        break;
      case "last_month": {
        const lastMonth = subMonths(now, 1);
        startDate = startOfMonth(lastMonth);
        endDate = endOfMonth(lastMonth);
        break;
      }
      case "last_3_months":
        startDate = subMonths(now, 3);
        break;
      case "this_year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        return invoices;
    }

    return invoices.filter(invoice => 
      isWithinInterval(new Date(invoice.created_at), { start: startDate, end: endDate })
    );
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const dateFilteredInvoices = filterInvoicesByDate(filteredInvoices, dateFilter);

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
      {/* Modern Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl shadow-lg">
              <Receipt className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Invoice Management</h1>
              <p className="text-slate-600">Create, track and manage all your invoices</p>
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
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Export Options</DropdownMenuLabel>
              <DropdownMenuItem>
                <FileText className="w-4 h-4 mr-2" />
                Export to PDF
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FileCheck className="w-4 h-4 mr-2" />
                Export to Excel
              </DropdownMenuItem>
              <DropdownMenuItem>
                <BarChart3 className="w-4 h-4 mr-2" />
                Export Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg">
                <Plus className="w-4 h-4 mr-2" />
                New Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[950px] max-h-[90vh] overflow-y-auto">
              <DialogHeader className="pb-4 border-b">
                <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-violet-600" />
                  Create New Invoice
                </DialogTitle>
                <DialogDescription className="text-slate-600">
                  Create a professional invoice with itemized services and automatic calculations
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Customer Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    Customer Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customer_id">Existing Customer</Label>
                      <Select 
                        value={formData.customer_id} 
                        onValueChange={(value) => {
                          const customer = customers.find(c => c.id === value);
                          setFormData({
                            ...formData,
                            customer_id: value,
                            customer_name: customer?.full_name || "",
                            customer_email: customer?.email || "",
                            customer_phone: customer?.phone || "",
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select existing customer" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{customer.full_name}</span>
                                {customer.email && <span className="text-xs text-muted-foreground">{customer.email}</span>}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="customer_name">Customer Name *</Label>
                      <Input
                        id="customer_name"
                        value={formData.customer_name}
                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                        placeholder="Enter customer name"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customer_email">Email Address</Label>
                      <Input
                        id="customer_email"
                        type="email"
                        value={formData.customer_email}
                        onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                        placeholder="customer@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customer_phone">Phone Number</Label>
                      <Input
                        id="customer_phone"
                        value={formData.customer_phone}
                        onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Invoice Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-purple-600" />
                    Invoice Details
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="due_date">Due Date</Label>
                      <Input
                        id="due_date"
                        type="date"
                        value={formData.due_date}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payment_method">Preferred Payment Method</Label>
                      <Select value={formData.payment_method} onValueChange={(value) => setFormData({ ...formData, payment_method: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((method) => {
                            const IconComponent = method.icon;
                            return (
                              <SelectItem key={method.value} value={method.value}>
                                <div className="flex items-center gap-2">
                                  <IconComponent className="w-4 h-4" />
                                  {method.label}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Items Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-green-600" />
                    Invoice Items
                  </h3>
                  
                  {/* Add Item Form */}
                  <Card className="bg-slate-50 border-slate-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Add Item</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
                        <div className="lg:col-span-1">
                          <Label className="text-sm">Service</Label>
                          <Select value={newItem.service_id} onValueChange={(value) => {
                            const service = services.find(s => s.id === value);
                            setNewItem({ 
                              ...newItem, 
                              service_id: value,
                              description: service?.name || "",
                              unit_price: service?.price.toString() || ""
                            });
                          }}>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {services.map((service) => (
                                <SelectItem key={service.id} value={service.id}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{service.name}</span>
                                    <span className="text-xs text-muted-foreground">{symbol}{service.price}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="lg:col-span-2">
                          <Label className="text-sm">Description *</Label>
                          <Input
                            value={newItem.description}
                            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                            placeholder="Service description"
                            className="h-9"
                          />
                        </div>
                        
                        <div className="lg:col-span-1">
                          <Label className="text-sm">Qty *</Label>
                          <Input
                            type="number"
                            value={newItem.quantity}
                            onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                            min="1"
                            className="h-9"
                          />
                        </div>
                        
                        <div className="lg:col-span-1">
                          <Label className="text-sm">Price *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={newItem.unit_price}
                            onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })}
                            placeholder="0.00"
                            className="h-9"
                          />
                        </div>
                        
                        <div className="lg:col-span-1">
                          <Label className="text-sm">Discount %</Label>
                          <Input
                            type="number"
                            value={newItem.discount_percentage}
                            onChange={(e) => setNewItem({ ...newItem, discount_percentage: parseFloat(e.target.value) || 0 })}
                            min="0"
                            max="100"
                            placeholder="0"
                            className="h-9"
                          />
                        </div>
                        
                        <div className="lg:col-span-1 flex items-end">
                          <Button 
                            type="button" 
                            onClick={addItemToInvoice}
                            size="sm"
                            className="w-full h-9 bg-violet-600 hover:bg-violet-700"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add
                          </Button>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <Label className="text-sm">Assigned Staff</Label>
                        <Select value={newItem.staff_id} onValueChange={(value) => setNewItem({ ...newItem, staff_id: value })}>
                          <SelectTrigger className="max-w-xs h-9">
                            <SelectValue placeholder="Select staff member" />
                          </SelectTrigger>
                          <SelectContent>
                            {staff.map((member) => (
                              <SelectItem key={member.id} value={member.id}>
                                {member.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Items List */}
                  {selectedItems.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Invoice Items ({selectedItems.length})</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Description</TableHead>
                              <TableHead>Qty</TableHead>
                              <TableHead>Price</TableHead>
                              <TableHead>Discount</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead className="w-12"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedItems.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium">{item.description}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>{symbol}{parseFloat(String(item.unit_price)).toFixed(2)}</TableCell>
                                <TableCell>{item.discount_percentage}%</TableCell>
                                <TableCell className="font-semibold">{symbol}{item.total_price.toFixed(2)}</TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeItemFromInvoice(index)}
                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Totals Summary */}
                  {selectedItems.length > 0 && (
                    <Card className="bg-violet-50 border-violet-200">
                      <CardContent className="p-4">
                        <div className="flex justify-end">
                          <div className="w-64 space-y-2">
                            {(() => {
                              const totals = calculateTotals();
                              return (
                                <>
                                  <div className="flex justify-between text-sm">
                                    <span>Subtotal:</span>
                                    <span className="font-semibold">{symbol}{totals.subtotal.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span>Tax ({(orgTaxRate || 0)}%):</span>
                                    <span className="font-semibold">{symbol}{totals.taxAmount.toFixed(2)}</span>
                                  </div>
                                  <Separator />
                                  <div className="flex justify-between text-lg font-bold">
                                    <span>Total:</span>
                                    <span className="text-violet-600">{symbol}{totals.total.toFixed(2)}</span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <Separator />

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder="Add any additional notes or special instructions..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                  >
                    Create Invoice
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Total Invoices</CardTitle>
            <Receipt className="h-4 w-4 opacity-80" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices}</div>
            <p className="text-xs opacity-80">
              {draftInvoices} drafts, {paidInvoices} paid
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 opacity-80" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(totalRevenue, { decimals: 0 })}</div>
            <p className="text-xs opacity-80">
              From {paidInvoices} paid invoices
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Pending Amount</CardTitle>
            <Clock className="h-4 w-4 opacity-80" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(pendingRevenue, { decimals: 0 })}</div>
            <p className="text-xs opacity-80">
              {pendingInvoices + overdueInvoices} pending
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-500 to-violet-600 text-white border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium opacity-90">Collection Rate</CardTitle>
            <Target className="h-4 w-4 opacity-80" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{collectionRate.toFixed(1)}%</div>
            <p className="text-xs opacity-80">
              Avg: {formatMoney(Number(averageInvoiceValue.toFixed(0)), { decimals: 0 })}
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
                  onClick={() => setIsCreateModalOpen(true)}
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
                  <TableHead className="text-right">Actions</TableHead>
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
                      <div className="font-semibold">{symbol}{invoice.total_amount.toFixed(2)}</div>
                      <div className="text-xs text-slate-500">
                        Tax: {symbol}{invoice.tax_amount.toFixed(2)}
                      </div>
                    </TableCell>
                    
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    
                    <TableCell>
                      <div className="text-slate-700">{format(new Date(invoice.created_at), "MMM dd, yyyy")}</div>
                      <div className="text-xs text-slate-500">{format(new Date(invoice.created_at), "h:mm a")}</div>
                    </TableCell>
                    
                    <TableCell>
                      {invoice.due_date ? (
                        <div className="text-slate-700">{format(new Date(invoice.due_date), "MMM dd, yyyy")}</div>
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
                            <DropdownMenuItem>
                              <Download className="w-4 h-4 mr-2" />
                              Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="w-4 h-4 mr-2" />
                              Send Email
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <MessageSquare className="w-4 h-4 mr-2" />
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
                        
                        <Select value={invoice.status} onValueChange={(value) => handleStatusUpdate(invoice.id, value)}>
                          <SelectTrigger className="w-24 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INVOICE_STATUSES.map((status) => (
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

      {/* View Invoice Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
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
                    Created {format(new Date(selectedInvoice.created_at), "MMM dd, yyyy")}
                  </div>
                </div>
              )}
            </div>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-6">
              {/* Invoice Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-blue-50 border-blue-200">
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

                <Card className="bg-violet-50 border-violet-200">
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
                        {format(new Date(selectedInvoice.created_at), "MMM dd, yyyy")}
                      </span>
                    </div>
                    {selectedInvoice.due_date && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Due:</span>
                        <span className="font-medium">
                          {format(new Date(selectedInvoice.due_date), "MMM dd, yyyy")}
                        </span>
                      </div>
                    )}
                    {selectedInvoice.payment_method && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Payment:</span>
                        <span className="font-medium">{selectedInvoice.payment_method}</span>
                      </div>
                    )}
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
                            <TableCell>{symbol}{item.unit_price.toFixed(2)}</TableCell>
                            <TableCell className="font-semibold">{symbol}{item.total_price.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Invoice Totals */}
              <Card className="bg-slate-50">
                <CardContent className="p-4">
                  <div className="flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span className="font-semibold">{symbol}{selectedInvoice.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tax ({(orgTaxRate || 0)}%):</span>
                        <span className="font-semibold">{symbol}{selectedInvoice.tax_amount.toFixed(2)}</span>
                      </div>
                      {selectedInvoice.discount_amount > 0 && (
                        <div className="flex justify-between text-sm text-red-600">
                          <span>Discount:</span>
                          <span className="font-semibold">-{symbol}{selectedInvoice.discount_amount.toFixed(2)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span className="text-violet-600">{symbol}{selectedInvoice.total_amount.toFixed(2)}</span>
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
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button variant="outline">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Send WhatsApp
                </Button>
                <Button className="bg-violet-600 hover:bg-violet-700">
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Invoice
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

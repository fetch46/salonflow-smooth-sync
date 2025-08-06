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
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { 
  createInvoiceWithFallback, 
  getInvoicesWithFallback, 
  updateInvoiceWithFallback, 
  deleteInvoiceWithFallback,
  getInvoiceItemsWithFallback 
} from "@/utils/mockDatabase";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

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
  total_price: number;
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

const INVOICE_STATUSES = [
  { value: "draft", label: "Draft", color: "bg-slate-100 text-slate-700 border-slate-300", icon: FileText },
  { value: "sent", label: "Sent", color: "bg-blue-100 text-blue-700 border-blue-300", icon: Send },
  { value: "paid", label: "Paid", color: "bg-green-100 text-green-700 border-green-300", icon: CheckCircle },
  { value: "overdue", label: "Overdue", color: "bg-red-100 text-red-700 border-red-300", icon: AlertTriangle },
  { value: "cancelled", label: "Cancelled", color: "bg-gray-100 text-gray-700 border-gray-300", icon: Trash2 }
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: DollarSign },
  { value: "card", label: "Credit Card", icon: Receipt },
  { value: "bank_transfer", label: "Bank Transfer", icon: TrendingUp },
  { value: "mobile_payment", label: "Mobile Payment", icon: MessageSquare }
];

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [activeTab, setActiveTab] = useState("overview");

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

  const [selectedItems, setSelectedItems] = useState<any[]>([]);

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
      ...newItem,
      unit_price: parseFloat(newItem.unit_price) || 0,
      total_price: newItem.quantity * (parseFloat(newItem.unit_price) || 0) * (1 - newItem.discount_percentage / 100),
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
    const taxAmount = subtotal * 0.085; // 8.5% tax
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

      // Use fallback function to handle missing database tables
      const invoice = await createInvoiceWithFallback(supabase, invoiceData, selectedItems);

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
      <Badge className={`${statusConfig.color} flex items-center gap-1 font-medium`}>
        <IconComponent className="w-3 h-3" />
        {statusConfig.label}
      </Badge>
    );
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    const matchesDate = !dateFilter || format(new Date(invoice.created_at), "yyyy-MM-dd") === dateFilter;
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  // Enhanced Statistics
  const totalInvoices = invoices.length;
  const paidInvoices = invoices.filter(i => i.status === "paid").length;
  const pendingInvoices = invoices.filter(i => i.status === "sent").length;
  const overdueInvoices = invoices.filter(i => i.status === "overdue").length;
  const draftInvoices = invoices.filter(i => i.status === "draft").length;
  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + i.total_amount, 0);
  const pendingRevenue = invoices.filter(i => i.status === "sent" || i.status === "overdue").reduce((sum, i) => sum + i.total_amount, 0);
  const averageInvoiceValue = totalInvoices > 0 ? (totalRevenue / totalInvoices) : 0;
  const paymentRate = totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0;

  return (
    <div className="flex-1 space-y-8 p-8 pt-6 bg-gradient-to-br from-slate-50 via-white to-blue-50 min-h-screen">
      {/* Enhanced Header with Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Invoice Management
          </h1>
          <p className="text-lg text-muted-foreground">
            Create, track, and manage your invoices with ease
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={refreshData}
            disabled={refreshing}
            className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button variant="outline" className="border-purple-200 text-purple-600 hover:bg-purple-50">
            <Download className="w-4 h-4 mr-2" />
            Export All
          </Button>
          
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 shadow-lg">
                <Plus className="w-4 h-4 mr-2" />
                Create Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[950px] max-h-[90vh] overflow-y-auto">
              <DialogHeader className="pb-4 border-b">
                <DialogTitle className="text-2xl font-bold text-slate-800">Create New Invoice</DialogTitle>
                <DialogDescription className="text-slate-600">
                  Create a detailed invoice for your customer with itemized services
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Customer Information Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-semibold text-slate-800">Customer Information</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customer_id" className="text-sm font-medium text-slate-700">Existing Customer</Label>
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
                        <SelectTrigger className="border-slate-300 focus:border-indigo-500">
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
                      <Label htmlFor="customer_name" className="text-sm font-medium text-slate-700">Customer Name *</Label>
                      <Input
                        id="customer_name"
                        value={formData.customer_name}
                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                        className="border-slate-300 focus:border-indigo-500"
                        placeholder="Enter customer name"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customer_email" className="text-sm font-medium text-slate-700">Email Address</Label>
                      <Input
                        id="customer_email"
                        type="email"
                        value={formData.customer_email}
                        onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                        className="border-slate-300 focus:border-indigo-500"
                        placeholder="customer@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customer_phone" className="text-sm font-medium text-slate-700">Phone Number</Label>
                      <Input
                        id="customer_phone"
                        value={formData.customer_phone}
                        onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                        className="border-slate-300 focus:border-indigo-500"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Invoice Details Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Receipt className="w-5 h-5 text-purple-600" />
                    <h3 className="text-lg font-semibold text-slate-800">Invoice Details</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="due_date" className="text-sm font-medium text-slate-700">Due Date</Label>
                      <Input
                        id="due_date"
                        type="date"
                        value={formData.due_date}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                        className="border-slate-300 focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payment_method" className="text-sm font-medium text-slate-700">Preferred Payment Method</Label>
                      <Select value={formData.payment_method} onValueChange={(value) => setFormData({ ...formData, payment_method: value })}>
                        <SelectTrigger className="border-slate-300 focus:border-indigo-500">
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
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-pink-600" />
                    <h3 className="text-lg font-semibold text-slate-800">Invoice Items</h3>
                  </div>
                  
                  {/* Add Item Form */}
                  <Card className="bg-gradient-to-r from-slate-50 to-blue-50 border-slate-200">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-base text-slate-700">Add Item</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
                        <div className="lg:col-span-1">
                          <Label className="text-sm font-medium text-slate-700">Service</Label>
                          <Select value={newItem.service_id} onValueChange={(value) => {
                            const service = services.find(s => s.id === value);
                            setNewItem({ 
                              ...newItem, 
                              service_id: value,
                              description: service?.name || "",
                              unit_price: service?.price.toString() || ""
                            });
                          }}>
                            <SelectTrigger className="border-slate-300 focus:border-indigo-500">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {services.map((service) => (
                                <SelectItem key={service.id} value={service.id}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{service.name}</span>
                                    <span className="text-xs text-muted-foreground">${service.price}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="lg:col-span-2">
                          <Label className="text-sm font-medium text-slate-700">Description *</Label>
                          <Input
                            value={newItem.description}
                            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                            className="border-slate-300 focus:border-indigo-500"
                            placeholder="Service description"
                          />
                        </div>
                        
                        <div className="lg:col-span-1">
                          <Label className="text-sm font-medium text-slate-700">Qty *</Label>
                          <Input
                            type="number"
                            value={newItem.quantity}
                            onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                            className="border-slate-300 focus:border-indigo-500"
                            min="1"
                          />
                        </div>
                        
                        <div className="lg:col-span-1">
                          <Label className="text-sm font-medium text-slate-700">Price *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={newItem.unit_price}
                            onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })}
                            className="border-slate-300 focus:border-indigo-500"
                            placeholder="0.00"
                          />
                        </div>
                        
                        <div className="lg:col-span-1">
                          <Label className="text-sm font-medium text-slate-700">Discount %</Label>
                          <Input
                            type="number"
                            value={newItem.discount_percentage}
                            onChange={(e) => setNewItem({ ...newItem, discount_percentage: parseFloat(e.target.value) || 0 })}
                            className="border-slate-300 focus:border-indigo-500"
                            min="0"
                            max="100"
                            placeholder="0"
                          />
                        </div>
                        
                        <div className="lg:col-span-1 flex items-end">
                          <Button 
                            type="button" 
                            onClick={addItemToInvoice}
                            className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add
                          </Button>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <Label className="text-sm font-medium text-slate-700">Assigned Staff</Label>
                        <Select value={newItem.staff_id} onValueChange={(value) => setNewItem({ ...newItem, staff_id: value })}>
                          <SelectTrigger className="border-slate-300 focus:border-indigo-500 max-w-xs">
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
                    <Card className="border-slate-200">
                      <CardHeader>
                        <CardTitle className="text-base text-slate-700">Invoice Items ({selectedItems.length})</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-slate-200">
                              <TableHead className="font-semibold text-slate-700">Description</TableHead>
                              <TableHead className="font-semibold text-slate-700">Qty</TableHead>
                              <TableHead className="font-semibold text-slate-700">Price</TableHead>
                              <TableHead className="font-semibold text-slate-700">Discount</TableHead>
                              <TableHead className="font-semibold text-slate-700">Staff</TableHead>
                              <TableHead className="font-semibold text-slate-700">Total</TableHead>
                              <TableHead className="font-semibold text-slate-700 w-16"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedItems.map((item, index) => (
                              <TableRow key={index} className="border-slate-100">
                                <TableCell className="font-medium">{item.description}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>${item.unit_price.toFixed(2)}</TableCell>
                                <TableCell>{item.discount_percentage}%</TableCell>
                                <TableCell>{item.staff_name || "—"}</TableCell>
                                <TableCell className="font-semibold">${item.total_price.toFixed(2)}</TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeItemFromInvoice(index)}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
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
                    <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
                      <CardContent className="p-6">
                        <div className="flex justify-end">
                          <div className="w-80 space-y-3">
                            {(() => {
                              const totals = calculateTotals();
                              return (
                                <>
                                  <div className="flex justify-between text-slate-600">
                                    <span>Subtotal:</span>
                                    <span className="font-semibold">${totals.subtotal.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-slate-600">
                                    <span>Tax (8.5%):</span>
                                    <span className="font-semibold">${totals.taxAmount.toFixed(2)}</span>
                                  </div>
                                  <Separator />
                                  <div className="flex justify-between text-lg font-bold text-slate-800">
                                    <span>Total Amount:</span>
                                    <span className="text-indigo-600">${totals.total.toFixed(2)}</span>
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

                {/* Notes Section */}
                <div className="space-y-3">
                  <Label htmlFor="notes" className="text-sm font-medium text-slate-700">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="border-slate-300 focus:border-indigo-500 resize-none"
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
                    className="border-slate-300 text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 shadow-lg"
                  >
                    Create Invoice
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Enhanced Statistics Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 border-blue-200 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-blue-700">Total Invoices</CardTitle>
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700 mb-1">{totalInvoices}</div>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {draftInvoices} drafts
              </Badge>
              <span className="text-blue-600">All time</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 border-green-200 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-green-700">Paid Invoices</CardTitle>
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700 mb-1">{paidInvoices}</div>
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-green-600" />
                <span className="text-green-600">{paymentRate.toFixed(1)}% rate</span>
              </div>
            </div>
            <Progress value={paymentRate} className="mt-2 h-1" />
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 border-amber-200 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-amber-700">Pending</CardTitle>
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700 mb-1">{pendingInvoices + overdueInvoices}</div>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="secondary" className="bg-red-100 text-red-700">
                {overdueInvoices} overdue
              </Badge>
              <span className="text-amber-600">Need attention</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 border-purple-200 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-purple-700">Total Revenue</CardTitle>
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700 mb-1">${totalRevenue.toLocaleString()}</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-purple-600">Avg: ${averageInvoiceValue.toFixed(0)}</span>
              <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                ${pendingRevenue.toLocaleString()} pending
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Different Views */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList className="grid grid-cols-4 w-fit bg-slate-100">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white">Overview</TabsTrigger>
            <TabsTrigger value="recent" className="data-[state=active]:bg-white">Recent</TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-white">Pending</TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-white">Analytics</TabsTrigger>
          </TabsList>

          {/* Enhanced Filters */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64 border-slate-300 focus:border-indigo-500"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 border-slate-300 focus:border-indigo-500">
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
            
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-40 border-slate-300 focus:border-indigo-500"
            />
          </div>
        </div>

        <TabsContent value="overview" className="space-y-6">
          {/* Main Invoices Table */}
          <Card className="shadow-lg border-slate-200">
            <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Receipt className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle className="text-slate-800">All Invoices</CardTitle>
                    <CardDescription className="text-slate-600">
                      Manage and track all your invoices ({filteredInvoices.length} shown)
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center space-y-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mx-auto"></div>
                    <p className="text-slate-600 font-medium">Loading invoices...</p>
                  </div>
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-slate-600 font-medium">
                      {searchTerm || statusFilter !== "all" || dateFilter ? "No invoices found" : "No invoices yet"}
                    </p>
                    <p className="text-slate-400 text-sm">
                      {searchTerm || statusFilter !== "all" || dateFilter 
                        ? "Try adjusting your filters" 
                        : "Create your first invoice to get started"
                      }
                    </p>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 bg-slate-50">
                      <TableHead className="font-semibold text-slate-700">Invoice</TableHead>
                      <TableHead className="font-semibold text-slate-700">Customer</TableHead>
                      <TableHead className="font-semibold text-slate-700">Amount</TableHead>
                      <TableHead className="font-semibold text-slate-700">Status</TableHead>
                      <TableHead className="font-semibold text-slate-700">Date</TableHead>
                      <TableHead className="font-semibold text-slate-700">Due Date</TableHead>
                      <TableHead className="font-semibold text-slate-700 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => (
                      <TableRow key={invoice.id} className="border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 rounded-md">
                              <FileText className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800">{invoice.invoice_number}</div>
                              {invoice.jobcard_id && (
                                <div className="text-xs text-slate-500">Job: {invoice.jobcard_id}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-slate-800">{invoice.customer_name}</div>
                            {invoice.customer_email && (
                              <div className="text-sm text-slate-500">{invoice.customer_email}</div>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="font-semibold text-slate-800">${invoice.total_amount.toFixed(2)}</div>
                          <div className="text-xs text-slate-500">
                            Tax: ${invoice.tax_amount.toFixed(2)}
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
                              className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-800 hover:bg-slate-100">
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
                              <SelectTrigger className="w-24 h-8 border-slate-300">
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
        </TabsContent>

        <TabsContent value="recent" className="space-y-6">
          <Card className="shadow-lg border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-600" />
                Recent Invoices
              </CardTitle>
              <CardDescription>
                Your most recently created invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-slate-500">
                Recent invoices view - showing last 30 days
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="space-y-6">
          <Card className="shadow-lg border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Pending & Overdue Invoices
              </CardTitle>
              <CardDescription>
                Invoices requiring your attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-slate-500">
                Pending invoices view - showing sent and overdue invoices
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card className="shadow-lg border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                Invoice Analytics
              </CardTitle>
              <CardDescription>
                Insights and trends for your invoicing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-slate-500">
                Analytics dashboard - charts and insights coming soon
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Enhanced View Invoice Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <DialogTitle className="text-2xl font-bold text-slate-800">
                  {selectedInvoice?.invoice_number}
                </DialogTitle>
                <DialogDescription className="text-slate-600">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Bill To
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="font-semibold text-slate-800">{selectedInvoice.customer_name}</div>
                    {selectedInvoice.customer_email && (
                      <div className="text-sm text-slate-600 flex items-center gap-2">
                        <Mail className="w-3 h-3" />
                        {selectedInvoice.customer_email}
                      </div>
                    )}
                    {selectedInvoice.customer_phone && (
                      <div className="text-sm text-slate-600 flex items-center gap-2">
                        <Users className="w-3 h-3" />
                        {selectedInvoice.customer_phone}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-purple-700 flex items-center gap-2">
                      <Receipt className="w-4 h-4" />
                      Invoice Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Date:</span>
                      <span className="font-medium text-slate-800">
                        {format(new Date(selectedInvoice.created_at), "MMM dd, yyyy")}
                      </span>
                    </div>
                    {selectedInvoice.due_date && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Due:</span>
                        <span className="font-medium text-slate-800">
                          {format(new Date(selectedInvoice.due_date), "MMM dd, yyyy")}
                        </span>
                      </div>
                    )}
                    {selectedInvoice.payment_method && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Payment:</span>
                        <span className="font-medium text-slate-800">{selectedInvoice.payment_method}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Invoice Items */}
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base text-slate-800 flex items-center gap-2">
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
                        <TableRow className="border-slate-200">
                          <TableHead className="font-semibold text-slate-700">Description</TableHead>
                          <TableHead className="font-semibold text-slate-700">Qty</TableHead>
                          <TableHead className="font-semibold text-slate-700">Price</TableHead>
                          <TableHead className="font-semibold text-slate-700">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceItems.map((item) => (
                          <TableRow key={item.id} className="border-slate-100">
                            <TableCell className="font-medium">{item.description}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>${item.unit_price.toFixed(2)}</TableCell>
                            <TableCell className="font-semibold">${item.total_price.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Invoice Totals */}
              <Card className="bg-gradient-to-br from-slate-50 to-blue-50 border-slate-200">
                <CardContent className="p-6">
                  <div className="flex justify-end">
                    <div className="w-80 space-y-3">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal:</span>
                        <span className="font-semibold">${selectedInvoice.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Tax (8.5%):</span>
                        <span className="font-semibold">${selectedInvoice.tax_amount.toFixed(2)}</span>
                      </div>
                      {selectedInvoice.discount_amount > 0 && (
                        <div className="flex justify-between text-red-600">
                          <span>Discount:</span>
                          <span className="font-semibold">-${selectedInvoice.discount_amount.toFixed(2)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between text-xl font-bold text-slate-800">
                        <span>Total Amount:</span>
                        <span className="text-indigo-600">${selectedInvoice.total_amount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              {selectedInvoice.notes && (
                <Card className="border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-base text-slate-800">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600 whitespace-pre-wrap">{selectedInvoice.notes}</p>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <Button variant="outline" className="border-slate-300 text-slate-600 hover:bg-slate-50">
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
                <Button variant="outline" className="border-indigo-300 text-indigo-600 hover:bg-indigo-50">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button variant="outline" className="border-green-300 text-green-600 hover:bg-green-50">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Send WhatsApp
                </Button>
                <Button className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600">
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

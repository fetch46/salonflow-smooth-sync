import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Plus, Search, Receipt, DollarSign, FileText, Clock, MoreVertical, Eye, Edit, Send, Printer, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string | null;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  clients: { full_name: string } | null;
}

interface Client {
  id: string;
  full_name: string;
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    invoice_number: "",
    client_id: "",
    issue_date: "",
    due_date: "",
    subtotal: "",
    tax_amount: "",
    total_amount: "",
    status: "draft",
    notes: "",
  });

  useEffect(() => {
    fetchInvoices();
    fetchClients();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("invoices")
        .select(`*, clients (full_name)`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      toast({
        title: "Error",
        description: "Failed to fetch invoices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  const generateInvoiceNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `INV-${timestamp}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const invoiceData = {
        ...formData,
        invoice_number: formData.invoice_number || generateInvoiceNumber(),
        client_id: formData.client_id || null,
        subtotal: parseFloat(formData.subtotal) || 0,
        tax_amount: parseFloat(formData.tax_amount) || 0,
        total_amount: parseFloat(formData.total_amount) || 0,
      };

      if (editingInvoice) {
        const { error } = await supabase
          .from("invoices")
          .update(invoiceData)
          .eq("id", editingInvoice.id);

        if (error) throw error;
        toast({ title: "Success", description: "Invoice updated successfully" });
      } else {
        const { error } = await supabase.from("invoices").insert([invoiceData]);
        if (error) throw error;
        toast({ title: "Success", description: "Invoice created successfully" });
      }

      setIsModalOpen(false);
      setEditingInvoice(null);
      resetForm();
      fetchInvoices();
    } catch (error) {
      console.error("Error saving invoice:", error);
      toast({
        title: "Error",
        description: "Failed to save invoice",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setFormData({
      invoice_number: invoice.invoice_number,
      client_id: invoice.client_id || "",
      issue_date: invoice.issue_date,
      due_date: invoice.due_date || "",
      subtotal: invoice.subtotal.toString(),
      tax_amount: invoice.tax_amount.toString(),
      total_amount: invoice.total_amount.toString(),
      status: invoice.status,
      notes: invoice.notes || "",
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this invoice?")) {
      try {
        const { error } = await supabase.from("invoices").delete().eq("id", id);
        if (error) throw error;
        toast({ title: "Success", description: "Invoice deleted successfully" });
        fetchInvoices();
      } catch (error) {
        console.error("Error deleting invoice:", error);
        toast({
          title: "Error",
          description: "Failed to delete invoice",
          variant: "destructive",
        });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      invoice_number: "",
      client_id: "",
      issue_date: "",
      due_date: "",
      subtotal: "",
      tax_amount: "",
      total_amount: "",
      status: "draft",
      notes: "",
    });
  };

  const filteredInvoices = invoices.filter((invoice) =>
    invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.clients?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const statusColors = {
      draft: "bg-gray-100 text-gray-800",
      sent: "bg-blue-100 text-blue-800",
      paid: "bg-green-100 text-green-800",
      overdue: "bg-red-100 text-red-800",
      cancelled: "bg-red-100 text-red-800",
    };

    return (
      <Badge className={statusColors[status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const stats = {
    total: invoices.length,
    draft: invoices.filter(i => i.status === 'draft').length,
    sent: invoices.filter(i => i.status === 'sent').length,
    paid: invoices.filter(i => i.status === 'paid').length,
    totalAmount: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total_amount, 0),
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading invoices...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="w-full max-w-full mx-auto space-y-6 px-8 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Invoices</h2>
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingInvoice(null); resetForm(); }}>
                <Plus className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingInvoice ? "Edit Invoice" : "Create New Invoice"}</DialogTitle>
                <DialogDescription>
                  {editingInvoice ? "Update the invoice details." : "Fill in the invoice information."}
                </DialogDescription>
              </DialogHeader>
              {/* Your form goes here */}
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card><CardHeader className="flex justify-between pb-2"><CardTitle className="text-sm font-medium">Total Invoices</CardTitle><Receipt className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
          <Card><CardHeader className="flex justify-between pb-2"><CardTitle className="text-sm font-medium">Draft</CardTitle><FileText className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.draft}</div></CardContent></Card>
          <Card><CardHeader className="flex justify-between pb-2"><CardTitle className="text-sm font-medium">Sent</CardTitle><Clock className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.sent}</div></CardContent></Card>
          <Card><CardHeader className="flex justify-between pb-2"><CardTitle className="text-sm font-medium">Total Paid</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">${stats.totalAmount.toFixed(2)}</div><p className="text-xs text-muted-foreground">{stats.paid} invoices</p></CardContent></Card>
        </div>

        {/* Search */}
        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search invoices..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" />
        </div>

        {/* Invoices Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Invoices</CardTitle>
            <CardDescription>Manage your invoices and track payments.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>{invoice.clients?.full_name || "N/A"}</TableCell>
                    <TableCell>{format(new Date(invoice.issue_date), "MMM dd, yyyy")}</TableCell>
                    <TableCell>{invoice.due_date ? format(new Date(invoice.due_date), "MMM dd, yyyy") : "N/A"}</TableCell>
                    <TableCell>${invoice.total_amount.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => alert("Viewing invoice...")}><Eye className="mr-2 h-4 w-4" /> View Invoice</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(invoice)}><Edit className="mr-2 h-4 w-4" /> Edit Invoice</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => alert("Sending invoice...")}><Send className="mr-2 h-4 w-4" /> Send Invoice</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => alert("Printing invoice...")}><Printer className="mr-2 h-4 w-4" /> Print Invoice</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(invoice.id)} className="text-red-600"><Trash2 className="mr-2 h-4 w-4" /> Delete Invoice</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

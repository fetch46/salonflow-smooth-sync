import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Users,
  UserPlus,
  UserX,
  Eye,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Customer {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const initialFormState = {
  full_name: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
  is_active: true,
};

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast({
        title: "Error",
        description: "Failed to fetch customer data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.full_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Full Name is required.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingCustomer) {
        const { error } = await supabase
          .from("clients")
          .update(formData)
          .eq("id", editingCustomer.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: `Customer '${formData.full_name}' updated successfully.`,
        });
      } else {
        const { error } = await supabase.from("clients").insert([formData]);

        if (error) throw error;

        toast({
          title: "Success",
          description: `New customer '${formData.full_name}' added successfully.`,
        });
      }

      fetchCustomers();
      resetForm();
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving customer:", error);
      toast({
        title: "Error",
        description: "Failed to save customer data.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setEditingCustomer(null);
  };

  const handleEdit = (customer: Customer) => {
    setFormData({
      full_name: customer.full_name,
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      notes: customer.notes || "",
      is_active: customer.is_active,
    });
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (customer: Customer) => {
    const newStatus = !customer.is_active;
    try {
      const { error } = await supabase
        .from("clients")
        .update({ is_active: newStatus })
        .eq("id", customer.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Customer '${customer.full_name}' is now ${newStatus ? "active" : "inactive"}.`,
      });
      fetchCustomers();
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: "Failed to update customer status.",
        variant: "destructive",
      });
    }
  };

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.includes(searchTerm)
  );

  const totalCustomers = customers.length;
  const activeCustomers = customers.filter((c) => c.is_active).length;
  const inactiveCustomers = totalCustomers - activeCustomers;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header & Stats */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Customer Management</h1>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" /> Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingCustomer ? "Edit Customer" : "Add New Customer"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="full_name">Full Name <span className="text-red-500">*</span></Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingCustomer ? "Update Customer" : "Create Customer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <UserPlus className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCustomers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Customers</CardTitle>
            <UserX className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inactiveCustomers}</div>
          </CardContent>
        </Card>
      </div>
      
      <hr className="my-6" />

      {/* Search & Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No customers found.</p>
              <p className="text-sm text-muted-foreground mt-1">
                You can add a new customer to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="p-3 text-left font-semibold">Name</th>
                    <th className="p-3 text-left font-semibold">Email</th>
                    <th className="p-3 text-left font-semibold">Phone</th>
                    <th className="p-3 text-left font-semibold">Status</th>
                    <th className="p-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="border-b hover:bg-muted/30">
                      <td className="p-3">{customer.full_name}</td>
                      <td className="p-3">{customer.email || "—"}</td>
                      <td className="p-3">{customer.phone || "—"}</td>
                      <td className="p-3">
                        <Badge variant={customer.is_active ? "default" : "secondary"}>
                          {customer.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-5 h-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => alert("View profile feature coming soon")}>
                              <Eye className="mr-2 w-4 h-4" /> View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(customer)}>
                              <Edit2 className="mr-2 w-4 h-4" /> Edit Customer
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleToggleStatus(customer)}
                            >
                              {customer.is_active ? (
                                <>
                                  <UserX className="mr-2 w-4 h-4" /> Deactivate
                                </>
                              ) : (
                                <>
                                  <UserPlus className="mr-2 w-4 h-4" /> Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(customer.id)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 w-4 h-4" /> Delete Customer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

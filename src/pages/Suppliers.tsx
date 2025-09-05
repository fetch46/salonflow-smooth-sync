import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Package, Users, Building, Edit2, Trash2, Eye, Phone, Mail, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useSaas } from "@/lib/saas";

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  website: string | null;
  tax_id: string | null;
  payment_terms: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
    website: "",
    tax_id: "",
    payment_terms: "",
    notes: ""
  });
  const navigate = useNavigate();
  const { organization } = useSaas();

  useEffect(() => {
    fetchSuppliers();
  }, [organization?.id]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("suppliers")
        .select("*")
        .order("name");

      if (organization?.id) {
        query = query.eq("organization_id", organization.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      toast.error("Failed to fetch suppliers");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      if (!organization?.id) {
        toast.error("No organization selected");
        return;
      }
      
      if (editingSupplier) {
        const { error } = await supabase
          .from("suppliers")
          .update({
            ...formData,
            website: normalizeUrl(formData.website),
          })
          .eq("id", editingSupplier.id);

        if (error) throw error;
        toast.success("Supplier updated successfully");
      } else {
        const payload = {
          ...formData,
          website: normalizeUrl(formData.website),
          organization_id: organization.id,
          is_active: true,
        };

        const { error } = await supabase
          .from("suppliers")
          .insert([payload]);

        if (error) throw error;
        toast.success("Supplier created successfully");
      }

      setIsCreateModalOpen(false);
      setEditingSupplier(null);
      setFormData({
        name: "",
        contact_person: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        postal_code: "",
        country: "",
        website: "",
        tax_id: "",
        payment_terms: "",
        notes: ""
      });
      fetchSuppliers();
    } catch (error) {
      console.error("Error saving supplier:", error);
      toast.error("Failed to save supplier");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      city: supplier.city || "",
      state: supplier.state || "",
      postal_code: supplier.postal_code || "",
      country: supplier.country || "",
      website: supplier.website || "",
      tax_id: supplier.tax_id || "",
      payment_terms: supplier.payment_terms || "",
      notes: supplier.notes || ""
    });
    setIsCreateModalOpen(true);
  };

  const handleDelete = async (supplierId: string) => {
    if (!confirm("Are you sure you want to delete this supplier?")) return;
    
    try {
      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", supplierId);

      if (error) throw error;
      toast.success("Supplier deleted successfully");
      fetchSuppliers();
    } catch (error) {
      console.error("Error deleting supplier:", error);
      toast.error("Failed to delete supplier");
    }
  };

  const toggleSupplierStatus = async (supplier: Supplier) => {
    try {
      const { error } = await supabase
        .from("suppliers")
        .update({ is_active: !supplier.is_active })
        .eq("id", supplier.id);

      if (error) throw error;
      toast.success(`Supplier ${supplier.is_active ? 'deactivated' : 'activated'} successfully`);
      fetchSuppliers();
    } catch (error) {
      console.error("Error updating supplier status:", error);
      toast.error("Failed to update supplier status");
    }
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeSuppliers = suppliers.filter(s => s.is_active).length;
  const inactiveSuppliers = suppliers.filter(s => !s.is_active).length;

  const normalizeUrl = (url: string | null): string | null => {
    if (!url) return null;
    return url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Suppliers</h1>
          <p className="text-muted-foreground">
            Manage supplier information and relationships
          </p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSupplier ? "Edit Supplier" : "Create New Supplier"}
              </DialogTitle>
              <DialogDescription>
                Add or update supplier information and contact details.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Supplier Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => setFormData({...formData, website: e.target.value})}
                    placeholder="https://example.com"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="state">State/Province</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({...formData, state: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({...formData, postal_code: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData({...formData, country: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="tax_id">Tax ID</Label>
                  <Input
                    id="tax_id"
                    value={formData.tax_id}
                    onChange={(e) => setFormData({...formData, tax_id: e.target.value})}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="payment_terms">Payment Terms</Label>
                <Input
                  id="payment_terms"
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({...formData, payment_terms: e.target.value})}
                  placeholder="e.g., Net 30, COD, etc."
                />
              </div>
              
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Additional notes about the supplier"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : editingSupplier ? "Update Supplier" : "Create Supplier"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Suppliers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suppliers.length}</div>
            <p className="text-xs text-muted-foreground">All suppliers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Suppliers</CardTitle>
            <Building className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSuppliers}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Suppliers</CardTitle>
            <Package className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inactiveSuppliers}</div>
            <p className="text-xs text-muted-foreground">Currently inactive</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Plus className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {suppliers.filter(s => 
                new Date(s.created_at).getMonth() === new Date().getMonth()
              ).length}
            </div>
            <p className="text-xs text-muted-foreground">New suppliers</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Suppliers</CardTitle>
              <CardDescription>
                Manage your supplier database and contact information
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search suppliers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">
                    <Button variant="link" className="px-0 h-auto text-primary hover:underline" onClick={() => navigate(`/suppliers/${supplier.id}`)}>
                      {supplier.name}
                    </Button>
                  </TableCell>
                  <TableCell>{supplier.contact_person || "-"}</TableCell>
                  <TableCell>
                    {supplier.email ? (
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {supplier.email}
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    {supplier.phone ? (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {supplier.phone}
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    {supplier.city && supplier.state ? (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {supplier.city}, {supplier.state}
                      </div>
                    ) : supplier.city || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={supplier.is_active ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => toggleSupplierStatus(supplier)}
                    >
                      {supplier.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/suppliers/${supplier.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(supplier)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(supplier.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Removed old modal-based Supplier Details view in favor of dedicated page */}
    </div>
  );
}
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
import { Plus, Search, Building, Phone, Mail, MapPin, Edit2, Trash2, Star, Package } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  supplier_type: string | null;
  payment_terms: string | null;
  tax_id: string | null;
  website: string | null;
  notes: string | null;
  is_active: boolean;
  rating: number | null;
  created_at: string;
  updated_at: string;
}

const SUPPLIER_TYPES = [
  "Product Supplier",
  "Equipment Supplier",
  "Service Provider",
  "Maintenance",
  "Utilities",
  "Professional Services",
  "Other"
];

const PAYMENT_TERMS = [
  "Net 30",
  "Net 15",
  "Net 7",
  "Due on Receipt",
  "Cash on Delivery",
  "2/10 Net 30",
  "Custom"
];

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    country: "US",
    supplier_type: "",
    payment_terms: "",
    tax_id: "",
    website: "",
    notes: "",
    is_active: true,
    rating: 5,
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("name");

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
      const supplierData = {
        ...formData,
        rating: Number(formData.rating),
      };

      if (editingSupplier) {
        const { error } = await supabase
          .from("suppliers")
          .update(supplierData)
          .eq("id", editingSupplier.id);

        if (error) throw error;
        toast.success("Supplier updated successfully");
      } else {
        const { error } = await supabase
          .from("suppliers")
          .insert([supplierData]);

        if (error) throw error;
        toast.success("Supplier created successfully");
      }

      resetForm();
      setIsModalOpen(false);
      fetchSuppliers();
    } catch (error) {
      console.error("Error saving supplier:", error);
      toast.error("Failed to save supplier");
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      city: supplier.city || "",
      state: supplier.state || "",
      zip_code: supplier.zip_code || "",
      country: supplier.country || "US",
      supplier_type: supplier.supplier_type || "",
      payment_terms: supplier.payment_terms || "",
      tax_id: supplier.tax_id || "",
      website: supplier.website || "",
      notes: supplier.notes || "",
      is_active: supplier.is_active,
      rating: supplier.rating || 5,
    });
    setEditingSupplier(supplier);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this supplier?")) {
      try {
        const { error } = await supabase
          .from("suppliers")
          .delete()
          .eq("id", id);

        if (error) throw error;
        toast.success("Supplier deleted successfully");
        fetchSuppliers();
      } catch (error) {
        console.error("Error deleting supplier:", error);
        toast.error("Failed to delete supplier");
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      contact_person: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zip_code: "",
      country: "US",
      supplier_type: "",
      payment_terms: "",
      tax_id: "",
      website: "",
      notes: "",
      is_active: true,
      rating: 5,
    });
    setEditingSupplier(null);
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.supplier_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderStars = (rating: number) => {
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? "text-yellow-400 fill-current"
                : "text-gray-300"
            }`}
          />
        ))}
      </div>
    );
  };

  const getStatusBadge = (isActive: boolean) => {
    return (
      <Badge variant={isActive ? "default" : "secondary"}>
        {isActive ? "Active" : "Inactive"}
      </Badge>
    );
  };

  const getSupplierTypeColor = (type: string | null) => {
    const colors = {
      "Product Supplier": "bg-blue-100 text-blue-800",
      "Equipment Supplier": "bg-purple-100 text-purple-800",
      "Service Provider": "bg-green-100 text-green-800",
      "Maintenance": "bg-orange-100 text-orange-800",
      "Utilities": "bg-yellow-100 text-yellow-800",
      "Professional Services": "bg-pink-100 text-pink-800",
      "Other": "bg-gray-100 text-gray-800"
    };
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  // Statistics
  const totalSuppliers = suppliers.length;
  const activeSuppliers = suppliers.filter(s => s.is_active).length;
  const averageRating = suppliers.length > 0 
    ? (suppliers.reduce((sum, s) => sum + (s.rating || 0), 0) / suppliers.length).toFixed(1)
    : "0";

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            Suppliers Management
          </h1>
          <p className="text-muted-foreground">
            Manage your supplier relationships and contacts
          </p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="bg-gradient-to-r from-pink-500 to-purple-600">
              <Plus className="w-4 h-4 mr-2" />
              Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSupplier ? "Edit Supplier" : "Add New Supplier"}
              </DialogTitle>
              <DialogDescription>
                {editingSupplier ? "Update supplier information" : "Add a new supplier to your database"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Supplier Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="supplier_type">Supplier Type</Label>
                  <Select value={formData.supplier_type} onValueChange={(value) => setFormData({ ...formData, supplier_type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier type" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPLIER_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="zip_code">ZIP Code</Label>
                  <Input
                    id="zip_code"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Select value={formData.country} onValueChange={(value) => setFormData({ ...formData, country: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="CA">Canada</SelectItem>
                      <SelectItem value="UK">United Kingdom</SelectItem>
                      <SelectItem value="AU">Australia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="payment_terms">Payment Terms</Label>
                  <Select value={formData.payment_terms} onValueChange={(value) => setFormData({ ...formData, payment_terms: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment terms" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TERMS.map((term) => (
                        <SelectItem key={term} value={term}>
                          {term}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="tax_id">Tax ID</Label>
                  <Input
                    id="tax_id"
                    value={formData.tax_id}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://"
                  />
                </div>
                <div>
                  <Label htmlFor="rating">Rating (1-5)</Label>
                  <Select value={formData.rating.toString()} onValueChange={(value) => setFormData({ ...formData, rating: Number(value) })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <SelectItem key={rating} value={rating.toString()}>
                          {rating} Star{rating !== 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-gradient-to-r from-pink-500 to-purple-600">
                  {editingSupplier ? "Update" : "Create"} Supplier
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Total Suppliers</CardTitle>
            <Building className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{totalSuppliers}</div>
            <p className="text-xs text-blue-600">Registered suppliers</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Active Suppliers</CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{activeSuppliers}</div>
            <p className="text-xs text-green-600">Currently active</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-700">Average Rating</CardTitle>
            <Star className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">{averageRating}</div>
            <p className="text-xs text-yellow-600">Out of 5 stars</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700">Product Suppliers</CardTitle>
            <Package className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              {suppliers.filter(s => s.supplier_type === 'Product Supplier').length}
            </div>
            <p className="text-xs text-purple-600">Main suppliers</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-pink-600" />
            Suppliers
          </CardTitle>
          <CardDescription>
            Manage your supplier database and relationships
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading suppliers...</p>
              </div>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No suppliers found matching your search" : "No suppliers found"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Payment Terms</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{supplier.name}</div>
                        {supplier.contact_person && (
                          <div className="text-sm text-muted-foreground">
                            {supplier.contact_person}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {supplier.email && (
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="w-3 h-3" />
                            {supplier.email}
                          </div>
                        )}
                        {supplier.phone && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="w-3 h-3" />
                            {supplier.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {supplier.supplier_type && (
                        <Badge className={getSupplierTypeColor(supplier.supplier_type)}>
                          {supplier.supplier_type}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{supplier.payment_terms || "—"}</TableCell>
                    <TableCell>{renderStars(supplier.rating || 0)}</TableCell>
                    <TableCell>{getStatusBadge(supplier.is_active)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(supplier)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(supplier.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
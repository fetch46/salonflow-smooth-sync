import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Mail, Phone, MapPin, Calendar, Building, ShoppingCart, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface PurchaseRow {
  id: string;
  purchase_number: string;
  purchase_date: string;
  total_amount: number;
  status: string;
}

export default function SupplierProfile() {
  const { id } = useParams<{ id: string }>();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
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
    notes: "",
  });

  const normalizeUrl = (url: string | null): string | null => {
    if (!url) return null;
    return url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
  };

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const { data: supplierData, error: supplierError } = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", id)
        .single();

      if (supplierError) throw supplierError;
      setSupplier(supplierData);

      setEditForm({
        name: supplierData.name || "",
        contact_person: supplierData.contact_person || "",
        email: supplierData.email || "",
        phone: supplierData.phone || "",
        address: supplierData.address || "",
        city: supplierData.city || "",
        state: supplierData.state || "",
        postal_code: supplierData.postal_code || "",
        country: supplierData.country || "",
        website: supplierData.website || "",
        tax_id: supplierData.tax_id || "",
        payment_terms: supplierData.payment_terms || "",
        notes: supplierData.notes || "",
      });

      // Link purchases by vendor_name matching supplier.name
      const { data: purchasesData, error: purchasesError } = await supabase
        .from("purchases")
        .select("id, purchase_number, purchase_date, total_amount, status")
        .eq("vendor_name", supplierData.name)
        .order("purchase_date", { ascending: false });

      if (purchasesError) throw purchasesError;
      setPurchases((purchasesData || []) as PurchaseRow[]);
    } catch (error) {
      console.error("Error fetching supplier profile:", error);
      toast.error("Failed to load supplier profile");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalSpent = useMemo(() => purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0), [purchases]);
  const lastPurchaseDate = purchases.length > 0 ? purchases[0].purchase_date : null;

  const handleEdit = () => setIsEditing(true);
  const handleCancelEdit = () => {
    setIsEditing(false);
    if (supplier) {
      setEditForm({
        name: supplier.name || "",
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
        notes: supplier.notes || "",
      });
    }
  };

  const handleSaveEdit = async () => {
    try {
      const { error } = await supabase
        .from("suppliers")
        .update({
          name: editForm.name,
          contact_person: editForm.contact_person,
          email: editForm.email,
          phone: editForm.phone,
          address: editForm.address,
          city: editForm.city,
          state: editForm.state,
          postal_code: editForm.postal_code,
          country: editForm.country,
          website: editForm.website,
          tax_id: editForm.tax_id,
          payment_terms: editForm.payment_terms,
          notes: editForm.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
      toast.success("Supplier updated successfully");
      setIsEditing(false);
      fetchData();
    } catch (error) {
      console.error("Error updating supplier:", error);
      toast.error("Failed to update supplier");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading supplier profile...</p>
        </div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-muted-foreground">Supplier not found</h2>
          <p className="text-muted-foreground">The requested supplier could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-violet-600 rounded-full flex items-center justify-center">
              <Building className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              {isEditing ? (
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="text-3xl font-bold bg-transparent border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                  style={{
                    background: 'linear-gradient(to right, rgb(59 130 246), rgb(139 92 246))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                />
              ) : (
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                  {supplier.name}
                </h1>
              )}
              <p className="text-muted-foreground text-lg">
                Supplier since {format(new Date(supplier.created_at), "MMMM yyyy")}
              </p>
            </div>
            <div className="flex flex-col items-end space-y-2">
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button size="sm" onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700">
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={handleEdit} className="bg-gradient-to-r from-blue-500 to-violet-600">
                    Edit
                  </Button>
                )}
              </div>
              <div className="flex flex-col items-end space-y-1">
                <Badge variant={supplier.is_active ? "default" : "secondary"}>
                  {supplier.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700">Total Spent</CardTitle>
            <ShoppingCart className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">${totalSpent.toFixed(2)}</div>
            <p className="text-xs text-emerald-600">Across {purchases.length} purchases</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Purchases</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{purchases.length}</div>
            <p className="text-xs text-blue-600">Total orders</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700">Last Purchase</CardTitle>
            <Calendar className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              {lastPurchaseDate ? format(new Date(lastPurchaseDate), "MMM dd, yyyy") : "—"}
            </div>
            <p className="text-xs text-purple-600">Most recent order date</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">Contact</CardTitle>
            <Phone className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-orange-700">
              {supplier.email && (
                <div className="flex items-center text-xs">
                  <Mail className="w-3 h-3 mr-1" />
                  <span className="truncate">{supplier.email}</span>
                </div>
              )}
              {supplier.phone && (
                <div className="flex items-center text-xs">
                  <Phone className="w-3 h-3 mr-1" />
                  {supplier.phone}
                </div>
              )}
              {supplier.address && (
                <div className="flex items-center text-xs">
                  <MapPin className="w-3 h-3 mr-1" />
                  <span className="truncate">{supplier.address}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-pink-700">Website</CardTitle>
            <ExternalLink className="h-4 w-4 text-pink-600" />
          </CardHeader>
          <CardContent>
            <div className="text-sm text-pink-700 truncate">
              {supplier.website ? (
                <a href={normalizeUrl(supplier.website) as string} className="hover:underline" target="_blank" rel="noreferrer">
                  {supplier.website}
                </a>
              ) : (
                "Not specified"
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="purchases" className="space-y-4">
        <TabsList>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="purchases" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Purchase History</CardTitle>
              <CardDescription>All purchases recorded for this supplier</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.purchase_number}</TableCell>
                        <TableCell>{format(new Date(p.purchase_date), "MMM dd, yyyy")}</TableCell>
                        <TableCell>
                          <Badge>{(p.status || '').toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>${(p.total_amount || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Company & Contact</CardTitle>
              <CardDescription>Primary supplier information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Supplier Name</Label>
                  <Input
                    value={editForm.name}
                    disabled={!isEditing}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Contact Person</Label>
                  <Input
                    value={editForm.contact_person}
                    disabled={!isEditing}
                    onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input
                    type="email"
                    value={editForm.email}
                    disabled={!isEditing}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Phone</Label>
                  <Input
                    value={editForm.phone}
                    disabled={!isEditing}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Website</Label>
                  <Input
                    value={editForm.website}
                    disabled={!isEditing}
                    onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Tax ID</Label>
                  <Input
                    value={editForm.tax_id}
                    disabled={!isEditing}
                    onChange={(e) => setEditForm({ ...editForm, tax_id: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Payment Terms</Label>
                  <Input
                    value={editForm.payment_terms}
                    disabled={!isEditing}
                    onChange={(e) => setEditForm({ ...editForm, payment_terms: e.target.value })}
                    placeholder="e.g., Net 30, COD, etc."
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Address</Label>
                  <Input
                    value={editForm.address}
                    disabled={!isEditing}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">City</Label>
                  <Input
                    value={editForm.city}
                    disabled={!isEditing}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">State/Province</Label>
                  <Input
                    value={editForm.state}
                    disabled={!isEditing}
                    onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Postal Code</Label>
                  <Input
                    value={editForm.postal_code}
                    disabled={!isEditing}
                    onChange={(e) => setEditForm({ ...editForm, postal_code: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Country</Label>
                  <Input
                    value={editForm.country}
                    disabled={!isEditing}
                    onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <Textarea
                    value={editForm.notes}
                    disabled={!isEditing}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    placeholder="Additional notes about the supplier"
                  />
                </div>
              </div>
              {isEditing && (
                <div className="flex justify-end mt-4 gap-2">
                  <Button variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                  <Button onClick={handleSaveEdit}>Save Changes</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
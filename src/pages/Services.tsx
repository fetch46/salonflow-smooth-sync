import React, { useState, useEffect, useMemo } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Clock,
  DollarSign,
  Tag,
  TrendingUp,
  Package,
  Star,
  Eye,
  MoreVertical,
  X,
  ShoppingCart,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Service {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
  category?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface BookingService {
  service_id: string;
  service_name: string;
  total_bookings: number;
  total_revenue: number;
}

const MOCK_BOOKINGS: BookingService[] = [
  { service_id: "1", service_name: "Classic Facial", total_bookings: 42, total_revenue: 2520 },
  { service_id: "2", service_name: "Haircut & Style", total_bookings: 38, total_revenue: 2280 },
  { service_id: "3", service_name: "Deep Tissue Massage", total_bookings: 27, total_revenue: 2160 },
  { service_id: "4", service_name: "Gel Manicure", total_bookings: 33, total_revenue: 1650 },
  { service_id: "5", service_name: "Balayage", total_bookings: 15, total_revenue: 1500 },
];

const SERVICE_CATEGORIES = [
  "Hair Services",
  "Nail Services",
  "Facial Treatments",
  "Body Treatments",
  "Massage Therapy",
  "Makeup Services",
  "Special Treatments",
];

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [serviceKits, setServiceKits] = useState<any[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    duration_minutes: 60,
    price: 0,
    category: "",
    is_active: true,
  });

  useEffect(() => {
    fetchServices();
    fetchAvailableProducts();
  }, []);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
      toast({
        title: "Error",
        description: "Failed to fetch services",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, name, type, category, unit, cost_price, selling_price")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setAvailableProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const fetchServiceKits = async (serviceId: string) => {
    try {
      const { data, error } = await supabase
        .from("service_kits")
        .select(`
          id, good_id, default_quantity,
          inventory_items!service_kits_good_id_fkey (id, name, type, unit, cost_price)
        `)
        .eq("service_id", serviceId);

      if (error) throw error;
      setServiceKits(data || []);
    } catch (error) {
      console.error("Error fetching service kits:", error);
    }
  };

  const addKitItem = (productId: string) => {
    const product = availableProducts.find(p => p.id === productId);
    if (product && !serviceKits.find(kit => kit.good_id === productId)) {
      setServiceKits(prev => [
        ...prev,
        {
          id: null, // New item
          good_id: productId,
          default_quantity: 1,
          inventory_items: product
        }
      ]);
    }
  };

  const updateKitQuantity = (productId: string, quantity: number) => {
    setServiceKits(prev => 
      prev.map(kit => 
        kit.good_id === productId 
          ? { ...kit, default_quantity: Math.max(0, quantity) }
          : kit
      )
    );
  };

  const removeKitItem = (productId: string) => {
    setServiceKits(prev => prev.filter(kit => kit.good_id !== productId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let serviceId = editingService?.id;

      if (editingService) {
        // Update existing service
        const { error } = await supabase
          .from("services")
          .update(formData)
          .eq("id", editingService.id);
        if (error) throw error;
      } else {
        // Create new service
        const { data, error } = await supabase
          .from("services")
          .insert([formData])
          .select()
          .single();
        if (error) throw error;
        serviceId = data.id;
      }

      // Save service kits
      if (serviceId) {
        // Delete existing kits for this service
        await supabase
          .from("service_kits")
          .delete()
          .eq("service_id", serviceId);

        // Insert new kits
        if (serviceKits.length > 0) {
          const kitData = serviceKits.map(kit => ({
            service_id: serviceId,
            good_id: kit.good_id,
            default_quantity: kit.default_quantity
          }));

          const { error: kitError } = await supabase
            .from("service_kits")
            .insert(kitData);

          if (kitError) throw kitError;
        }
      }

      toast({ 
        title: "Success", 
        description: editingService ? "Service updated successfully" : "Service created successfully" 
      });
      fetchServices();
      resetForm();
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving service:", error);
      toast({
        title: "Error",
        description: "Failed to save service",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      duration_minutes: 60,
      price: 0,
      category: "",
      is_active: true,
    });
    setEditingService(null);
    setServiceKits([]);
  };

  const handleEdit = (service: Service) => {
    setFormData({
      name: service.name,
      description: service.description || "",
      duration_minutes: service.duration_minutes,
      price: service.price,
      category: service.category || "",
      is_active: service.is_active,
    });
    setEditingService(service);
    fetchServiceKits(service.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this service?")) {
      try {
        const { error } = await supabase.from("services").delete().eq("id", id);
        if (error) throw error;
        toast({ title: "Success", description: "Service deleted successfully" });
        fetchServices();
      } catch (error) {
        console.error("Error deleting service:", error);
        toast({
          title: "Error",
          description: "Failed to delete service",
          variant: "destructive",
        });
      }
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  };

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesSearch =
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.category?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === "all" || service.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [services, searchTerm, categoryFilter]);

  const dashboard = useMemo(() => {
    const active = services.filter((s) => s.is_active).length;
    const inactive = services.length - active;
    const totalRevenue = MOCK_BOOKINGS.reduce((sum, b) => sum + b.total_revenue, 0);
    const bestSelling =
      MOCK_BOOKINGS.sort((a, b) => b.total_bookings - a.total_bookings).slice(0, 3) || [];
    return { active, inactive, totalRevenue, bestSelling };
  }, [services]);

  if (loading) {
    return <div className="p-6 text-center">Loading services...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* DASHBOARD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Services</CardTitle>
            <Package className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{services.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Services</CardTitle>
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Inactive Services</CardTitle>
            <Tag className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.inactive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(dashboard.totalRevenue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Best Selling */}
      {dashboard.bestSelling.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              Best-Selling Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dashboard.bestSelling.map((b, idx) => (
                <div key={b.service_id} className="flex justify-between text-sm">
                  <span className="font-medium">{idx + 1}. {b.service_name}</span>
                  <span>{b.total_bookings} bookings • {formatPrice(b.total_revenue)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header + Button */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Services Management</h1>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add Service
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingService ? "Edit Service" : "Add New Service"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Service Name *</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="duration">Duration (minutes) *</Label>
                  <Input id="duration" type="number" min="15" step="15" value={formData.duration_minutes} onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })} required />
                </div>
                <div>
                  <Label htmlFor="price">Price *</Label>
                  <Input id="price" type="number" min="0" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })} required />
                </div>
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Service Kit Section */}
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold">Service Kit - Product Items</Label>
                    <p className="text-sm text-muted-foreground">Select products and materials needed for this service</p>
                  </div>
                  <Badge variant="outline" className="ml-2">
                    {serviceKits.length} items
                  </Badge>
                </div>

                {/* Add Product Selection */}
                <div>
                  <Label htmlFor="addProduct">Add Product to Kit</Label>
                  <Select value="" onValueChange={addKitItem}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product to add..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProducts
                        .filter(product => !serviceKits.find(kit => kit.good_id === product.id))
                        .map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{product.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {product.type} • ${product.cost_price?.toFixed(2) || '0.00'}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Current Kit Items */}
                {serviceKits.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Kit Items</Label>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {serviceKits.map((kit) => (
                        <div key={kit.good_id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{kit.inventory_items.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {kit.inventory_items.type} • {kit.inventory_items.unit || 'Each'} • ${kit.inventory_items.cost_price?.toFixed(2) || '0.00'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <Label htmlFor={`qty-${kit.good_id}`} className="text-xs">Qty:</Label>
                              <Input
                                id={`qty-${kit.good_id}`}
                                type="number"
                                min="0"
                                step="0.1"
                                value={kit.default_quantity}
                                onChange={(e) => updateKitQuantity(kit.good_id, parseFloat(e.target.value) || 0)}
                                className="w-20 h-8 text-xs"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeKitItem(kit.good_id)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Kit Summary */}
                    <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg p-3 border border-pink-200">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Total Kit Cost</p>
                          <p className="text-xs text-muted-foreground">
                            Cost of all materials
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-pink-600">
                            ${serviceKits.reduce((total, kit) => 
                              total + (kit.default_quantity * (kit.inventory_items.cost_price || 0)), 0
                            ).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {serviceKits.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No kit items added yet</p>
                    <p className="text-xs">Select products above to build your service kit</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit">{editingService ? "Update" : "Create"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search services..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {SERVICE_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Services Table */}
      <div className="border rounded-md">
        {filteredServices.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {searchTerm || categoryFilter !== "all"
              ? "No services found matching your filters"
              : "No services found"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="p-3 text-left font-semibold">Name</th>
                  <th className="p-3 text-left font-semibold">Category</th>
                  <th className="p-3 text-left font-semibold">Duration</th>
                  <th className="p-3 text-left font-semibold">Price</th>
                  <th className="p-3 text-left font-semibold">Status</th>
                  <th className="p-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map((service) => (
                  <tr key={service.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium">{service.name}</td>
                    <td className="p-3">{service.category || "—"}</td>
                    <td className="p-3">{formatDuration(service.duration_minutes)}</td>
                    <td className="p-3">{formatPrice(service.price)}</td>
                    <td className="p-3">
                      <Badge variant={service.is_active ? "default" : "secondary"}>
                        {service.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => window.location.href = `/services/${service.id}`}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(service)}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(service.id)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
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
      </div>
    </div>
  );
                                                                                                                           }

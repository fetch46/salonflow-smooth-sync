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
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

// --- MOCK BOOKING DATA (replace with real query once bookings table exists) ---
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
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    duration_minutes: 60,
    price: 0,
    category: "",
    is_active: true,
  });

  /* -----------------  FETCHES ----------------- */
  useEffect(() => {
    fetchServices();
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

  /* -----------------  CRUD ----------------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingService) {
        const { error } = await supabase
          .from("services")
          .update(formData)
          .eq("id", editingService.id);
        if (error) throw error;
        toast({ title: "Success", description: "Service updated successfully" });
      } else {
        const { error } = await supabase.from("services").insert([formData]);
        if (error) throw error;
        toast({ title: "Success", description: "Service created successfully" });
      }
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

  /* -----------------  HELPERS ----------------- */
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

  /* -----------------  DASHBOARD METRICS ----------------- */
  const dashboard = useMemo(() => {
    const active = services.filter((s) => s.is_active).length;
    const inactive = services.length - active;
    const totalRevenue = MOCK_BOOKINGS.reduce((sum, b) => sum + b.total_revenue, 0);
    const bestSelling =
      MOCK_BOOKINGS.sort((a, b) => b.total_bookings - a.total_bookings).slice(0, 3) || [];
    return { active, inactive, totalRevenue, bestSelling };
  }, [services]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading services...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ================= MINI-DASHBOARD ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Services</CardTitle>
            <Package className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{services.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Services</CardTitle>
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Services</CardTitle>
            <Tag className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.inactive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(dashboard.totalRevenue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Best Selling Services */}
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
                <div key={b.service_id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{idx + 1}. {b.service_name}</span>
                  <span>
                    {b.total_bookings} bookings • {formatPrice(b.total_revenue)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================= HEADER + ADD BUTTON ================= */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Services Management</h1>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add Service
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingService ? "Edit Service" : "Add New Service"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Service Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="duration">Duration (minutes) *</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="15"
                    step="15"
                    value={formData.duration_minutes}
                    onChange={(e) =>
                      setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="price">Price *</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: parseFloat(e.target.value) })
                    }
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
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
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">{editingService ? "Update" : "Create"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ================= SEARCH / FILTERS ================= */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
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

      {/* ================= SERVICES TABLE ================= */}
      <div className="border rounded-md">
        {filteredServices.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchTerm || categoryFilter !== "all"
                ? "No services found matching your filters"
                : "No services found"}
            </p>
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
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(service)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(service.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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

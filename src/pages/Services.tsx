import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  Scissors,
  Sparkles,
  Crown,
  Activity,
  Target,
  RefreshCw,
  Download,
  ChevronRight,
  Filter,
  BarChart3,
  PieChart,
  Users,
  Calendar,
  Award,
  Zap,
  Heart,
  Palette,
  User,
  Timer,
  ArrowUpRight,
  ArrowDownRight,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  Info,
  LayoutGrid,
  Table as TableIcon
} from "lucide-react";
import { format } from "date-fns";
import ServicesTable from "@/components/services/ServicesTable";

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
  commission_rate?: number;
  popularity_score?: number;
  avg_rating?: number;
  total_bookings?: number;
}

interface ServiceKit {
  id: string | null;
  good_id: string;
  default_quantity: number;
  inventory_items: {
    id: string;
    name: string;
    type: string;
    unit: string;
    cost_price: number;
    selling_price?: number;
  };
}

interface BookingService {
  service_id: string;
  service_name: string;
  total_bookings: number;
  total_revenue: number;
  avg_rating: number;
  growth_rate: number;
}

// Enhanced mock data with more realistic metrics
const ENHANCED_MOCK_BOOKINGS: BookingService[] = [
  { service_id: "1", service_name: "Signature Hair Cut & Style", total_bookings: 156, total_revenue: 9360, avg_rating: 4.9, growth_rate: 15.2 },
  { service_id: "2", service_name: "Premium Color Treatment", total_bookings: 98, total_revenue: 14700, avg_rating: 4.8, growth_rate: 23.1 },
  { service_id: "3", service_name: "Luxury Facial Package", total_bookings: 78, total_revenue: 11700, avg_rating: 4.9, growth_rate: 18.5 },
  { service_id: "4", service_name: "Deep Tissue Massage", total_bookings: 89, total_revenue: 10680, avg_rating: 4.7, growth_rate: 12.8 },
  { service_id: "5", service_name: "Gel Manicure Deluxe", total_bookings: 134, total_revenue: 8040, avg_rating: 4.6, growth_rate: 8.9 },
  { service_id: "6", service_name: "Balayage Highlight", total_bookings: 65, total_revenue: 13000, avg_rating: 4.8, growth_rate: 28.7 }
];

const SERVICE_CATEGORIES = [
  { name: "Hair Services", icon: Scissors, color: "from-pink-500 to-rose-500" },
  { name: "Nail Services", icon: Sparkles, color: "from-purple-500 to-violet-500" },
  { name: "Facial Treatments", icon: Heart, color: "from-emerald-500 to-teal-500" },
  { name: "Body Treatments", icon: User, color: "from-blue-500 to-cyan-500" },
  { name: "Massage Therapy", icon: Activity, color: "from-amber-500 to-orange-500" },
  { name: "Makeup Services", icon: Palette, color: "from-indigo-500 to-purple-500" },
  { name: "Special Treatments", icon: Crown, color: "from-violet-500 to-purple-500" },
];

const DURATION_OPTIONS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1 hour", value: 60 },
  { label: "1.5 hours", value: 90 },
  { label: "2 hours", value: 120 },
  { label: "2.5 hours", value: 150 },
  { label: "3 hours", value: 180 },
];

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [activeTab, setActiveTab] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<{ id: string; name: string; type: string; category: string | null; unit: string | null; cost_price: number | null; selling_price: number | null }[]>([]);
  const [serviceKits, setServiceKits] = useState<ServiceKit[]>([]);
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");
 
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    duration_minutes: 60,
    price: 0,
    category: "",
    is_active: true,
    commission_rate: 10,
  });

  // Mock function to enrich services with additional data
  const enrichServices = (services: Service[]): Service[] => {
    return services.map(service => ({
      ...service,
      commission_rate: 10 + Math.floor(Math.random() * 20), // 10-30%
      popularity_score: Math.floor(Math.random() * 100),
      avg_rating: 4.0 + Math.random() * 1.0, // 4.0-5.0
      total_bookings: Math.floor(Math.random() * 200) + 10
    }));
  };

  useEffect(() => {
    fetchServices();
    fetchAvailableProducts();
  }, []);

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setServices(enrichServices(data || []));
    } catch (error) {
      console.error("Error fetching services:", error);
      toast.error("Failed to fetch services");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshData = async () => {
    try {
      setRefreshing(true);
      await fetchServices();
      toast.success("Data refreshed successfully");
    } catch (error) {
      toast.error("Failed to refresh data");
    } finally {
      setRefreshing(false);
    }
  };

  const fetchAvailableProducts = useCallback(async () => {
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
  }, []);

  const fetchServiceKits = async (serviceId: string) => {
    try {
      const { data, error } = await supabase
        .from("service_kits")
        .select(`
          id, good_id, default_quantity,
          inventory_items!service_kits_good_id_fkey (id, name, type, unit, cost_price, selling_price)
        `)
        .eq("service_id", serviceId);

      if (error) throw error;
      
      const processedData = (data || []).map(kit => ({
        ...kit,
        inventory_items: kit.inventory_items as any
      }));
      
      setServiceKits(processedData);
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
          id: null,
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

      // Only send columns that exist on the services table
      const payload = {
        name: formData.name,
        description: formData.description || null,
        duration_minutes: formData.duration_minutes,
        price: formData.price,
        category: formData.category || null,
        is_active: formData.is_active,
      } as const;

      if (editingService) {
        const { error } = await supabase
          .from("services")
          .update(payload)
          .eq("id", editingService.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("services")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        serviceId = data.id;
      }

      // Save service kits
      if (serviceId) {
        await supabase
          .from("service_kits")
          .delete()
          .eq("service_id", serviceId);

        if (serviceKits.length > 0) {
          const kitData = serviceKits.map(kit => ({
            service_id: serviceId!,
            good_id: kit.good_id,
            default_quantity: kit.default_quantity
          }));

          const { error: kitError } = await supabase
            .from("service_kits")
            .insert(kitData);

          if (kitError) throw kitError;
        }
      }

      toast.success(editingService ? "Service updated successfully" : "Service created successfully");
      fetchServices();
      resetForm();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Error saving service:", error);
      toast.error(error?.message ? `Failed to save service: ${error.message}` : "Failed to save service");
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
      commission_rate: 10,
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
      commission_rate: service.commission_rate || 10,
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
        toast.success("Service deleted successfully");
        fetchServices();
      } catch (error) {
        console.error("Error deleting service:", error);
        toast.error("Failed to delete service");
      }
    }
  };

  const toggleServiceStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("services")
        .update({ is_active: !currentStatus })
        .eq("id", id);
      
      if (error) throw error;
      toast.success(`Service ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchServices();
    } catch (error) {
      console.error("Error updating service status:", error);
      toast.error("Failed to update service status");
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  };

  const getCategoryIcon = (categoryName: string) => {
    const category = SERVICE_CATEGORIES.find(cat => cat.name === categoryName);
    return category ? category.icon : Package;
  };

  const getCategoryColor = (categoryName: string) => {
    const category = SERVICE_CATEGORIES.find(cat => cat.name === categoryName);
    return category ? category.color : "from-gray-500 to-gray-600";
  };

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesSearch =
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.category?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === "all" || service.category === categoryFilter;
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "active" && service.is_active) ||
        (statusFilter === "inactive" && !service.is_active);
      return matchesSearch && matchesCategory && matchesStatus;
    }).sort((a, b) => {
      switch (sortBy) {
        case "price":
          return b.price - a.price;
        case "duration":
          return b.duration_minutes - a.duration_minutes;
        case "popularity":
          return (b.popularity_score || 0) - (a.popularity_score || 0);
        case "rating":
          return (b.avg_rating || 0) - (a.avg_rating || 0);
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [services, searchTerm, categoryFilter, statusFilter, sortBy]);

  const getTabServices = (tab: string) => {
    switch (tab) {
      case "popular":
        return filteredServices.filter(s => (s.popularity_score || 0) > 60);
      case "premium":
        return filteredServices.filter(s => s.price > 100);
      case "quick":
        return filteredServices.filter(s => s.duration_minutes <= 60);
      default:
        return filteredServices;
    }
  };

  const currentServices = getTabServices(activeTab);

  const dashboard = useMemo(() => {
    const active = services.filter((s) => s.is_active).length;
    const inactive = services.length - active;
    const totalRevenue = ENHANCED_MOCK_BOOKINGS.reduce((sum, b) => sum + b.total_revenue, 0);
    const totalBookings = ENHANCED_MOCK_BOOKINGS.reduce((sum, b) => sum + b.total_bookings, 0);
    const avgPrice = services.length > 0 ? services.reduce((sum, s) => sum + s.price, 0) / services.length : 0;
    const avgDuration = services.length > 0 ? services.reduce((sum, s) => sum + s.duration_minutes, 0) / services.length : 0;
    const avgRating = services.length > 0 ? services.reduce((sum, s) => sum + (s.avg_rating || 0), 0) / services.length : 0;
    
    const bestSelling = ENHANCED_MOCK_BOOKINGS
      .sort((a, b) => b.total_bookings - a.total_bookings)
      .slice(0, 3);
    
    const categoriesStats = SERVICE_CATEGORIES.map(cat => ({
      name: cat.name,
      count: services.filter(s => s.category === cat.name).length,
      revenue: ENHANCED_MOCK_BOOKINGS
        .filter(b => services.find(s => s.id === b.service_id && s.category === cat.name))
        .reduce((sum, b) => sum + b.total_revenue, 0),
      icon: cat.icon,
      color: cat.color
    })).filter(cat => cat.count > 0);

    return { 
      active, 
      inactive, 
      totalRevenue, 
      totalBookings, 
      avgPrice, 
      avgDuration, 
      avgRating, 
      bestSelling, 
      categoriesStats 
    };
  }, [services]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
          <p className="text-slate-600">Loading services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen">
      {/* Modern Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl shadow-lg">
              <Scissors className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Services Management</h1>
              <p className="text-slate-600">Manage salon services, pricing, and service kits</p>
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
                <ChevronRight className="w-4 h-4 ml-2 rotate-90" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Export Options</DropdownMenuLabel>
              <DropdownMenuItem>
                <BarChart3 className="w-4 h-4 mr-2" />
                Service Report
              </DropdownMenuItem>
              <DropdownMenuItem>
                <PieChart className="w-4 h-4 mr-2" />
                Analytics Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={resetForm}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Service
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
              <DialogHeader className="pb-4 border-b">
                <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Scissors className="w-5 h-5 text-purple-600" />
                  {editingService ? "Edit Service" : "Create New Service"}
                </DialogTitle>
                <DialogDescription className="text-slate-600">
                  {editingService ? "Update service details and kit items" : "Add a new service with pricing and kit configuration"}
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Service Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-600" />
                    Service Details
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="name">Service Name *</Label>
                      <Input 
                        id="name" 
                        value={formData.name} 
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                        placeholder="e.g., Premium Hair Cut & Style"
                        required 
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea 
                        id="description" 
                        value={formData.description} 
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                        rows={3}
                        placeholder="Describe what this service includes..."
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {SERVICE_CATEGORIES.map((category) => {
                            const IconComponent = category.icon;
                            return (
                              <SelectItem key={category.name} value={category.name}>
                                <div className="flex items-center gap-2">
                                  <IconComponent className="w-4 h-4" />
                                  {category.name}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="duration">Duration</Label>
                      <Select 
                        value={formData.duration_minutes.toString()} 
                        onValueChange={(value) => setFormData({ ...formData, duration_minutes: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DURATION_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value.toString()}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="price">Price *</Label>
                      <Input 
                        id="price" 
                        type="number" 
                        min="0" 
                        step="0.01" 
                        value={formData.price} 
                        onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} 
                        placeholder="0.00"
                        required 
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="commission_rate">Commission Rate (%)</Label>
                      <Input 
                        id="commission_rate" 
                        type="number" 
                        min="0" 
                        max="100" 
                        step="0.1" 
                        value={formData.commission_rate} 
                        onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) || 0 })} 
                        placeholder="10.0"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="is_active"
                          checked={formData.is_active}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                        />
                        <Label htmlFor="is_active">Service is active and bookable</Label>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Service Kit Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-green-600" />
                        Service Kit Configuration
                      </h3>
                      <p className="text-sm text-slate-600">Products and materials used for this service</p>
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
                                <span className="text-xs text-slate-500 ml-2">
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
                          <div key={kit.good_id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{kit.inventory_items.name}</div>
                              <div className="text-xs text-slate-500">
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
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Kit Summary */}
                      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium text-slate-700">Total Kit Cost</p>
                            <p className="text-xs text-slate-500">
                              Material costs for this service
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-emerald-600">
                              ${serviceKits.reduce((total, kit) => 
                                total + (kit.default_quantity * (kit.inventory_items.cost_price || 0)), 0
                              ).toFixed(2)}
                            </p>
                            <p className="text-xs text-slate-500">
                              Profit margin: {serviceKits.length > 0 ? 
                                ((formData.price - serviceKits.reduce((total, kit) => 
                                  total + (kit.default_quantity * (kit.inventory_items.cost_price || 0)), 0
                                )) / formData.price * 100).toFixed(1) : 0}%
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {serviceKits.length === 0 && (
                    <div className="text-center py-8 text-slate-500 border border-dashed rounded-lg bg-slate-50">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No kit items added yet</p>
                      <p className="text-xs">Select products above to build your service kit</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    {editingService ? "Update Service" : "Create Service"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Enhanced Statistics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600 opacity-100" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/90">Total Services</CardTitle>
            <Package className="h-4 w-4 text-white/80" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">{services.length}</div>
            <p className="text-xs text-white/80">
              {dashboard.active} active
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-600 opacity-100" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/90">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-white/80" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">{formatPrice(dashboard.totalRevenue)}</div>
            <p className="text-xs text-white/80">
              {dashboard.totalBookings} bookings
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-violet-600 opacity-100" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/90">Avg Price</CardTitle>
            <Tag className="h-4 w-4 text-white/80" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">{formatPrice(dashboard.avgPrice)}</div>
            <p className="text-xs text-white/80">
              Per service
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-amber-600 opacity-100" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/90">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-white/80" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">{formatDuration(dashboard.avgDuration)}</div>
            <p className="text-xs text-white/80">
              Service time
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-pink-600 opacity-100" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/90">Avg Rating</CardTitle>
            <Star className="h-4 w-4 text-white/80" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">{dashboard.avgRating.toFixed(1)}</div>
            <p className="text-xs text-white/80">
              Customer rating
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-cyan-600 opacity-100" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/90">Categories</CardTitle>
            <Target className="h-4 w-4 text-white/80" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">{dashboard.categoriesStats.length}</div>
            <p className="text-xs text-white/80">
              Service types
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-red-600 opacity-100" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/90">Inactive</CardTitle>
            <AlertTriangle className="h-4 w-4 text-white/80" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-white">{dashboard.inactive}</div>
            <p className="text-xs text-white/80">
              Need attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Best Selling Services */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-600" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1">
              {dashboard.bestSelling.map((service, index) => (
                <div key={service.service_id} className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                      index === 0 ? 'bg-gradient-to-br from-amber-500 to-yellow-500' :
                      index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                      'bg-gradient-to-br from-orange-600 to-red-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{service.service_name}</div>
                      <div className="text-xs text-slate-500">{service.total_bookings} bookings</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-sm">{formatPrice(service.total_revenue)}</div>
                    <div className="flex items-center text-xs text-slate-500">
                      <Star className="w-3 h-3 text-amber-500 mr-1" />
                      {service.avg_rating.toFixed(1)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Service Categories */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              Categories
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {dashboard.categoriesStats.slice(0, 5).map((category) => {
                const IconComponent = category.icon;
                return (
                  <div key={category.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-gradient-to-br ${category.color}`}>
                        <IconComponent className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{category.name}</div>
                        <div className="text-xs text-slate-500">{category.count} services</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-sm">{formatPrice(category.revenue)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-600" />
              Quick Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-700">Service Utilization</span>
                  <span className="text-sm text-slate-600">85%</span>
                </div>
                <Progress value={85} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-700">Customer Satisfaction</span>
                  <span className="text-sm text-slate-600">{dashboard.avgRating.toFixed(1)}/5.0</span>
                </div>
                <Progress value={(dashboard.avgRating / 5) * 100} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-700">Revenue Growth</span>
                  <span className="text-sm text-slate-600">+12.5%</span>
                </div>
                <Progress value={72} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-700">Booking Rate</span>
                  <span className="text-sm text-slate-600">78%</span>
                </div>
                <Progress value={78} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Services List */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-fit">
              <TabsList className="grid grid-cols-4 w-fit">
                <TabsTrigger value="all" className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  All ({services.length})
                </TabsTrigger>
                <TabsTrigger value="popular" className="flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  Popular
                </TabsTrigger>
                <TabsTrigger value="premium" className="flex items-center gap-2">
                  <Crown className="w-4 h-4" />
                  Premium
                </TabsTrigger>
                <TabsTrigger value="quick" className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Quick
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search services..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {SERVICE_CATEGORIES.map((category) => (
                    <SelectItem key={category.name} value={category.name}>
                      <div className="flex items-center gap-2">
                        <category.icon className="w-4 h-4" />
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="price">Price</SelectItem>
                  <SelectItem value="duration">Duration</SelectItem>
                  <SelectItem value="popularity">Popularity</SelectItem>
                  <SelectItem value="rating">Rating</SelectItem>
                </SelectContent>
              </Select>

              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(v) => v && setViewMode(v as "cards" | "table")}
                aria-label="Select view mode"
              >
                <ToggleGroupItem value="cards" aria-label="Card view">
                  <LayoutGrid className="w-4 h-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="table" aria-label="Table view">
                  <TableIcon className="w-4 h-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {currentServices.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                <Scissors className="w-8 h-8 text-slate-400" />
              </div>
              <div className="space-y-2">
                <p className="text-slate-600 font-medium">
                  {searchTerm || categoryFilter !== "all" ? "No services found" : "No services yet"}
                </p>
                <p className="text-slate-400 text-sm">
                  {searchTerm || categoryFilter !== "all" 
                    ? "Try adjusting your filters" 
                    : "Create your first service to get started"
                  }
                </p>
              </div>
              {!searchTerm && categoryFilter === "all" && (
                <Button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Service
                </Button>
              )}
            </div>
          ) : (
            <>
              {viewMode === "table" ? (
                <div className="p-6">
                <ServicesTable
                  services={currentServices}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleStatus={toggleServiceStatus}
                  formatPrice={formatPrice}
                  formatDuration={formatDuration}
                />
              </div>
            ) : (
              <div className="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
                {currentServices.map((service) => {
                  const CategoryIcon = getCategoryIcon(service.category || "");
                  return (
                    <Card key={service.id} className="group hover:shadow-lg transition-all duration-300 border-slate-200">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-gradient-to-br ${getCategoryColor(service.category || "")}`}>
                              <CategoryIcon className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-slate-900 truncate">{service.name}</h3>
                              {service.category && (
                                <Badge variant="outline" className="text-xs mt-1">
                                  {service.category}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Switch
                              checked={service.is_active}
                              onCheckedChange={() => toggleServiceStatus(service.id, service.is_active)}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => console.log("View service", service.id)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(service)}>
                                  <Edit2 className="mr-2 h-4 w-4" />
                                  Edit Service
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDelete(service.id)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        {service.description && (
                          <p className="text-sm text-slate-600 line-clamp-2">{service.description}</p>
                        )}
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-2">
                            <div className="flex items-center text-slate-600">
                              <Clock className="w-4 h-4 mr-2" />
                              {formatDuration(service.duration_minutes)}
                            </div>
                            <div className="flex items-center text-slate-600">
                              <DollarSign className="w-4 h-4 mr-2" />
                              {formatPrice(service.price)}
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            {service.avg_rating && (
                              <div className="flex items-center text-slate-600">
                                <Star className="w-4 h-4 mr-2 text-amber-500" />
                                {service.avg_rating.toFixed(1)}
                              </div>
                            )}
                            {service.total_bookings && (
                              <div className="flex items-center text-slate-600">
                                <Users className="w-4 h-4 mr-2" />
                                {service.total_bookings} bookings
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-2">
                            <Badge 
                              className={service.is_active 
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                : "bg-red-50 text-red-700 border-red-200"
                              }
                            >
                              {service.is_active ? "Active" : "Inactive"}
                            </Badge>
                            {service.popularity_score && service.popularity_score > 80 && (
                              <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                                <Star className="w-3 h-3 mr-1" />
                                Popular
                              </Badge>
                            )}
                          </div>
                          
                          {service.commission_rate && (
                            <div className="text-xs text-slate-500">
                              {service.commission_rate}% commission
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

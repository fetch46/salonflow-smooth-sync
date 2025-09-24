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
import ServiceCategoriesManager from "@/components/services/ServiceCategoriesManager";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { useOrganization } from "@/lib/saas/hooks";
import { useNavigate } from "react-router-dom";

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
  commission_percentage?: number | null;
  popularity_score?: number;
  avg_rating?: number;
  total_bookings?: number;
  location_id?: string | null;
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

// Removed mock bookings; best sellers now computed from invoice_items

const DEFAULT_SERVICE_CATEGORIES = [
  { name: "Hair Services", icon: Scissors, color: "from-amber-500 to-orange-500" },
  { name: "Nail Services", icon: Sparkles, color: "from-yellow-500 to-amber-500" },
  { name: "Facial Treatments", icon: Heart, color: "from-emerald-500 to-teal-500" },
  { name: "Body Treatments", icon: User, color: "from-blue-500 to-cyan-500" },
  { name: "Massage Therapy", icon: Activity, color: "from-amber-500 to-orange-500" },
  { name: "Makeup Services", icon: Palette, color: "from-yellow-500 to-amber-500" },
  { name: "Special Treatments", icon: Crown, color: "from-amber-500 to-yellow-500" },
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
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [locations, setLocations] = useState<{ id: string; name: string; is_default?: boolean }[]>([]);
  const [serviceCategories, setServiceCategories] = useState<{ name: string }[]>([]);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
 
  const { format: formatCurrency } = useOrganizationCurrency();
  const { organization } = useOrganization();
  const navigate = useNavigate();

  const [serviceMetrics, setServiceMetrics] = useState<{
    totalRevenue: number;
    totalBookings: number;
    bestSelling: BookingService[];
    categoriesStats: { name: string; count: number; revenue: number; icon: any; color: string }[];
    utilizationPct?: number;
    revenueGrowthPct?: number;
    bookingGrowthPct?: number;
  }>({
    totalRevenue: 0,
    totalBookings: 0,
    bestSelling: [],
    categoriesStats: [],
    utilizationPct: 0,
    revenueGrowthPct: 0,
    bookingGrowthPct: 0,
  });

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    duration_minutes: 60,
    price: 0,
    category: "",
    is_active: true,
    commission_percentage: 10,
    location_id: "",
  });

  // Removed enrichServices; use data as-is from DB

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);

      // Prefer org-scoped fetch when an organization is selected
      if (organization?.id) {
        const { data, error } = await supabase
          .from("services")
          .select("id, name, description, duration_minutes, price, category, is_active, created_at, updated_at, commission_percentage, location_id")
          .eq("organization_id", organization.id)
          .order("created_at", { ascending: false });

        if (error) {
          // Fallback for environments where services table doesn't have organization_id yet
          const code = (error as any)?.code
          const message = (error as any)?.message || String(error)
          const isMissingOrgId = code === '42703' || /column\s+("?[\w\.]*organization_id"?)\s+does not exist/i.test(message)
          const isRlsOrPermission = /permission denied|rls/i.test(message)

          if (isMissingOrgId || isRlsOrPermission) {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from("services")
              .select("*")
              .order("created_at", { ascending: false })

            if (fallbackError) throw fallbackError
            setServices(fallbackData || [])
            return
          }
          throw error
        }
        // Zero-row compatibility fallback: fetch all services if org-scoped returns none
        if (!data || data.length === 0) {
          const { data: fallbackAll, error: fallbackAllErr } = await supabase
            .from("services")
            .select("*")
            .order("created_at", { ascending: false })
          if (!fallbackAllErr && fallbackAll) {
            setServices(fallbackAll)
            return
          }
        }
        setServices(data || [])
        return
      }

      // No organization selected; return empty for security
      console.warn("No organization selected - returning empty services list for security");
      setServices([]);
      return;
    } catch (error) {
      console.error("Error fetching services:", error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  const refreshData = async () => {
    try {
      setRefreshing(true);
      await fetchServices();
      await fetchServiceMetrics();
      toast.success("Data refreshed successfully");
    } catch (error) {
      toast.error("Failed to refresh data");
    } finally {
      setRefreshing(false);
    }
  };

  const fetchAvailableProducts = useCallback(async () => {
    try {
      // If an organization is selected, try org-scoped query first
      if (organization?.id) {
        const { data, error } = await supabase
          .from("inventory_items")
          .select("id, name, type, category, unit, cost_price, selling_price")
          .eq("is_active", true)
          .eq("type", "good")
          .eq("organization_id", organization.id)
          .order("name");

        if (error) {
          // Fallback for environments where inventory_items doesn't have organization_id or RLS/permission blocks
          const code = (error as any)?.code;
          const message = (error as any)?.message || String(error);
          const isMissingOrgId = code === '42703' || /column\s+("?[\w\.]*organization_id"?)\s+does not exist/i.test(message);
          const isMissingIsActive = code === '42703' || /column\s+("?[\w\.]*is_active"?)\s+does not exist/i.test(message);
          const isMissingType = code === '42703' || /column\s+("?[\w\.]*type"?)\s+does not exist/i.test(message);
          const isRlsOrPermission = /permission denied|rls/i.test(message);

          // 1) If org_id missing or permission blocked, try without org_id
          if (isMissingOrgId || isRlsOrPermission) {
            // Try with columns present
            const { data: fallbackData1, error: fallbackError1 } = await supabase
              .from("inventory_items")
              .select("id, name, type, category, unit, cost_price, selling_price")
              .eq("is_active", true)
              .eq("type", "good")
              .order("name");
            if (!fallbackError1 && fallbackData1 && fallbackData1.length > 0) {
              setAvailableProducts(fallbackData1);
              return;
            }

            // 2) If still empty or columns might be missing, relax filters progressively
            // 2a) Handle missing is_active column
            if (isMissingIsActive) {
              const { data: fallbackData2, error: fallbackError2 } = await supabase
                .from("inventory_items")
                .select("id, name, type, category, unit, cost_price, selling_price")
                .eq("type", "good")
                .order("name");
              if (!fallbackError2 && fallbackData2 && fallbackData2.length > 0) {
                setAvailableProducts(fallbackData2);
                return;
              }
            }

            // 2b) Handle missing type column or rows with null type
            if (isMissingType) {
              const { data: fallbackData3, error: fallbackError3 } = await supabase
                .from("inventory_items")
                .select("id, name, type, category, unit, cost_price, selling_price")
                .order("name");
              if (!fallbackError3 && fallbackData3 && fallbackData3.length > 0) {
                setAvailableProducts(fallbackData3);
                return;
              }
            } else {
              // Try including rows where type is null as well
              const { data: fallbackData4, error: fallbackError4 } = await supabase
                .from("inventory_items")
                .select("id, name, type, category, unit, cost_price, selling_price")
                .or('type.eq.good,type.is.null')
                .order("name");
              if (!fallbackError4 && fallbackData4 && fallbackData4.length > 0) {
                setAvailableProducts(fallbackData4);
                return;
              }
            }
          }

          // If none of the above matched, rethrow
          throw error;
        }

        // If org-scoped query returned zero rows, try a compatibility fallback
        if (!data || data.length === 0) {
          // Try without org filter
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("inventory_items")
            .select("id, name, type, category, unit, cost_price, selling_price")
            .eq("is_active", true)
            .eq("type", "good")
            .order("name");

          if (!fallbackError && fallbackData && fallbackData.length > 0) {
            setAvailableProducts(fallbackData);
            return;
          }

          // Try including null type
          const { data: fallbackDataNullType } = await supabase
            .from("inventory_items")
            .select("id, name, type, category, unit, cost_price, selling_price")
            .or('type.eq.good,type.is.null')
            .order("name");
          if (fallbackDataNullType && fallbackDataNullType.length > 0) {
            setAvailableProducts(fallbackDataNullType);
            return;
          }
        }

        setAvailableProducts(data || []);
        return;
      }

      // No active organization selected: use generic fetch so picker still works
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, name, type, category, unit, cost_price, selling_price")
        .eq("is_active", true)
        .eq("type", "good")
        .order("name");
      if (error) {
        const code = (error as any)?.code;
        const message = (error as any)?.message || String(error);
        const isMissingIsActive = code === '42703' || /column\s+("?[\w\.]*is_active"?)\s+does not exist/i.test(message);
        const isMissingType = code === '42703' || /column\s+("?[\w\.]*type"?)\s+does not exist/i.test(message);
        if (isMissingIsActive || isMissingType) {
          const { data: relaxed, error: relaxedErr } = await supabase
            .from("inventory_items")
            .select("id, name, type, category, unit, cost_price, selling_price")
            .or(isMissingType ? undefined as any : 'type.eq.good,type.is.null')
            .order("name");
          if (!relaxedErr && relaxed) {
            setAvailableProducts(relaxed);
            return;
          }
        }
        throw error;
      }
      if (!data || data.length === 0) {
        const { data: fallbackDataNullType } = await supabase
          .from("inventory_items")
          .select("id, name, type, category, unit, cost_price, selling_price")
          .or('type.eq.good,type.is.null')
          .order("name");
        if (fallbackDataNullType && fallbackDataNullType.length > 0) {
          setAvailableProducts(fallbackDataNullType);
          return;
        }
      }
      setAvailableProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
      setAvailableProducts([]);
    }
  }, [organization?.id]);

  const fetchLocations = useCallback(async () => {
    try {
      if (!organization?.id) return;
      const { data, error } = await supabase
        .from("business_locations")
        .select("id, name, is_default")
        .eq("organization_id", organization.id)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("name");

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.warn("Failed to fetch business_locations", error);
              setLocations([]);
    }
  }, [organization?.id]);

  useEffect(() => {
    fetchServices();
    fetchAvailableProducts();
    fetchLocations();
  }, [fetchServices, fetchAvailableProducts]);
  // include fetchLocations in deps without causing eslint issues by disabling inline, or just list explicitly
  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  // Auto-select default location on open when creating new service
  useEffect(() => {
    if (!isModalOpen) return;
    if (editingService) return;
    if (formData.location_id) return;
    const settings = (organization?.settings as any) || {};
    const configuredId = settings.services_default_location_id as string | undefined;
    const preferred = (configuredId && locations.find(l => l.id === configuredId))
      || locations.find(l => (l as any).is_default)
      || locations[0];
    if (preferred?.id) {
      setFormData(prev => ({ ...prev, location_id: preferred.id }));
    }
  }, [isModalOpen, editingService, locations, formData.location_id, organization?.settings]);

  const fetchServiceCategories = useCallback(async () => {
    try {
      if (!organization?.id) { setServiceCategories([]); return; }
      const { data, error } = await supabase
        .from('service_categories' as any)
        .select('name')
        .eq('organization_id', organization.id)
        .order('name');
      if (error) throw error;
      const names = (data || []) as any[];
      setServiceCategories(names);
    } catch (e) {
      // Fallback: empty if table missing
      setServiceCategories([]);
    }
  }, [organization?.id]);

  useEffect(() => { fetchServiceCategories(); }, [fetchServiceCategories]);

  const fetchServiceMetrics = useCallback(async () => {
    try {
      // Get service metrics from job_card_services instead of invoice_items
      const sinceIso = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("job_card_services")
        .select("service_id, quantity, unit_price, created_at, services:service_id(name, category)")
        .not("service_id", "is", null)
        .gte("created_at", sinceIso);
      if (error) throw error;
      const items = (data || []) as any[];

      const now = Date.now();
      const last30Start = now - 30 * 24 * 60 * 60 * 1000;

      const itemsLast30 = items.filter(it => new Date(it.created_at).getTime() >= last30Start);
      const itemsPrev30 = items.filter(it => {
        const ts = new Date(it.created_at).getTime();
        return ts >= (last30Start - 30 * 24 * 60 * 60 * 1000) && ts < last30Start;
      });

      const byService: Record<string, { name: string; category?: string; bookings: number; revenue: number }> = {};
      for (const it of items) {
        const sid = (it.service_id as string) || null;
        if (!sid) continue;
        const qty = Number(it.quantity) || 0;
        const rev = Number(it.unit_price) * qty || 0; // Use unit_price * quantity
        const name = it.services?.name || "Service";
        const category = it.services?.category || undefined;
        if (!byService[sid]) {
          byService[sid] = { name, category, bookings: 0, revenue: 0 };
        }
        byService[sid].bookings += qty;
        byService[sid].revenue += rev;
      }

      const totalRevenue = Object.values(byService).reduce((sum, v) => sum + v.revenue, 0);
      const totalBookings = Object.values(byService).reduce((sum, v) => sum + v.bookings, 0);

      const bestSelling: BookingService[] = Object.entries(byService)
        .map(([service_id, v]) => ({
          service_id,
          service_name: v.name,
          total_bookings: v.bookings,
          total_revenue: v.revenue,
          avg_rating: 0,
          growth_rate: 0,
        }))
        .sort((a, b) => b.total_bookings - a.total_bookings)
        .slice(0, 3);

      const categoriesList = (serviceCategories.length > 0
        ? serviceCategories.map(c => ({ name: c.name }))
        : DEFAULT_SERVICE_CATEGORIES.map(c => ({ name: c.name })));

      const categoriesStats = categoriesList.map((cat) => {
        const count = services.filter((s) => s.category === cat.name).length;
        const revenue = Object.values(byService)
          .filter((v) => v.category === cat.name)
          .reduce((sum, v) => sum + v.revenue, 0);
        // Default icon/color mapping for known defaults; fallback to gray
        const fallback = DEFAULT_SERVICE_CATEGORIES.find(d => d.name === cat.name);
        return { name: cat.name, count, revenue, icon: (fallback?.icon || Package), color: (fallback?.color || 'from-gray-500 to-gray-600') };
      }).filter((c) => c.count > 0);

      // Utilization: distinct services with activity in last 30 days / active services
      const distinctActiveLast30 = new Set(itemsLast30.map(it => String(it.service_id))).size;
      const activeServicesCount = services.filter(s => s.is_active).length || 0;
      const utilizationPct = activeServicesCount > 0
        ? Math.round((distinctActiveLast30 / activeServicesCount) * 100)
        : 0;

      const revenueLast30 = itemsLast30.reduce((sum, it) => sum + (Number(it.total_price) || 0), 0);
      const revenuePrev30 = itemsPrev30.reduce((sum, it) => sum + (Number(it.total_price) || 0), 0);
      const revenueGrowthPct = revenuePrev30 > 0
        ? ((revenueLast30 - revenuePrev30) / revenuePrev30) * 100
        : (revenueLast30 > 0 ? 100 : 0);

      const bookingsLast30 = itemsLast30.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
      const bookingsPrev30 = itemsPrev30.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
      const bookingGrowthPct = bookingsPrev30 > 0
        ? ((bookingsLast30 - bookingsPrev30) / bookingsPrev30) * 100
        : (bookingsLast30 > 0 ? 100 : 0);

      setServiceMetrics({
        totalRevenue,
        totalBookings,
        bestSelling,
        categoriesStats,
        utilizationPct,
        revenueGrowthPct,
        bookingGrowthPct,
      });
    } catch (err) {
      console.error("Error fetching service metrics:", err);
      setServiceMetrics({ totalRevenue: 0, totalBookings: 0, bestSelling: [], categoriesStats: [], utilizationPct: 0, revenueGrowthPct: 0, bookingGrowthPct: 0 });
    }
  }, [services, serviceCategories]);

  useEffect(() => {
    fetchServiceMetrics();
  }, [fetchServiceMetrics]);

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
      if (!formData.location_id) {
        toast.error("Please select a location");
        return;
      }

      let serviceId = editingService?.id;

      // Only send columns that exist on the services table
      const payload = {
        name: formData.name,
        description: formData.description || null,
        duration_minutes: formData.duration_minutes,
        price: formData.price,
        category: formData.category || null,
        is_active: formData.is_active,
        location_id: formData.location_id,

      } as const;

      if (editingService) {
        // Try update with location_id; retry without if column missing
        let updError: any | null = null
        try {
          const { error } = await supabase
            .from("services")
            .update(payload)
            .eq("id", editingService.id)
          updError = error
        } catch (e: any) {
          updError = e
        }
        if (updError) {
          const code = updError?.code
          const message = updError?.message || String(updError)
          const isMissingLocationId = code === '42703' || /column\s+("?[\w\.]*location_id"?)\s+does not exist/i.test(message)
          if (isMissingLocationId) {
            const { error: retryError } = await supabase
              .from("services")
              .update({
                name: payload.name,
                description: payload.description,
                duration_minutes: payload.duration_minutes,
                price: payload.price,
                category: payload.category,
                is_active: payload.is_active,
              })
              .eq("id", editingService.id)
            if (retryError) throw retryError
          } else {
            throw updError
          }
        }
      } else {
        if (!organization?.id) throw new Error("No active organization selected");
        const insertPayload = { ...payload, organization_id: organization.id } as any;
        let data: any | null = null
        let error: any | null = null
        try {
          const res = await supabase
            .from("services")
            .insert([insertPayload])
            .select('id')
            .maybeSingle()
          data = res.data
          error = res.error
        } catch (e: any) {
          error = e
        }
        if (error) {
          const code = (error as any)?.code
          const message = (error as any)?.message || String(error)
          const isMissingOrgId = code === '42703' || /column\s+("?[\w\.]*organization_id"?)\s+does not exist/i.test(message)
          const isMissingLocationId = code === '42703' || /column\s+("?[\w\.]*location_id"?)\s+does not exist/i.test(message)
          const isUniqueName = code === '23505' || /duplicate key value violates unique constraint/i.test(message)
          if (isMissingOrgId || isMissingLocationId) {
            const { data: retryData, error: retryError } = await supabase
              .from("services")
              .insert([{ 
                name: payload.name,
                description: payload.description,
                duration_minutes: payload.duration_minutes,
                price: payload.price,
                category: payload.category,
                is_active: payload.is_active,
                organization_id: organization?.id || '',
              }])
              .select('id')
              .maybeSingle()
            if (retryError) throw retryError
            data = retryData
          } else if (isUniqueName) {
            throw new Error('A service with this name already exists in your organization')
          } else {
            throw error
          }
        }
        if (!data?.id) {
          throw new Error('Service was created but no ID was returned')
        }
        serviceId = data.id;
      }

      // Save service kits
      if (serviceId) {
        await supabase
          .from("service_kits")
          .delete()
          .eq("service_id", serviceId);

        if (serviceKits.length > 0) {
          // Prefer current organization; if unavailable, try to reuse existing service org id by reading the service
          let orgIdForKits: string | null = organization?.id || null;
          if (!orgIdForKits && serviceId) {
            const { data: svcRow } = await supabase
              .from('services')
              .select('organization_id')
              .eq('id', serviceId)
              .maybeSingle();
            orgIdForKits = (svcRow as any)?.organization_id || null;
          }
          const kitData = serviceKits.map(kit => ({
            service_id: serviceId!,
            good_id: kit.good_id,
            default_quantity: kit.default_quantity,
            ...(orgIdForKits ? { organization_id: orgIdForKits } : {}),
          })) as any[]

          // Try insert with organization_id, then retry without if column missing
          const { error: kitError } = await supabase
            .from("service_kits")
            .insert(kitData)
          if (kitError) {
            const code = (kitError as any)?.code
            const message = (kitError as any)?.message || String(kitError)
            const isMissingOrgId = code === '42703' || /column\s+("?[\w\.]*organization_id"?)\s+does not exist/i.test(message)
            if (isMissingOrgId) {
              const { error: retryKitError } = await supabase
                .from("service_kits")
                .insert(kitData.map(k => ({ 
                  service_id: k.service_id, 
                  good_id: k.good_id, 
                  default_quantity: k.default_quantity,
                  organization_id: organization?.id || ''
                })))
              if (retryKitError) throw retryKitError
            } else {
              throw kitError
            }
          }
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
      commission_percentage: 10,
      location_id: "",
    });
    setEditingService(null);
    setServiceKits([]);
  };

  const handleEdit = (service: Service) => {
    navigate(`/services/${service.id}/edit`);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this service? This will also remove related service kits and update related records.")) {
      try {
        const { deletionPatterns } = await import("@/utils/crudHelpers");
        const result = await deletionPatterns.service(id);
        if (result.success) {
          toast.success("Service deleted successfully");
          fetchServices();
        }
      } catch (error) {
        console.error("Error deleting service:", error);
        toast.error("Failed to delete service");
      }
    }
  };

  const handleView = (service: Service) => {
    navigate(`/services/${service.id}`);
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

  const formatPrice = (price: number) => formatCurrency(price);

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  };

  const getCategoryIcon = (categoryName: string) => {
    const category = DEFAULT_SERVICE_CATEGORIES.find(cat => cat.name === categoryName);
    return category ? category.icon : Package;
  };

  const getCategoryColor = (categoryName: string) => {
    const category = DEFAULT_SERVICE_CATEGORIES.find(cat => cat.name === categoryName);
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
    const totalRevenue = serviceMetrics.totalRevenue;
    const totalBookings = serviceMetrics.totalBookings;
    const avgRating = services.length > 0 ? services.reduce((sum, s) => sum + (s.avg_rating || 0), 0) / services.length : 0;
    const bestSelling = serviceMetrics.bestSelling;
    const categoriesStats = serviceMetrics.categoriesStats;

    return {
      active,
      inactive,
      totalRevenue,
      totalBookings,
      avgRating,
      bestSelling,
      categoriesStats,
    };
  }, [services, serviceMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
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
            <div className="p-2.5 bg-gradient-to-br from-yellow-600 to-amber-600 rounded-xl shadow-lg">
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
          
          {/* Replaced modal trigger with navigation to full page */}
          <Button 
            onClick={() => navigate('/services/new')}
            className="bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-700 hover:to-amber-700 text-foreground shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Service
          </Button>
        </div>
      </div>

      {/* Enhanced Statistics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <Card className="bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Total Services</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{services.length}</div>
            <p className="text-xs text-blue-600">
              {dashboard.active} active
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{formatPrice(dashboard.totalRevenue)}</div>
            <p className="text-xs text-green-600">
              {dashboard.totalBookings} bookings
            </p>
          </CardContent>
        </Card>



        <Card className="bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-pink-700">Avg Rating</CardTitle>
            <Star className="h-4 w-4 text-pink-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-pink-700">{dashboard.avgRating.toFixed(1)}</div>
            <p className="text-xs text-pink-600">
              Customer rating
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-50 to-sky-50 border-cyan-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-cyan-700">Categories</CardTitle>
            <Target className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-700">{dashboard.categoriesStats.length}</div>
            <p className="text-xs text-cyan-600">
              Service types
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Inactive</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{dashboard.inactive}</div>
            <p className="text-xs text-red-600">
              Need attention
            </p>
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
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {(serviceCategories.length > 0 ? serviceCategories : DEFAULT_SERVICE_CATEGORIES).map((category: any) => (
                    <SelectItem key={category.name} value={category.name}>
                      <div className="flex items-center gap-2">
                        {(() => { const def = DEFAULT_SERVICE_CATEGORIES.find(d => d.name === category.name); const Icon = def?.icon || Package; return <Icon className="w-4 h-4" />; })()}
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button variant="outline" onClick={() => setManageCategoriesOpen(true)}>Manage Categories</Button>
              
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
                  onClick={() => navigate('/services/new')}
                  className="bg-amber-600 hover:bg-amber-700 text-foreground"
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
                  onView={handleView}
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
                                <DropdownMenuItem onClick={() => navigate(`/services/${service.id}`)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/services/${service.id}/edit`)}>
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

                                                      <div className="text-xs text-slate-500">
                            {service.commission_percentage}% commission
                          </div>
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
      <ServiceCategoriesManager
        open={manageCategoriesOpen}
        onOpenChange={setManageCategoriesOpen}
        organizationId={organization?.id || ''}
        onChanged={() => { fetchServiceCategories(); fetchServices(); fetchServiceMetrics(); }}
      />
    </div>
  );
}

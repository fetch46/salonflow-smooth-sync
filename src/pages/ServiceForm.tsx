import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Info, ShoppingCart, Scissors, ArrowLeft } from "lucide-react";
import { useOrganization } from "@/lib/saas/hooks";

interface ServiceFormState {
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  category: string;
  is_active: boolean;
  commission_percentage: number;
  location_id: string;
}

interface ServiceKitItem {
  id: string | null;
  good_id: string;
  default_quantity: number;
  inventory_items: {
    id: string;
    name: string;
    type: string;
    unit: string | null;
    cost_price: number | null;
    selling_price?: number | null;
    category?: string | null;
  };
}

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

export default function ServiceForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { organization } = useOrganization();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ServiceFormState>({
    name: "",
    description: "",
    duration_minutes: 60,
    price: 0,
    category: "",
    is_active: true,
    commission_percentage: 10,
    location_id: "",
  });
  const [availableProducts, setAvailableProducts] = useState<{ id: string; name: string; type: string; category: string | null; unit: string | null; cost_price: number | null; selling_price: number | null }[]>([]);
  const [serviceKits, setServiceKits] = useState<ServiceKitItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [locations, setLocations] = useState<{ id: string; name: string; is_default?: boolean }[]>([]);

  const fetchAvailableProducts = useCallback(async () => {
    try {
      if (organization?.id) {
        const { data, error } = await supabase
          .from("inventory_items")
          .select("id, name, type, category, unit, cost_price, selling_price")
          .eq("is_active", true)
          .eq("type", "good")
          .eq("organization_id", organization.id)
          .order("name");
        if (error) {
          const code = (error as any)?.code;
          const message = (error as any)?.message || String(error);
          const isMissingOrgId = code === '42703' || /column\s+("?[\w\.]*organization_id"?)\s+does not exist/i.test(message);
          const isRlsOrPermission = /permission denied|rls/i.test(message);
          if (isMissingOrgId || isRlsOrPermission) {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from("inventory_items")
              .select("id, name, type, category, unit, cost_price, selling_price")
              .eq("is_active", true)
              .eq("type", "good")
              .order("name");
            if (fallbackError) throw fallbackError;
            setAvailableProducts(fallbackData || []);
            return;
          }
          throw error;
        }
        setAvailableProducts(data || []);
        return;
      }
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, name, type, category, unit, cost_price, selling_price")
        .eq("is_active", true)
        .eq("type", "good")
        .order("name");
      if (error) throw error;
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

  const fetchServiceKits = useCallback(async (serviceId: string) => {
    try {
      const { data, error } = await supabase
        .from("service_kits")
        .select(`*, inventory_items:inventory_items!service_kits_good_id_fkey(id, name, type, unit, cost_price, selling_price, category)`)
        .eq("service_id", serviceId);
      if (error) throw error;
      setServiceKits(
        (data || []).map((kit: any) => ({
          id: kit.id,
          good_id: kit.good_id,
          default_quantity: kit.default_quantity,
          inventory_items: kit.inventory_items,
        }))
      );
    } catch (error) {
      console.error("Error fetching service kits:", error);
      setServiceKits([]);
    }
  }, []);

  useEffect(() => {
    fetchAvailableProducts();
    fetchLocations();
  }, [fetchAvailableProducts, fetchLocations]);

  useEffect(() => {
    if (isEdit && id) {
      (async () => {
        try {
          setLoading(true);
          const { data: service, error } = await supabase
            .from("services")
            .select("*")
            .eq("id", id)
            .maybeSingle();
          if (error) throw error;
          if (service) {
            setFormData({
              name: service.name,
              description: service.description || "",
              duration_minutes: service.duration_minutes,
              price: service.price,
              category: service.category || "",
              is_active: service.is_active,
              commission_percentage: Number((service as any).commission_percentage) || 0,
              location_id: (service as any).location_id || "",
            });
          }
          await fetchServiceKits(id);
        } catch (err) {
          console.error("Error loading service:", err);
          toast.error("Failed to load service details");
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [isEdit, id, fetchServiceKits]);

  // Auto-select default location for create
  useEffect(() => {
    if (isEdit) return;
    if (formData.location_id) return;
    const preferred = locations.find((l) => (l as any).is_default) || locations[0];
    if (preferred?.id) {
      setFormData((prev) => ({ ...prev, location_id: preferred.id }));
    }
  }, [locations, isEdit, formData.location_id]);

  const addKitItem = (productId: string) => {
    const product = availableProducts.find((p) => p.id === productId);
    if (product && !serviceKits.find((kit) => kit.good_id === productId)) {
      setServiceKits((prev) => [
        ...prev,
        {
          id: null,
          good_id: product.id,
          default_quantity: 1,
          inventory_items: {
            id: product.id,
            name: product.name,
            type: product.type,
            unit: product.unit,
            cost_price: product.cost_price,
            selling_price: product.selling_price,
            category: product.category,
          },
        },
      ]);
    }
  };

  const updateKitQuantity = (productId: string, quantity: number) => {
    setServiceKits((prev) =>
      prev.map((kit) => (kit.good_id === productId ? { ...kit, default_quantity: quantity } : kit))
    );
  };

  const removeKitItem = (productId: string) => {
    setServiceKits((prev) => prev.filter((kit) => kit.good_id !== productId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (!formData.location_id) {
        toast.error("Please select a location");
        return;
      }

      let serviceId = id as string | undefined;
      const payload: Record<string, any> = {
        name: formData.name,
        description: formData.description || null,
        duration_minutes: formData.duration_minutes,
        price: formData.price,
        category: formData.category || null,
        is_active: formData.is_active,
        location_id: formData.location_id,
      };

      if (isEdit && serviceId) {
        let updError: any = null;
        try {
          const { error } = await supabase
            .from("services")
            .update(payload)
            .eq("id", serviceId);
          updError = error;
        } catch (e: any) {
          updError = e;
        }
        if (updError) {
          const code = (updError as any)?.code;
          const message = (updError as any)?.message || String(updError);
          const isMissingLocationId = code === '42703'
            || /column\s+("?[\w\.]*location_id"?)\s+does not exist/i.test(message)
            || (/schema cache/i.test(message) && /location_id/i.test(message) && /services/i.test(message));
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
              .eq("id", serviceId);
            if (retryError) throw retryError;
          } else {
            throw updError;
          }
        }
      } else {
        if (!organization?.id) throw new Error("No active organization selected");
        let data: any = null;
        let error: any = null;
        try {
          const res = await supabase
            .from("services")
            .insert([
              {
                name: payload.name,
                description: payload.description,
                duration_minutes: payload.duration_minutes,
                price: payload.price,
                category: payload.category,
                is_active: payload.is_active,
                organization_id: organization.id,
                location_id: payload.location_id,
              },
            ])
            .select('id')
            .maybeSingle();
          data = res.data;
          error = res.error;
        } catch (e: any) {
          error = e;
        }
        if (error) {
          const code = (error as any)?.code;
          const message = (error as any)?.message || String(error);
          const isMissingOrgId = code === '42703' || /column\s+("?[\w\.]*organization_id"?)\s+does not exist/i.test(message);
          const isMissingLocationId = code === '42703'
            || /column\s+("?[\w\.]*location_id"?)\s+does not exist/i.test(message)
            || (/schema cache/i.test(message) && /location_id/i.test(message) && /services/i.test(message));
          if (isMissingOrgId || isMissingLocationId) {
            const { data: retryData, error: retryError } = await supabase
              .from("services")
              .insert([
                {
                  name: payload.name,
                  description: payload.description,
                  duration_minutes: payload.duration_minutes,
                  price: payload.price,
                  category: payload.category,
                  is_active: payload.is_active,
                },
              ])
              .select('id')
              .maybeSingle();
            if (retryError) throw retryError;
            data = retryData;
          } else {
            throw error;
          }
        }
        if (!data?.id) {
          throw new Error('Service was created but no ID was returned');
        }
        serviceId = data.id;
      }

      if (serviceId) {
        await supabase.from("service_kits").delete().eq("service_id", serviceId);
        if (serviceKits.length > 0) {
          const kitData = serviceKits.map((kit) => ({
            service_id: serviceId!,
            good_id: kit.good_id,
            default_quantity: kit.default_quantity,
            organization_id: organization?.id,
          }));
          let kitError: any = null;
          try {
            const { error } = await supabase.from("service_kits").insert(kitData as any);
            kitError = error;
          } catch (e: any) {
            kitError = e;
          }
          if (kitError) {
            const code = (kitError as any)?.code;
            const message = (kitError as any)?.message || String(kitError);
            const isMissingOrgId = code === '42703' || /column\s+("?[\w\.]*organization_id"?)\s+does not exist/i.test(message);
            if (isMissingOrgId) {
              const { error: retryKitError } = await supabase
                .from("service_kits")
                .insert(
                  serviceKits.map((k) => ({
                    service_id: serviceId,
                    good_id: k.good_id,
                    default_quantity: k.default_quantity,
                  })) as any
                );
              if (retryKitError) throw retryKitError;
            } else {
              throw kitError;
            }
          }
        }
      }

      toast.success(isEdit ? "Service updated successfully" : "Service created successfully");
      navigate(`/services/${serviceId}`);
    } catch (error: any) {
      console.error("Error saving service:", error);
      toast.error(error?.message ? `Failed to save service: ${error.message}` : "Failed to save service");
    } finally {
      setLoading(false);
    }
  };

  const totalKitCost = useMemo(() => serviceKits.reduce((total, kit) => total + (kit.default_quantity * (kit.inventory_items.cost_price || 0)), 0), [serviceKits]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{isEdit ? "Edit Service" : "Create New Service"}</h1>
          <p className="text-muted-foreground">{isEdit ? "Update service details and kit items" : "Add a new service with pricing and kit configuration"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-purple-600" />
            {isEdit ? "Service Details" : "New Service"}
          </CardTitle>
          <CardDescription>Fill in the service information and kit configuration.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600" />
                Service Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="name">Service Name *</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Premium Hair Cut & Style" required />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} placeholder="Describe what this service includes..." />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} placeholder="e.g., Hair Services" />
                </div>
                <div>
                  <Label htmlFor="location_id">Location *</Label>
                  <Select value={formData.location_id} onValueChange={(value) => setFormData({ ...formData, location_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder={locations.length ? "Select a location" : "No locations found"} />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="duration">Duration</Label>
                  <Select value={formData.duration_minutes.toString()} onValueChange={(value) => setFormData({ ...formData, duration_minutes: parseInt(value) })}>
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
                  <Input id="price" type="number" min="0" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} placeholder="0.00" required />
                </div>
                <div>
                  <Label htmlFor="commission_percentage">Commission %</Label>
                  <Input id="commission_percentage" type="number" min="0" max="100" step="0.1" value={formData.commission_percentage} onChange={(e) => setFormData({ ...formData, commission_percentage: parseFloat(e.target.value) || 0 })} placeholder="10.0" />
                </div>
                <div className="md:col-span-2">
                  <div className="flex items-center space-x-2">
                    <Switch id="is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
                    <Label htmlFor="is_active">Service is active and bookable</Label>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

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

              <div>
                <Label htmlFor="addProduct">Add Product to Kit</Label>
                <Select value={selectedProductId} onValueChange={(value) => { addKitItem(value); setSelectedProductId("") }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product to add..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts
                      .filter((product) => !serviceKits.find((kit) => kit.good_id === product.id))
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
                            <Input id={`qty-${kit.good_id}`} type="number" min="0" step="0.1" value={kit.default_quantity} onChange={(e) => updateKitQuantity(kit.good_id, parseFloat(e.target.value) || 0)} className="w-20 h-8 text-xs" />
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeKitItem(kit.good_id)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">
                            ✕
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-200">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-slate-700">Total Kit Cost</p>
                        <p className="text-xs text-slate-500">Material costs for this service</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-600">
                          ${totalKitCost.toFixed(2)}
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
              <Button type="button" variant="outline" onClick={() => navigate("/services")}>Cancel</Button>
              <Button type="submit" disabled={loading} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                {loading ? (isEdit ? "Updating..." : "Creating...") : (isEdit ? "Update Service" : "Create Service")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
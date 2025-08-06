import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ArrowLeft, Clock, DollarSign, Package, Edit, Scissors } from "lucide-react";
import { format } from "date-fns";

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

interface ServiceKit {
  id: string;
  service_id: string;
  good_id: string;
  default_quantity: number;
  inventory_items: {
    id: string;
    name: string;
    type: string;
    unit?: string;
    cost_price: number;
    selling_price: number;
    category?: string;
  };
}

export default function ServiceView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [serviceKits, setServiceKits] = useState<ServiceKit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchServiceData();
    }
  }, [id]);

  const fetchServiceData = async () => {
    try {
      setLoading(true);

      // Fetch service details
      const { data: serviceData, error: serviceError } = await supabase
        .from("services")
        .select("*")
        .eq("id", id)
        .single();

      if (serviceError) throw serviceError;
      setService(serviceData);

      // Fetch service kit items
      const { data: kitsData, error: kitsError } = await supabase
        .from("service_kits")
        .select(`
          *,
          inventory_items!service_kits_good_id_fkey (
            id, name, type, unit, cost_price, selling_price, category
          )
        `)
        .eq("service_id", id);

      if (kitsError) throw kitsError;
      setServiceKits(kitsData || []);

    } catch (error) {
      console.error("Error fetching service data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(price);

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  };

  const totalKitCost = serviceKits.reduce((total, kit) => 
    total + (kit.default_quantity * (kit.inventory_items.cost_price || 0)), 0
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading service details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!service) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-muted-foreground">Service not found</h2>
            <p className="text-muted-foreground">The requested service could not be found.</p>
            <Button onClick={() => navigate("/services")} className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Services
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-6 p-8 pt-6">
        {/* Service Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => navigate("/services")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <Scissors className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{service.name}</h1>
              <p className="text-muted-foreground">
                {service.category && `${service.category} • `}
                Created {format(new Date(service.created_at), "MMMM dd, yyyy")}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={service.is_active ? "default" : "secondary"}>
              {service.is_active ? "Active" : "Inactive"}
            </Badge>
            <Button onClick={() => navigate(`/services/${id}/edit`)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Service
            </Button>
          </div>
        </div>

        {/* Service Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Service Price</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPrice(service.price)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(service.duration_minutes)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Kit Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{serviceKits.length}</div>
              <p className="text-xs text-muted-foreground">
                {serviceKits.length === 0 ? "No kit items" : "product items"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Kit Cost</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPrice(totalKitCost)}</div>
              <p className="text-xs text-muted-foreground">
                Total material cost
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Service Details */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Service Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Name</label>
                <p className="text-sm">{service.name}</p>
              </div>
              {service.description && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <p className="text-sm">{service.description}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-muted-foreground">Category</label>
                <p className="text-sm">{service.category || "No category"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <p className="text-sm">{service.is_active ? "Active" : "Inactive"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                <p className="text-sm">{format(new Date(service.updated_at), "MMMM dd, yyyy 'at' HH:mm")}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing & Duration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Service Price</label>
                <p className="text-lg font-semibold">{formatPrice(service.price)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Duration</label>
                <p className="text-lg font-semibold">{formatDuration(service.duration_minutes)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Material Cost</label>
                <p className="text-lg font-semibold">{formatPrice(totalKitCost)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Estimated Profit</label>
                <p className="text-lg font-semibold text-green-600">
                  {formatPrice(service.price - totalKitCost)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Service Kit Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Service Kit - Product Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            {serviceKits.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No product items configured for this service kit</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate(`/services/${id}/edit`)}>
                  Add Kit Items
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Default Quantity</TableHead>
                    <TableHead>Unit Cost</TableHead>
                    <TableHead>Total Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serviceKits.map((kit) => (
                    <TableRow key={kit.id}>
                      <TableCell className="font-medium">{kit.inventory_items.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{kit.inventory_items.type}</Badge>
                      </TableCell>
                      <TableCell>{kit.inventory_items.category || "—"}</TableCell>
                      <TableCell>{kit.inventory_items.unit || "Each"}</TableCell>
                      <TableCell>{kit.default_quantity}</TableCell>
                      <TableCell>{formatPrice(kit.inventory_items.cost_price || 0)}</TableCell>
                      <TableCell className="font-medium">
                        {formatPrice(kit.default_quantity * (kit.inventory_items.cost_price || 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                    <TableCell colSpan={6} className="font-medium text-right">
                      Total Kit Cost:
                    </TableCell>
                    <TableCell className="font-bold text-lg">
                      {formatPrice(totalKitCost)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
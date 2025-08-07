import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DashboardLayout from "@/components/layout/DashboardLayout";
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
  }, [id, fetchServiceData]);

  const fetchServiceData = useCallback(async () => {
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
  }, [id]);

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
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <Button variant="ghost" onClick={() => navigate("/services")}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Scissors className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                    {service.name}
                  </h1>
                  <p className="text-muted-foreground text-lg">
                    {service.category && `${service.category} • `}
                    Created {format(new Date(service.created_at), "MMMM dd, yyyy")}
                  </p>
                  {service.description && (
                    <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                      {service.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end space-y-2">
                <div className="flex gap-2">
                  <Button onClick={() => navigate(`/services/${id}/edit`)} className="bg-gradient-to-r from-pink-500 to-purple-600">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Service
                  </Button>
                </div>
                <div className="flex space-x-2">
                  <Badge variant={service.is_active ? "default" : "secondary"} className="text-xs">
                    {service.is_active ? "Active" : "Inactive"}
                  </Badge>
                  {service.category && (
                    <Badge variant="outline" className="text-xs">
                      {service.category}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-700">Service Price</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">{formatPrice(service.price)}</div>
              <p className="text-xs text-green-600">
                Customer pays
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-700">Duration</CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">{formatDuration(service.duration_minutes)}</div>
              <p className="text-xs text-blue-600">
                Service time
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-700">Kit Items</CardTitle>
              <Package className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700">{serviceKits.length}</div>
              <p className="text-xs text-purple-600">
                {serviceKits.length === 0 ? "No kit items" : "product items"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-700">Estimated Profit</CardTitle>
              <DollarSign className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">{formatPrice(service.price - totalKitCost)}</div>
              <p className="text-xs text-orange-600">
                After material costs
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

        {/* Kit Summary */}
        {serviceKits.length > 0 && (
          <Card className="bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <Package className="h-8 w-8 mx-auto text-pink-600 mb-2" />
                  <p className="text-sm font-medium text-pink-700">Total Kit Items</p>
                  <p className="text-2xl font-bold text-pink-700">{serviceKits.length}</p>
                </div>
                <div className="text-center">
                  <DollarSign className="h-8 w-8 mx-auto text-pink-600 mb-2" />
                  <p className="text-sm font-medium text-pink-700">Material Cost</p>
                  <p className="text-2xl font-bold text-pink-700">{formatPrice(totalKitCost)}</p>
                </div>
                <div className="text-center">
                  <div className="h-8 w-8 mx-auto text-pink-600 mb-2 flex items-center justify-center">
                    <span className="text-lg font-bold">%</span>
                  </div>
                  <p className="text-sm font-medium text-pink-700">Material %</p>
                  <p className="text-2xl font-bold text-pink-700">
                    {service.price > 0 ? ((totalKitCost / service.price) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Service Kit Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-pink-600" />
              Service Kit - Product Items
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Individual products and materials required to perform this service
            </p>
          </CardHeader>
          <CardContent>
            {serviceKits.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Kit Items Configured</h3>
                <p className="mb-4">This service doesn't have any product items configured yet.</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate(`/services/${id}/edit`)}>
                  <Package className="w-4 h-4 mr-2" />
                  Add Kit Items
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Product Item</TableHead>
                      <TableHead className="font-semibold">Type</TableHead>
                      <TableHead className="font-semibold">Category</TableHead>
                      <TableHead className="font-semibold">Unit</TableHead>
                      <TableHead className="font-semibold text-center">Default Qty</TableHead>
                      <TableHead className="font-semibold text-right">Unit Cost</TableHead>
                      <TableHead className="font-semibold text-right">Total Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serviceKits.map((kit, index) => (
                      <TableRow key={kit.id} className={index % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                        <TableCell className="font-medium">{kit.inventory_items.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {kit.inventory_items.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {kit.inventory_items.category ? (
                            <Badge variant="secondary" className="text-xs">
                              {kit.inventory_items.category}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{kit.inventory_items.unit || "Each"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">
                            {kit.default_quantity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatPrice(kit.inventory_items.cost_price || 0)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatPrice(kit.default_quantity * (kit.inventory_items.cost_price || 0))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg p-4 border border-pink-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Material Cost</p>
                      <p className="text-xs text-muted-foreground">
                        Cost of all items used in this service
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-pink-600">{formatPrice(totalKitCost)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
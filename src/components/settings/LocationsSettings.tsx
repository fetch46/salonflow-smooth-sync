import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MapPin, Plus, Edit, Trash2, Star, MapIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/lib/saas";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const locationFormSchema = z.object({
  name: z.string().min(2, "Location name must be at least 2 characters"),
  code: z.string().min(1, "Location code is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  manager_id: z.string().optional(),
  default_warehouse_id: z.string().optional(),
  is_active: z.boolean().default(true),
  is_default: z.boolean().default(false),
});

type LocationFormValues = z.infer<typeof locationFormSchema>;

interface Location {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  manager_id?: string;
  default_warehouse_id?: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface Staff {
  id: string;
  full_name: string;
}

interface Warehouse {
  id: string;
  name: string;
  code?: string;
}

export function LocationsSettings() {
  const { organization } = useOrganization();
  const [locations, setLocations] = useState<Location[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [defaultAppointmentLocation, setDefaultAppointmentLocation] = useState<string>("");
  const [defaultPOSLocation, setDefaultPOSLocation] = useState<string>("");
  
  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      name: "",
      code: "",
      address: "",
      phone: "",
      manager_id: "",
      default_warehouse_id: "",
      is_active: true,
      is_default: false,
    },
  });

  useEffect(() => {
    if (organization?.id) {
      loadData();
    }
  }, [organization?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [locationsRes, staffRes, warehousesRes] = await Promise.all([
        supabase
          .from("business_locations")
          .select("*")
          .eq("organization_id", organization?.id)
          .order("name"),
        supabase
          .from("staff")
          .select("id, full_name")
          .eq("organization_id", organization?.id)
          .eq("is_active", true)
          .order("full_name"),
        supabase
          .from("warehouses")
          .select("id, name")
          .eq("organization_id", organization?.id)
          .eq("is_active", true)
          .order("name")
      ]);

      if (locationsRes.error) throw locationsRes.error;
      if (staffRes.error) throw staffRes.error;
      if (warehousesRes.error) throw warehousesRes.error;

      setLocations(locationsRes.data || []);
      setStaff(staffRes.data || []);
      setWarehouses(warehousesRes.data || []);

      // Load organization settings for default locations
      const { data: orgData } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", organization?.id)
        .single();

      if (orgData?.settings && typeof orgData.settings === 'object') {
        const settings = (orgData.settings as Record<string, any>) || {};
        setDefaultAppointmentLocation(settings.default_appointment_location || "");
        setDefaultPOSLocation(settings.default_pos_location || "");
      }

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load locations data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: LocationFormValues) => {
    try {
      if (editingLocation) {
        const { error } = await supabase
          .from("business_locations")
          .update({
            ...values,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingLocation.id);

        if (error) throw error;
        toast.success("Location updated successfully");
      } else {
        const { error } = await supabase
          .from("business_locations")
          .insert({
            name: values.name,
            code: values.code,
            address: values.address,
            phone: values.phone,
            manager_id: values.manager_id,
            default_warehouse_id: values.default_warehouse_id,
            is_active: values.is_active,
            is_default: values.is_default,
            organization_id: organization?.id,
          });

        if (error) throw error;
        toast.success("Location created successfully");
      }

      setShowDialog(false);
      setEditingLocation(null);
      form.reset();
      loadData();
    } catch (error) {
      console.error("Error saving location:", error);
      toast.error("Failed to save location");
    }
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    form.reset({
      name: location.name,
      code: location.code,
      address: location.address || "",
      phone: location.phone || "",
      manager_id: location.manager_id || "",
      default_warehouse_id: location.default_warehouse_id || "",
      is_active: location.is_active,
      is_default: location.is_default,
    });
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this location?")) return;

    try {
      const { error } = await supabase
        .from("business_locations")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Location deleted successfully");
      loadData();
    } catch (error) {
      console.error("Error deleting location:", error);
      toast.error("Failed to delete location");
    }
  };

  const handleSetDefault = async (locationId: string, type: 'appointment' | 'pos') => {
    try {
      const settingsField = type === 'appointment' ? 'default_appointment_location' : 'default_pos_location';
      
      const { error } = await supabase
        .from("organizations")
        .update({
          settings: {
            [settingsField]: locationId
          }
        })
        .eq("id", organization?.id);

      if (error) throw error;

      if (type === 'appointment') {
        setDefaultAppointmentLocation(locationId);
      } else {
        setDefaultPOSLocation(locationId);
      }

      toast.success(`Default ${type} location updated successfully`);
    } catch (error) {
      console.error("Error updating default location:", error);
      toast.error("Failed to update default location");
    }
  };

  const openCreateDialog = () => {
    setEditingLocation(null);
    form.reset();
    setShowDialog(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Business Locations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading locations...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Default Locations Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Default Locations
          </CardTitle>
          <CardDescription>
            Set default locations for appointments and POS operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Default Appointment Location</Label>
              <Select 
                value={defaultAppointmentLocation} 
                onValueChange={(value) => handleSetDefault(value, 'appointment')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select default location for appointments" />
                </SelectTrigger>
                <SelectContent>
                  {locations.filter(loc => loc.is_active).map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name} ({location.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Default POS Location</Label>
              <Select 
                value={defaultPOSLocation} 
                onValueChange={(value) => handleSetDefault(value, 'pos')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select default location for POS" />
                </SelectTrigger>
                <SelectContent>
                  {locations.filter(loc => loc.is_active).map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name} ({location.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Locations Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapIcon className="h-5 w-5 text-primary" />
            Manage Locations
          </CardTitle>
          <CardDescription>
            Create, edit, and manage your business locations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-muted-foreground">
              {locations.length} location(s) configured
            </div>
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Location
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingLocation ? "Edit Location" : "Create New Location"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingLocation 
                      ? "Update the location details below" 
                      : "Add a new business location to your organization"
                    }
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Main Branch" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location Code</FormLabel>
                            <FormControl>
                              <Input placeholder="MAIN" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Enter full address" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input placeholder="+1234567890" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="manager_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Manager</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select manager" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {staff.map((member) => (
                                  <SelectItem key={member.id} value={member.id}>
                                    {member.full_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="default_warehouse_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Warehouse</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select default warehouse for this location" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {warehouses.map((warehouse) => (
                                <SelectItem key={warehouse.id} value={warehouse.id}>
                                  {warehouse.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-center space-x-2">
                      <FormField
                        control={form.control}
                        name="is_active"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel>Active Location</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        {editingLocation ? "Update Location" : "Create Location"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Default Warehouse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="text-muted-foreground">
                        No locations configured yet. Create your first location to get started.
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  locations.map((location) => (
                    <TableRow key={location.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {location.name}
                          {location.is_default && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{location.code}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {location.address || "-"}
                      </TableCell>
                      <TableCell>
                        {staff.find(s => s.id === location.manager_id)?.full_name || "-"}
                      </TableCell>
                      <TableCell>
                        {warehouses.find(w => w.id === location.default_warehouse_id)?.name || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={location.is_active ? "default" : "secondary"}>
                          {location.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(location)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(location.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
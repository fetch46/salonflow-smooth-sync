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
import { Package, Plus, Edit, Trash2, Warehouse, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/lib/saas";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const warehouseFormSchema = z.object({
  name: z.string().min(2, "Warehouse name must be at least 2 characters"),
  code: z.string().min(1, "Warehouse code is required"),
  location_id: z.string().min(1, "Location is required"),
  address: z.string().optional(),
  manager_id: z.string().optional(),
  is_active: z.boolean().default(true),
});

type WarehouseFormValues = z.infer<typeof warehouseFormSchema>;

interface Warehouse {
  id: string;
  name: string;
  code?: string;
  location_id: string;
  address?: string;
  manager_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  organization_id: string;
  location?: {
    name: string;
    code: string;
  };
}

interface Location {
  id: string;
  name: string;
  code: string;
}

interface Staff {
  id: string;
  full_name: string;
}

export function WarehousesSettings() {
  const { organization } = useOrganization();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [defaultPOSWarehouse, setDefaultPOSWarehouse] = useState<string>("");
  
  const form = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseFormSchema),
    defaultValues: {
      name: "",
      code: "",
      location_id: "",
      address: "",
      manager_id: "",
      is_active: true,
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
      
      const [warehousesRes, locationsRes, staffRes] = await Promise.all([
        supabase
          .from("warehouses")
          .select(`
            *,
            business_locations!location_id(name, code)
          `)
          .eq("organization_id", organization?.id)
          .order("name"),
        supabase
          .from("business_locations")
          .select("id, name, code")
          .eq("organization_id", organization?.id)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("staff")
          .select("id, full_name")
          .eq("organization_id", organization?.id)
          .eq("is_active", true)
          .order("full_name")
      ]);

      if (warehousesRes.error) throw warehousesRes.error;
      if (locationsRes.error) throw locationsRes.error;
      if (staffRes.error) throw staffRes.error;

      setWarehouses((warehousesRes.data || []).map(w => ({
        ...w,
        location: w.business_locations || undefined
      })) as unknown as Warehouse[]);
      setLocations(locationsRes.data || []);
      setStaff(staffRes.data || []);

      // Load organization settings for default POS warehouse
      const { data: orgData } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", organization?.id)
        .single();

      if (orgData?.settings && typeof orgData.settings === 'object') {
        const settings = (orgData.settings as Record<string, any>) || {};
        setDefaultPOSWarehouse(settings.default_pos_warehouse || "");
      }

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load warehouses data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: WarehouseFormValues) => {
    try {
      if (editingWarehouse) {
        const { error } = await supabase
          .from("warehouses")
          .update({
            ...values,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingWarehouse.id);

        if (error) throw error;
        toast.success("Warehouse updated successfully");
      } else {
        const { error } = await supabase
          .from("warehouses")
          .insert({
            name: values.name,
            code: values.code,
            location_id: values.location_id,
            address: values.address,
            manager_id: values.manager_id,
            is_active: values.is_active,
            organization_id: organization?.id,
          });

        if (error) throw error;
        toast.success("Warehouse created successfully");
      }

      setShowDialog(false);
      setEditingWarehouse(null);
      form.reset();
      loadData();
    } catch (error) {
      console.error("Error saving warehouse:", error);
      toast.error("Failed to save warehouse");
    }
  };

  const handleEdit = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse);
    form.reset({
      name: warehouse.name,
      code: warehouse.code,
      location_id: warehouse.location_id,
      address: warehouse.address || "",
      manager_id: warehouse.manager_id || "",
      is_active: warehouse.is_active,
    });
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this warehouse?")) return;

    try {
      const { error } = await supabase
        .from("warehouses")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Warehouse deleted successfully");
      loadData();
    } catch (error) {
      console.error("Error deleting warehouse:", error);
      toast.error("Failed to delete warehouse");
    }
  };

  const handleSetDefaultPOS = async (warehouseId: string) => {
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          settings: {
            default_pos_warehouse: warehouseId
          }
        })
        .eq("id", organization?.id);

      if (error) throw error;

      setDefaultPOSWarehouse(warehouseId);
      toast.success("Default POS warehouse updated successfully");
    } catch (error) {
      console.error("Error updating default warehouse:", error);
      toast.error("Failed to update default warehouse");
    }
  };

  const openCreateDialog = () => {
    setEditingWarehouse(null);
    form.reset();
    setShowDialog(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Warehouses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading warehouses...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Default POS Warehouse Setting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Default POS Warehouse
          </CardTitle>
          <CardDescription>
            Set the default warehouse for POS operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <Label>Default POS Warehouse</Label>
            <Select 
              value={defaultPOSWarehouse} 
              onValueChange={handleSetDefaultPOS}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select default warehouse for POS" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.filter(wh => wh.is_active).map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} ({warehouse.code}) - {warehouse.location?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Warehouses Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-primary" />
            Manage Warehouses
          </CardTitle>
          <CardDescription>
            Create, edit, and manage your inventory warehouses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-muted-foreground">
              {warehouses.length} warehouse(s) configured
            </div>
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Warehouse
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingWarehouse ? "Edit Warehouse" : "Create New Warehouse"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingWarehouse 
                      ? "Update the warehouse details below" 
                      : "Add a new warehouse to your organization"
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
                            <FormLabel>Warehouse Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Main Warehouse" {...field} />
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
                            <FormLabel>Warehouse Code</FormLabel>
                            <FormControl>
                              <Input placeholder="WH001" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="location_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigned Location</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a location" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {locations.map((location) => (
                                <SelectItem key={location.id} value={location.id}>
                                  {location.name} ({location.code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Enter warehouse address" {...field} />
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
                          <FormLabel>Warehouse Manager</FormLabel>
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
                            <FormLabel>Active Warehouse</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        {editingWarehouse ? "Update Warehouse" : "Create Warehouse"}
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
                  <TableHead>Location</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="text-muted-foreground">
                        No warehouses configured yet. Create your first warehouse to get started.
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  warehouses.map((warehouse) => (
                    <TableRow key={warehouse.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {warehouse.name}
                          {defaultPOSWarehouse === warehouse.id && (
                            <Badge variant="secondary" className="text-xs">Default POS</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{warehouse.code}</TableCell>
                      <TableCell>
                        {warehouse.location?.name} ({warehouse.location?.code})
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {warehouse.address || "-"}
                      </TableCell>
                      <TableCell>
                        {staff.find(s => s.id === warehouse.manager_id)?.full_name || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={warehouse.is_active ? "default" : "secondary"}>
                          {warehouse.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(warehouse)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(warehouse.id)}
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
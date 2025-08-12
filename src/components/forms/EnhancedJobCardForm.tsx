import React, { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, Phone, Mail, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationCurrency } from "@/lib/saas/hooks";

interface EnhancedJobCardFormProps {
  appointmentId?: string;
  onSuccess?: () => void;
}

interface Staff {
  id: string;
  full_name: string;
}

interface Client {
  id: string;
  full_name: string;
  phone?: string;
  email?: string;
}

interface Appointment {
  id: string;
  client_id?: string;
  service_id?: string;
  appointment_date: string;
  appointment_time: string;
  customer_name: string;
  service_name: string;
  staff_id?: string;
  total_amount?: number;
}

interface Service {
  id: string;
  name: string;
  category?: string;
  price?: number;
  duration_minutes?: number;
  commission_percentage?: number | null;
}

interface InventoryItem {
  id: string;
  name: string;
  type: string;
  unit?: string;
  cost_price: number;
}

interface ServiceKit {
  id: string;
  service_id: string;
  good_id: string;
  default_quantity: number;
  inventory_items: InventoryItem;
}

export function EnhancedJobCardForm({ appointmentId, onSuccess }: EnhancedJobCardFormProps) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm();
  const { symbol } = useOrganizationCurrency();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [serviceKits, setServiceKits] = useState<ServiceKit[]>([]);
  const [productQuantities, setProductQuantities] = useState<{[key: string]: number}>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const technicianType = watch("technicianType");
  const selectedServices = watch("services") || [];

  const fetchInitialData = useCallback(async () => {
    try {
      const [staffRes, clientsRes, servicesRes] = await Promise.all([
        supabase.from("staff").select("id, full_name").eq("is_active", true),
        supabase.from("clients").select("id, full_name, phone, email").eq("is_active", true),
        supabase.from("services").select("id, name, category, price, duration_minutes, commission_percentage").eq("is_active", true)
      ]);

      if (staffRes.data) setStaff(staffRes.data);
      if (clientsRes.data) setClients(clientsRes.data);
      if (servicesRes.data) setServices(servicesRes.data as any);
    } catch (error) {
      console.error("Error fetching initial data:", error);
    }
  }, []);

  const fetchServiceKits = useCallback(async (serviceId: string) => {
    try {
      const { data: kitsData, error } = await supabase
        .from("service_kits")
        .select(`
          *,
          inventory_items!service_kits_good_id_fkey (
            id, name, type, unit, cost_price
          )
        `)
        .eq("service_id", serviceId);

      if (error) throw error;
      if (kitsData) {
        setServiceKits(kitsData);
        // Initialize product quantities with default values
        const initialQuantities: {[key: string]: number} = {};
        kitsData.forEach(kit => {
          initialQuantities[kit.good_id] = kit.default_quantity || 1;
        });
        setProductQuantities(initialQuantities);
      }
    } catch (error) {
      console.error("Error fetching service kits:", error);
    }
  }, []);

  const fetchAppointmentData = useCallback(async () => {
    try {
      const { data: appointmentData, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", appointmentId)
        .single();

      if (error) throw error;
      if (appointmentData) {
        setAppointment(appointmentData);
        // Auto-populate form with appointment data
        setValue("date", appointmentData.appointment_date);
        setValue("time", appointmentData.appointment_time);
        setValue("clientName", appointmentData.customer_name);
        setValue("staffId", appointmentData.staff_id);
        
        // Determine technician type from service name
        const serviceName = appointmentData.service_name.toLowerCase();
        if (serviceName.includes("lash")) {
          setValue("technicianType", "lash");
          setValue("preferredStyle", appointmentData.service_name);
        } else if (serviceName.includes("brow")) {
          setValue("technicianType", "brow");
          setValue("preferredStyle", appointmentData.service_name);
        }

        // Fetch service kits if service is selected
        if (appointmentData.service_id) {
          fetchServiceKits(appointmentData.service_id);
        }
      }
    } catch (error) {
      console.error("Error fetching appointment:", error);
    }
  }, [appointmentId, setValue, fetchServiceKits]);

  useEffect(() => {
    fetchInitialData();
    if (appointmentId) {
      fetchAppointmentData();
    }
  }, [appointmentId, fetchAppointmentData, fetchInitialData]);


  const updateProductQuantity = (itemId: string, quantity: number) => {
    setProductQuantities(prev => ({
      ...prev,
      [itemId]: quantity
    }));
  };

  const onSubmit = async (data: Record<string, unknown>) => {
    setLoading(true);
    try {
      // Create job card with auto-generated job number
      const jobCardData = {
        client_id: (appointment?.client_id || data.client_id) as string,
        staff_id: data.staffId as string,
        appointment_id: appointmentId || '',
        start_time: new Date(`${data.date}T${data.time}`).toISOString(),
        end_time: data.endTime ? new Date(`${data.date}T${data.endTime}`).toISOString() : null,
        status: 'completed',
        total_amount: parseFloat(data.serviceCharge as string) || appointment?.total_amount || 0,
        notes: JSON.stringify({
          technicianType: data.technicianType,
          services: data.services,
          allergies: data.allergies,
          preferredStyle: data.preferredStyle,
          specialConcerns: data.specialConcerns,
          technicianNotes: data.technicianNotes,
          clientFeedback: data.clientFeedback,
          paymentMethod: data.paymentMethod,
          receiptIssued: data.receiptIssued,
          nextAppointment: data.nextAppointment
        })
      };

      const { data: jobCard, error: jobCardError } = await supabase
        .from("job_cards")
        .insert(jobCardData)
        .select()
        .single();
      
      if (jobCardError) throw jobCardError;

      // Persist selected services into job_card_services using actual service records
      const selectedNames = Array.isArray(data.services) ? (data.services as string[]) : [];
      if (selectedNames.length > 0) {
        // Map selected names to DB services by name
        const matched = services.filter((s) => selectedNames.includes(s.name));
        if (matched.length > 0) {
          const rows = matched.map((svc) => ({
            job_card_id: (jobCard as any).id,
            service_id: svc.id,
            staff_id: (data.staffId as string) || null,
            quantity: 1,
            unit_price: Number(svc.price || 0),
            duration_minutes: svc.duration_minutes || null,
            commission_percentage: (svc as any).commission_percentage ?? null,
          }));
          const { error: jcsError } = await supabase.from("job_card_services").insert(rows as any);
          if (jcsError) throw jcsError;
        }
      }

      // Insert product usage records
      if (serviceKits.length > 0) {
        const productUsage = serviceKits.map(kit => ({
          job_card_id: jobCard.id,
          inventory_item_id: kit.good_id,
          quantity_used: productQuantities[kit.good_id] || kit.default_quantity || 1,
          unit_cost: kit.inventory_items.cost_price,
          total_cost: (productQuantities[kit.good_id] || kit.default_quantity || 1) * kit.inventory_items.cost_price
        }));

        const { error: productError } = await supabase
          .from("job_card_products")
          .insert(productUsage);

        if (productError) throw productError;

        // Update inventory levels (reduce stock)
        for (const kit of serviceKits) {
          const quantityUsed = productQuantities[kit.good_id] || kit.default_quantity || 1;
          
          // Get current inventory levels
          const { data: currentLevels, error: levelsError } = await supabase
            .from("inventory_levels")
            .select("*")
            .eq("item_id", kit.good_id);

          if (levelsError) throw levelsError;

          // Update each location's inventory
          for (const level of currentLevels || []) {
            const newQuantity = Math.max(0, level.quantity - quantityUsed);
            await supabase
              .from("inventory_levels")
              .update({ quantity: newQuantity })
              .eq("id", level.id);
          }
        }
      }
      
      toast({
        title: "Success",
        description: "Job card created successfully"
      });
      
      onSuccess?.();
    } catch (error) {
      console.error("Error creating job card:", error);
      toast({
        title: "Error",
        description: "Failed to create job card",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const lashServices = [
    "Lash Removal", "Classic lash extensions", "Classic infill",
    "Hybrid lash extensions", "Hybrid infill", "Wispy Hybrid lash extensions",
    "Wispy Hybrid infill", "Volume lash extensions", "Volume infill",
    "Wispy Volume lash extensions", "Wispy Volume infill", "Lash lift",
    "Lash tint", "Lash lift & Tint", "Lash Removal (normal lashes / cluster lashes)", "Redo"
  ];

  const browServices = [
    "Nano brows", "Ombre brows", "Nano combo brows", "Brow lamination",
    "Brow tint", "Brow lamination & tint", "Touch-up (5–6 weeks)",
    "Retouch (5 months–12 months)", "Retouch (1–2 years)", "Retouch from 3 years"
  ];

  const servicesList = technicianType === "lash" ? lashServices : browServices;

  return (
    <div className="w-full p-6 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Enhanced Job Card
        </h1>
        <p className="text-muted-foreground">Complete service documentation with inventory tracking</p>
        {appointment && (
          <Badge variant="outline" className="text-sm">
            Booking: {appointment.customer_name} - {appointment.service_name}
          </Badge>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Technician Type Selection */}
        <Card className="border-2 border-primary/20">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
            <CardTitle>Technician Type</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Select onValueChange={(value) => setValue("technicianType", value)} defaultValue={technicianType}>
              <SelectTrigger>
                <SelectValue placeholder="Select technician type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lash">Lash Technician</SelectItem>
                <SelectItem value="brow">Brow Technician</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Customer Details */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-accent/50 to-accent/30">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" {...register("date", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label>Appointment Time</Label>
                <Input type="time" {...register("time", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" {...register("endTime")} />
              </div>
              <div className="space-y-2">
                <Label>Technician</Label>
                <Select onValueChange={(value) => setValue("staffId", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select technician" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Client Name</Label>
                <Input {...register("clientName")} readOnly={!!appointment} />
              </div>
              <div className="space-y-2">
                <Label>Preferred Style</Label>
                <Input {...register("preferredStyle")} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Allergies/Sensitivities</Label>
              <Textarea {...register("allergies")} className="min-h-[80px]" />
            </div>

            {technicianType === "brow" && (
              <div className="space-y-2">
                <Label>Special Concerns</Label>
                <Textarea {...register("specialConcerns")} className="min-h-[80px]" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Service Selection */}
        {technicianType && (
          <Card>
            <CardHeader>
              <CardTitle>{technicianType === "lash" ? "Lash" : "Brow"} Services</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {servicesList.map((service) => (
                  <div key={service} className="flex items-center space-x-2">
                    <Checkbox
                      checked={Array.isArray(selectedServices) ? selectedServices.includes(service) : false}
                      onCheckedChange={(checked) => {
                        const current = Array.isArray(selectedServices) ? selectedServices : [];
                        if (checked) {
                          setValue("services", [...current, service]);
                        } else {
                          setValue("services", current.filter((s: string) => s !== service));
                        }
                      }}
                    />
                    <Label className="text-sm">{service}</Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Products & Materials Used */}
        {serviceKits.length > 0 && (
          <Card>
            <CardHeader className="bg-gradient-to-r from-warning/10 to-warning/5">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Products & Materials Used
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Default Qty</TableHead>
                    <TableHead>Quantity Used</TableHead>
                    <TableHead>Unit Cost</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serviceKits.map((kit) => (
                    <TableRow key={kit.id}>
                      <TableCell className="font-medium">{kit.inventory_items.name}</TableCell>
                      <TableCell>{kit.inventory_items.type}</TableCell>
                      <TableCell>{kit.inventory_items.unit || "Each"}</TableCell>
                      <TableCell>{kit.default_quantity}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={productQuantities[kit.good_id] || kit.default_quantity || 1}
                          onChange={(e) => updateProductQuantity(kit.good_id, parseFloat(e.target.value) || 0)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>{symbol}{kit.inventory_items.cost_price?.toFixed(2) || "0.00"}</TableCell>
                      <TableCell>
                        {symbol}{((productQuantities[kit.good_id] || kit.default_quantity || 1) * (kit.inventory_items.cost_price || 0)).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Technician Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Technician Notes & Observations</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea {...register("technicianNotes")} className="min-h-[120px]" />
          </CardContent>
        </Card>

        {/* Client Satisfaction */}
        <Card>
          <CardHeader>
            <CardTitle>Client Satisfaction & Sign-Off</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-medium">Client Feedback</Label>
              <RadioGroup onValueChange={(value) => setValue("clientFeedback", value)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="extremely-satisfied" />
                  <Label>Extremely satisfied</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="satisfied" />
                  <Label>Satisfied</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="neutral" />
                  <Label>Neutral</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="unsatisfied" />
                  <Label>Unsatisfied</Label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        {/* Receptionist Completion */}
        <Card className="border-2 border-success/20">
          <CardHeader className="bg-gradient-to-r from-success/10 to-success/5">
            <CardTitle>Receptionist Completion</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Service Charge ({symbol})</Label>
                <Input type="number" step="0.01" {...register("serviceCharge")} />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select onValueChange={(value) => setValue("paymentMethod", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mpesa">MPESA</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-8">
                <Checkbox {...register("receiptIssued")} />
                <Label>Receipt Issued</Label>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox {...register("nextAppointment")} />
              <Label>Next Appointment Scheduled</Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={() => window.history.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Complete Job Card"}
          </Button>
        </div>
      </form>
    </div>
  );
}
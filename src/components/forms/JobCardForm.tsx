import React, { useState, useEffect } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Calendar, CalendarIcon, Clock, User, Phone, Mail, Scissors, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useOrganizationCurrency } from "@/lib/saas/hooks";

interface JobCardFormProps {
  clientId?: string;
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

const lashServices = [
  "Lash Removal",
  "Classic lash extensions",
  "Classic infill",
  "Hybrid lash extensions", 
  "Hybrid infill",
  "Wispy Hybrid lash extensions",
  "Wispy Hybrid infill",
  "Volume lash extensions",
  "Volume infill",
  "Wispy Volume lash extensions",
  "Wispy Volume infill",
  "Lash lift",
  "Lash tint",
  "Lash lift & Tint",
  "Lash Removal (normal lashes / cluster lashes)",
  "Redo"
];

const browServices = [
  "Nano brows",
  "Ombre brows", 
  "Nano combo brows",
  "Brow lamination",
  "Brow tint",
  "Brow lamination & tint",
  "Touch-up (5–6 weeks)",
  "Retouch (5 months–12 months)",
  "Retouch (1–2 years)",
  "Retouch from 3 years"
];

const lashChecklist = [
  "Patch test completed 24-48 hours prior",
  "Eye pads positioned correctly",
  "Lashes cleaned and primed",
  "Appropriate curl and thickness selected",
  "Isolation maintained throughout",
  "No adhesive contact with skin",
  "Final check for comfort",
  "Aftercare instructions provided"
];

const browChecklist = [
  "Patch test completed 24-48 hours prior",
  "Brow mapping completed",
  "Client consent form signed",
  "Numbing cream applied (if needed)",
  "Tools sterilized",
  "Pigment/product selected",
  "Healing instructions provided",
  "Follow-up appointment scheduled"
];

export function JobCardForm({ clientId, appointmentId, onSuccess }: JobCardFormProps) {
  const { symbol } = useOrganizationCurrency();
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  
  const technicianType = watch("technicianType");
  const selectedServices = watch("services") || [];
  const selectedChecklist = watch("checklist") || [];

  useEffect(() => {
    fetchStaffAndClients();
  }, []);

  const fetchStaffAndClients = async () => {
    try {
      const [staffRes, clientsRes] = await Promise.all([
        supabase.from("staff").select("id, full_name").eq("is_active", true),
        supabase.from("clients").select("id, full_name, phone, email").eq("is_active", true)
      ]);

      if (staffRes.data) setStaff(staffRes.data);
      if (clientsRes.data) setClients(clientsRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const onSubmit = async (data: Record<string, unknown>) => {
    setLoading(true);
    try {
      const jobCardData = {
        client_id: data.clientId as string,
        staff_id: data.staffId as string,
        appointment_id: appointmentId || '',
        job_number: `JOB-${Date.now()}`,
        start_time: new Date(`${data.date}T${data.time}`).toISOString(),
        status: 'completed',
        total_amount: parseFloat(data.serviceCharge as string) || 0,
        notes: JSON.stringify({
          technicianType: data.technicianType,
          services: data.services,
          checklist: data.checklist,
          materials: data.materials,
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

      const { data: created, error } = await supabase.from("job_cards").insert(jobCardData).select().single();
      
      if (error) throw error;

      // Persist selected services to job_card_services by mapping names -> service records
      const selectedNames = Array.isArray(data.services) ? (data.services as string[]) : [];
      if (selectedNames.length > 0) {
        // Load matching services by name to get ids and prices
        const { data: svcRows } = await supabase
          .from('services')
          .select('id, name, price, duration_minutes')
          .in('name', selectedNames);
        const rows = (svcRows || []).map((svc: any) => ({
          job_card_id: (created as any).id,
          service_id: svc.id,
          staff_id: (data.staffId as string) || null,
          quantity: 1,
          unit_price: Number(svc.price || 0),
          duration_minutes: svc.duration_minutes || null,
        }));
        if (rows.length > 0) {
          const { error: jcsError } = await supabase.from('job_card_services').insert(rows);
          if (jcsError) throw jcsError;
        }
      }
      
      onSuccess?.();
    } catch (error) {
      console.error("Error creating job card:", error);
    } finally {
      setLoading(false);
    }
  };

  const servicesList = technicianType === "lash" ? lashServices : browServices;
  const checklistItems = technicianType === "lash" ? lashChecklist : browChecklist;

  return (
    <div className="w-full p-6 space-y-8">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Professional Job Card
          </h1>
        </div>
        <p className="text-muted-foreground">Complete service documentation for beauty treatments</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Technician Type Selection */}
        <Card className="border-2 border-primary/20 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
            <CardTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-primary" />
              Technician Type
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Select onValueChange={(value) => setValue("technicianType", value)}>
              <SelectTrigger className="w-full">
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
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-accent/50 to-accent/30">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Customer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Date
                </Label>
                <Input type="date" {...register("date", { required: true })} />
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Appointment Time
                </Label>
                <Input type="time" {...register("time", { required: true })} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Technician Name</Label>
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
                <Select onValueChange={(value) => setValue("clientId", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone Number
                </Label>
                <Input {...register("phone")} placeholder="Phone number" />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Address
                </Label>
                <Input type="email" {...register("email")} placeholder="Email address" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox {...register("existingClient")} />
                <Label>Existing Client</Label>
              </div>

              <div className="space-y-2">
                <Label>Allergies/Sensitivities</Label>
                <Textarea 
                  {...register("allergies")} 
                  placeholder="Any known allergies or sensitivities..."
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label>
                  {technicianType === "lash" ? "Lash Style" : "Brow Style"}
                </Label>
                <Input 
                  {...register("preferredStyle")} 
                  placeholder={`Preferred ${technicianType === "lash" ? "lash" : "brow"} style`}
                />
              </div>

              {technicianType === "brow" && (
                <div className="space-y-2">
                  <Label>Special Concerns</Label>
                  <Textarea 
                    {...register("specialConcerns")} 
                    placeholder="Any special concerns or considerations..."
                    className="min-h-[80px]"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Service Selection */}
        {technicianType && (
          <Card className="shadow-lg">
            <CardHeader className="bg-gradient-to-r from-secondary/60 to-secondary/40">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {technicianType === "lash" ? "Lash" : "Brow"} Services
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {servicesList.map((service) => (
                  <div key={service} className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent/20 transition-colors">
                    <Checkbox 
                      value={service}
                      checked={(selectedServices || []).includes(service)}
                      onCheckedChange={(checked) => {
                        const current = selectedServices || [];
                        if (checked) {
                          setValue("services", [...current, service]);
                        } else {
                          setValue("services", current.filter((s: string) => s !== service));
                        }
                      }}
                    />
                    <Label className="text-sm font-medium cursor-pointer flex-1">
                      {service}
                    </Label>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Special Notes</Label>
                <Textarea 
                  {...register("serviceNotes")} 
                  placeholder="Additional notes about services..."
                  className="min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Service Checklist */}
        {technicianType && (
          <Card className="shadow-lg">
            <CardHeader className="bg-gradient-to-r from-success/10 to-success/5">
              <CardTitle className="flex items-center gap-2">
                <Checkbox className="h-5 w-5" />
                Service Checklist
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {checklistItems.map((item) => (
                  <div key={item} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/20 transition-colors">
                    <Checkbox 
                      value={item}
                      onCheckedChange={(checked) => {
                        const current = selectedChecklist || [];
                        if (checked) {
                          setValue("checklist", [...current, item]);
                        } else {
                          setValue("checklist", current.filter((s: string) => s !== item));
                        }
                      }}
                    />
                    <Label className="text-sm cursor-pointer flex-1">
                      {item}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Products & Materials (Lash only) */}
        {technicianType === "lash" && (
          <Card className="shadow-lg">
            <CardHeader className="bg-gradient-to-r from-warning/10 to-warning/5">
              <CardTitle>Products & Materials Used</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>Materials Used</Label>
                <Textarea 
                  {...register("materials")} 
                  placeholder="List items, types, quantities, and other materials used..."
                  className="min-h-[120px]"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Technician Notes */}
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-muted/60 to-muted/40">
            <CardTitle>Technician Notes & Observations</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Textarea 
              {...register("technicianNotes")} 
              placeholder="Observations, process notes, client response, any complications..."
              className="min-h-[120px]"
            />
          </CardContent>
        </Card>

        {/* Client Satisfaction */}
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
            <CardTitle>Client Satisfaction & Sign-Off</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Technician Signature + Date</Label>
                <Input {...register("technicianSignature")} placeholder="Technician signature" />
              </div>

              <div className="space-y-2">
                <Label>Client Signature + Date</Label>
                <Input {...register("clientSignature")} placeholder="Client signature" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Receptionist Completion */}
        <Card className="shadow-lg border-2 border-success/20">
          <CardHeader className="bg-gradient-to-r from-success/10 to-success/5">
            <CardTitle>Receptionist Completion</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Service Charge ({symbol})</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  {...register("serviceCharge", { required: true })} 
                  placeholder="0.00" 
                />
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
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox {...register("receiptIssued")} />
                <Label>Receipt Issued?</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox {...register("nextAppointment")} />
                <Label>Next Appointment Scheduled?</Label>
              </div>

              <div className="space-y-2">
                <Label>Receptionist Signature</Label>
                <Input {...register("receptionistSignature")} placeholder="Receptionist signature" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4 pt-6">
          <Button type="button" variant="outline" className="px-8">
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={loading}
            className="px-8 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            {loading ? "Creating..." : "Create Job Card"}
          </Button>
        </div>
      </form>
    </div>
  );
}
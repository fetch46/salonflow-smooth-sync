import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarDays, Clock, Phone, Mail, User, Edit2, Trash2, Plus, MoreHorizontal, Eye, FilePlus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";

interface Appointment {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_name: string;
  service_id?: string;
  staff_id: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  status: string;
  notes: string;
  price: number;
  created_at: string;
  client_id?: string;
}

interface Staff {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  specialties: string[];
}

interface Service {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  category: string;
}

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const navigate = useNavigate();
  
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    service_name: "",
    staff_id: "",
    appointment_date: "",
    appointment_time: "",
    duration_minutes: 60,
    status: "scheduled",
    notes: "",
    price: 0,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [appointmentsRes, staffRes, servicesRes] = await Promise.all([
        supabase.from("appointments").select("*").order("appointment_date", { ascending: true }),
        supabase.from("staff").select("*").eq("is_active", true),
        supabase.from("services").select("*").eq("is_active", true)
      ]);

      if (appointmentsRes.error) throw appointmentsRes.error;
      if (staffRes.error) throw staffRes.error;
      if (servicesRes.error) throw servicesRes.error;

      setAppointments(appointmentsRes.data || []);
      setStaff(staffRes.data || []);
      setServices(servicesRes.data || []);
    } catch (error) {
      toast.error("Error fetching data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Prefill from URL (e.g., /appointments?create=1&name=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') === '1') {
      setForm((prev) => ({
        ...prev,
        customer_name: params.get('name') || '',
        customer_email: params.get('email') || '',
        customer_phone: params.get('phone') || ''
      }));
      setIsModalOpen(true);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setForm(prev => ({ ...prev, [name]: value }));
    
    // Auto-fill service details when service is selected
    if (name === "service_name") {
      const selectedService = services.find(s => s.name === value);
      if (selectedService) {
        setForm(prev => ({
          ...prev,
          duration_minutes: selectedService.duration_minutes,
          price: selectedService.price
        }));
      }
    }
  };

  const resetForm = () => {
    setForm({
      customer_name: "",
      customer_email: "",
      customer_phone: "",
      service_name: "",
      staff_id: "",
      appointment_date: "",
      appointment_time: "",
      duration_minutes: 60,
      status: "scheduled",
      notes: "",
      price: 0,
    });
    setEditingAppointment(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingAppointment) {
        const { error } = await supabase
          .from("appointments")
          .update(form)
          .eq("id", editingAppointment.id);
        
        if (error) throw error;
        toast.success("Appointment updated successfully!");
      } else {
        const { error } = await supabase
          .from("appointments")
          .insert([form]);
        
        if (error) throw error;
        toast.success("Appointment created successfully!");
      }
      
      fetchData();
      resetForm();
      setIsModalOpen(false);
    } catch (error) {
      toast.error("Error saving appointment");
      console.error(error);
    }
  };

  const handleEdit = (appointment: Appointment) => {
    setForm({
      customer_name: appointment.customer_name,
      customer_email: appointment.customer_email || "",
      customer_phone: appointment.customer_phone || "",
      service_name: appointment.service_name,
      staff_id: appointment.staff_id,
      appointment_date: appointment.appointment_date,
      appointment_time: appointment.appointment_time,
      duration_minutes: appointment.duration_minutes,
      status: appointment.status,
      notes: appointment.notes || "",
      price: appointment.price,
    });
    setEditingAppointment(appointment);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this appointment?")) {
      try {
        const { error } = await supabase
          .from("appointments")
          .delete()
          .eq("id", id);
        
        if (error) throw error;
        toast.success("Appointment deleted successfully!");
        fetchData();
      } catch (error) {
        toast.error("Error deleting appointment");
        console.error(error);
      }
    }
  };
  
  const handleView = (appointment: Appointment) => {
    // Implement logic to view appointment details, perhaps in a read-only modal
    console.log("Viewing appointment:", appointment);
    toast("View Appointment functionality goes here.");
  };

  const handleCreateJobcard = async (appointment: Appointment) => {
    try {
      // Build start and end times
      const start = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
      const duration = appointment.duration_minutes || 60;
      const end = new Date(start.getTime() + duration * 60 * 1000);

      const payload: any = {
        appointment_id: appointment.id,
        client_id: appointment.client_id || null,
        staff_id: appointment.staff_id || null,
        service_ids: appointment.service_id ? [appointment.service_id] : null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        total_amount: appointment.price || 0,
        status: 'in_progress',
        notes: appointment.notes || null,
      };

      const { data, error } = await supabase
        .from('job_cards')
        .insert([payload])
        .select('id')
        .maybeSingle();

      if (error) throw error;

      toast.success('Job card created successfully');
      navigate('/job-cards');
    } catch (err) {
      console.error('Failed to create job card', err);
      toast.error('Failed to create job card');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled": return "bg-blue-100 text-blue-800";
      case "confirmed": return "bg-green-100 text-green-800";
      case "in_progress": return "bg-yellow-100 text-yellow-800";
      case "completed": return "bg-emerald-100 text-emerald-800";
      case "cancelled": return "bg-red-100 text-red-800";
      case "no_show": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading appointments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Appointments</h1>
          <p className="text-muted-foreground">Manage your salon appointments</p>
        </div>
        <Button 
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Appointment
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">
              {appointments.filter(a => a.status === "scheduled").length}
            </div>
            <p className="text-sm text-muted-foreground">Scheduled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {appointments.filter(a => a.status === "confirmed").length}
            </div>
            <p className="text-sm text-muted-foreground">Confirmed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {appointments.filter(a => a.status === "in_progress").length}
            </div>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-emerald-600">
              {appointments.filter(a => a.status === "completed").length}
            </div>
            <p className="text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <div className="text-center py-8">
              <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No appointments found</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => {
                  resetForm();
                  setIsModalOpen(true);
                }}
              >
                Create your first appointment
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {appointments.map((appointment) => {
                const staffMember = staff.find(s => s.id === appointment.staff_id);
                return (
                  <div 
                    key={appointment.id} 
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{appointment.customer_name}</span>
                          </div>
                          <Badge className={getStatusColor(appointment.status)}>
                            {appointment.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="w-4 h-4" />
                            <span>{appointment.appointment_date}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>{appointment.appointment_time} ({appointment.duration_minutes}min)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{appointment.service_name}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                          {appointment.customer_email && (
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4" />
                              <span>{appointment.customer_email}</span>
                            </div>
                          )}
                          {appointment.customer_phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4" />
                              <span>{appointment.customer_phone}</span>
                            </div>
                          )}
                          <div>
                            <span className="font-medium">Staff: </span>
                            {staffMember?.full_name || "Not assigned"}
                          </div>
                        </div>

                        {appointment.notes && (
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Notes: </span>
                            {appointment.notes}
                          </div>
                        )}

                        {appointment.price > 0 && (
                          <div className="text-sm font-medium text-green-600">
                            ${appointment.price.toFixed(2)}
                          </div>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="z-50 bg-background">
                          <DropdownMenuItem onClick={() => handleView(appointment)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Appointment
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCreateJobcard(appointment)}>
                            <FilePlus className="mr-2 h-4 w-4" />
                            Create Jobcard
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(appointment)}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            Edit Appointment
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(appointment.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Appointment
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingAppointment ? "Edit Appointment" : "Create New Appointment"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customer_name">Customer Name</Label>
                    <Input
                      id="customer_name"
                      name="customer_name"
                      value={form.customer_name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="customer_email">Customer Email</Label>
                    <Input
                      id="customer_email"
                      name="customer_email"
                      type="email"
                      value={form.customer_email}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <Label htmlFor="customer_phone">Customer Phone</Label>
                    <Input
                      id="customer_phone"
                      name="customer_phone"
                      value={form.customer_phone}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <Label htmlFor="service_name">Service</Label>
                    <Select 
                      value={form.service_name} 
                      onValueChange={(value) => handleSelectChange("service_name", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Service" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((service) => (
                          <SelectItem key={service.id} value={service.name}>
                            {service.name} - ${service.price}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="staff_id">Staff Member</Label>
                    <Select 
                      value={form.staff_id} 
                      onValueChange={(value) => handleSelectChange("staff_id", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Staff" />
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
                  <div>
                    <Label htmlFor="appointment_date">Date</Label>
                    <Input
                      id="appointment_date"
                      name="appointment_date"
                      type="date"
                      value={form.appointment_date}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="appointment_time">Time</Label>
                    <Input
                      id="appointment_time"
                      name="appointment_time"
                      type="time"
                      value={form.appointment_time}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="duration_minutes">Duration (minutes)</Label>
                    <Input
                      id="duration_minutes"
                      name="duration_minutes"
                      type="number"
                      value={form.duration_minutes}
                      onChange={handleInputChange}
                      min="15"
                      step="15"
                    />
                  </div>
                  <div>
                    <Label htmlFor="price">Price</Label>
                    <Input
                      id="price"
                      name="price"
                      type="number"
                      step="0.01"
                      value={form.price}
                      onChange={handleInputChange}
                      min="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select 
                      value={form.status} 
                      onValueChange={(value) => handleSelectChange("status", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="no_show">No Show</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    value={form.notes}
                    onChange={handleInputChange}
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-4 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingAppointment ? "Update" : "Create"} Appointment
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  CalendarDays, 
  Clock, 
  Phone, 
  Mail, 
  User, 
  Edit2, 
  Trash2, 
  Plus, 
  Search, 
  Filter,
  X
} from "lucide-react";

// Types
interface Appointment {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_name: string;
  staff_id: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  status: string;
  notes: string;
  price: number;
  created_at: string;
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

// Status configuration for consistency
const STATUS_CONFIG = {
  scheduled: { label: "Scheduled", color: "bg-blue-100 text-blue-800" },
  confirmed: { label: "Confirmed", color: "bg-green-100 text-green-800" },
  in_progress: { label: "In Progress", color: "bg-yellow-100 text-yellow-800" },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800" },
  no_show: { label: "No Show", color: "bg-gray-100 text-gray-800" }
} as const;

type StatusType = keyof typeof STATUS_CONFIG;

export default function Appointments() {
  // State
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  
  // Filter and search states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  
  // Form state
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    service_name: "",
    staff_id: "",
    appointment_date: "",
    appointment_time: "",
    duration_minutes: 60,
    status: "scheduled" as StatusType,
    notes: "",
    price: 0,
  });
  
  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch data with error handling
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [appointmentsRes, staffRes, servicesRes] = await Promise.all([
        supabase.from("appointments").select("*").order("appointment_date", { ascending: true }).order("appointment_time", { ascending: true }),
        supabase.from("staff").select("*").eq("is_active", true),
        supabase.from("services").select("*").eq("is_active", true)
      ]);

      if (appointmentsRes.error) throw appointmentsRes.error;
      if (staffRes.error) throw staffRes.error;
      if (servicesRes.error) throw servicesRes.error;

      const appointmentsData = appointmentsRes.data || [];
      setAppointments(appointmentsData);
      setFilteredAppointments(appointmentsData);
      setStaff(staffRes.data || []);
      setServices(servicesRes.data || []);
    } catch (error) {
      toast.error("Error fetching data. Please try again later.");
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Subscribe to real-time changes
  useEffect(() => {
    const channel = supabase
      .channel('appointments-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'appointments' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'appointments' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'appointments' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Apply filters whenever search or filter values change
  useEffect(() => {
    let filtered = [...appointments];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(appointment => 
        appointment.customer_name.toLowerCase().includes(term) ||
        appointment.service_name.toLowerCase().includes(term) ||
        (appointment.customer_phone && appointment.customer_phone.includes(term)) ||
        (appointment.customer_email && appointment.customer_email.toLowerCase().includes(term))
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(appointment => appointment.status === statusFilter);
    }

    // Apply date filter
    if (dateFilter) {
      filtered = filtered.filter(appointment => appointment.appointment_date === dateFilter);
    }

    setFilteredAppointments(filtered);
  }, [appointments, searchTerm, statusFilter, dateFilter]);

  // Form handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setForm(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }

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
    setErrors({});
  };

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!form.customer_name.trim()) {
      newErrors.customer_name = "Customer name is required";
    }
    
    if (form.customer_email && !/^\S+@\S+\.\S+$/.test(form.customer_email)) {
      newErrors.customer_email = "Please enter a valid email address";
    }
    
    if (!form.appointment_date) {
      newErrors.appointment_date = "Date is required";
    }
    
    if (!form.appointment_time) {
      newErrors.appointment_time = "Time is required";
    }
    
    if (!form.service_name) {
      newErrors.service_name = "Service is required";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error("Please fix the errors in the form");
      return;
    }

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
    } catch (error: any) {
      toast.error(editingAppointment ? "Error updating appointment" : "Error creating appointment");
      console.error("Error saving appointment:", error);
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
      status: appointment.status as StatusType,
      notes: appointment.notes || "",
      price: appointment.price,
    });
    setEditingAppointment(appointment);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const appointment = appointments.find(a => a.id === id);
    if (!appointment) return;
    
    const result = confirm(`Are you sure you want to delete the appointment for ${appointment.customer_name}? This action cannot be undone.`);
    
    if (!result) return;
    
    try {
      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", id);
        
      if (error) throw error;
      
      toast.success("Appointment deleted successfully!");
      fetchData();
    } catch (error: any) {
      toast.error("Error deleting appointment");
      console.error("Error deleting appointment:", error);
    }
  };

  // Helper functions
  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status as StatusType] || STATUS_CONFIG.no_show;
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setDateFilter("");
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Appointments</h1>
          <p className="text-muted-foreground">Manage your salon appointments</p>
        </div>
        <Button 
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          New Appointment
        </Button>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search appointments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  <SelectValue placeholder="All Statuses" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                placeholder="Filter by date"
              />
            </div>
            
            {(searchTerm || statusFilter !== "all" || dateFilter) && (
              <Button
                variant="outline"
                onClick={clearFilters}
                className="flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
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
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {appointments.filter(a => a.status === "cancelled").length}
            </div>
            <p className="text-sm text-muted-foreground">Cancelled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-600">
              {filteredAppointments.length}/{appointments.length}
            </div>
            <p className="text-sm text-muted-foreground">Showing/Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Appointments List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Appointments</CardTitle>
          <div className="text-sm text-muted-foreground">
            {filteredAppointments.length} {filteredAppointments.length === 1 ? 'appointment' : 'appointments'}
          </div>
        </CardHeader>
        <CardContent>
          {filteredAppointments.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No appointments found</h3>
              <p className="text-muted-foreground mb-4">
                {appointments.length === 0 
                  ? "You don't have any appointments yet."
                  : "No appointments match your current filters."
                }
              </p>
              <Button 
                variant="outline" 
                onClick={() => {
                  resetForm();
                  setIsModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create your first appointment
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAppointments.map((appointment) => {
                const staffMember = staff.find(s => s.id === appointment.staff_id);
                const service = services.find(s => s.name === appointment.service_name);
                
                return (
                  <div 
                    key={appointment.id} 
                    className="border rounded-lg p-5 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex flex-col md:flex-row md:items-start gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium text-foreground">{appointment.customer_name}</span>
                            </div>
                            {getStatusBadge(appointment.status)}
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CalendarDays className="w-4 h-4" />
                            <span>{formatDate(appointment.appointment_date)}</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span>
                              {appointment.appointment_time} • {appointment.duration_minutes} min
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-foreground">{appointment.service_name}</span>
                            {service && (
                              <span className="text-muted-foreground">
                                • {formatCurrency(service.price)}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                          {appointment.customer_email && (
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4" />
                              <span className="truncate max-w-xs" title={appointment.customer_email}>
                                {appointment.customer_email}
                              </span>
                            </div>
                          )}
                          {appointment.customer_phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4" />
                              <span>{appointment.customer_phone}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">Staff:</span>
                            {staffMember?.full_name || "Not assigned"}
                          </div>
                        </div>
                        
                        {appointment.notes && (
                          <div className="text-sm text-muted-foreground p-2 bg-muted/50 rounded-md">
                            <span className="font-medium">Note:</span> {appointment.notes}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        {appointment.price > 0 && (
                          <div className="text-right text-sm font-medium text-green-600">
                            {formatCurrency(appointment.price)}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(appointment)}
                            className="h-8 px-2"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(appointment.id)}
                            className="h-8 px-2"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Appointment Form Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsModalOpen(false);
            }
          }}
        >
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {editingAppointment ? "Edit Appointment" : "Create New Appointment"}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="customer_name">Customer Name *</Label>
                    <Input
                      id="customer_name"
                      name="customer_name"
                      value={form.customer_name}
                      onChange={handleInputChange}
                      required
                      className={errors.customer_name ? "border-red-500" : ""}
                    />
                    {errors.customer_name && (
                      <p className="text-sm text-red-500 mt-1">{errors.customer_name}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="customer_email">Customer Email</Label>
                    <Input
                      id="customer_email"
                      name="customer_email"
                      type="email"
                      value={form.customer_email}
                      onChange={handleInputChange}
                      className={errors.customer_email ? "border-red-500" : ""}
                    />
                    {errors.customer_email && (
                      <p className="text-sm text-red-500 mt-1">{errors.customer_email}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="customer_phone">Customer Phone</Label>
                    <Input
                      id="customer_phone"
                      name="customer_phone"
                      value={form.customer_phone}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="service_name">Service *</Label>
                    <Select 
                      value={form.service_name} 
                      onValueChange={(value) => handleSelectChange("service_name", value)}
                    >
                      <SelectTrigger 
                        className={errors.service_name ? "border-red-500" : ""}
                      >
                        <SelectValue placeholder="Select Service" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((service) => (
                          <SelectItem key={service.id} value={service.name}>
                            {service.name} • {formatCurrency(service.price)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.service_name && (
                      <p className="text-sm text-red-500 mt-1">{errors.service_name}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
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
                  
                  <div className="space-y-2">
                    <Label htmlFor="appointment_date">Date *</Label>
                    <Input
                      id="appointment_date"
                      name="appointment_date"
                      type="date"
                      value={form.appointment_date}
                      onChange={handleInputChange}
                      required
                      className={errors.appointment_date ? "border-red-500" : ""}
                    />
                    {errors.appointment_date && (
                      <p className="text-sm text-red-500 mt-1">{errors.appointment_date}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="appointment_time">Time *</Label>
                    <Input
                      id="appointment_time"
                      name="appointment_time"
                      type="time"
                      value={form.appointment_time}
                      onChange={handleInputChange}
                      required
                      className={errors.appointment_time ? "border-red-500" : ""}
                    />
                    {errors.appointment_time && (
                      <p className="text-sm text-red-500 mt-1">{errors.appointment_time}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
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
                  
                  <div className="space-y-2">
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
                  
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select 
                      value={form.status} 
                      onValueChange={(value) => handleSelectChange("status", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            {config.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    value={form.notes}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Add any special instructions or notes about this appointment..."
                  />
                </div>
                
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-4 pt-6">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsModalOpen(false)}
                    className="sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="sm:w-auto"
                  >
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

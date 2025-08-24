import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarDays, Clock, Phone, Mail, User, Edit2, Trash2, Plus, MoreHorizontal, Eye, FilePlus, RefreshCcw, Search, CheckCircle2, XCircle, AlertCircle, MapPin } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useSaas } from "@/lib/saas";
import { tableExists } from "@/utils/mockDatabase";
import { useOrganizationCurrency } from "@/lib/saas/hooks";

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
  location_id?: string;
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
  commission_percentage?: number | null;
}

interface ClientRow {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
}

interface AppointmentServiceItem {
  id?: string;
  appointment_id?: string;
  service_id: string;
  staff_id: string;
  duration_minutes?: number;
  price?: number;
  notes?: string;
  sort_order?: number;
  commission_percentage?: number; // Commission % override
}

export default function Appointments() {
  const { organization } = useSaas();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; account_code: string; account_name: string }>>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [defaultLocationId, setDefaultLocationId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);
  const navigate = useNavigate();
  
  const [appointmentServicesById, setAppointmentServicesById] = useState<Record<string, AppointmentServiceItem[]>>({});
  const [appointmentsWithJobcards, setAppointmentsWithJobcards] = useState<Set<string>>(new Set());

  const [clientsList, setClientsList] = useState<ClientRow[]>([]);
  const [clientSearch, setClientSearch] = useState<string>("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const handleSendConfirmation = async (appointment: Appointment) => {
    try {
      const res = await fetch('/api/notifications/appointment/confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: appointment.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to send confirmation');
      toast.success('Confirmation sent');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send confirmation');
    }
  };

  const handleSendReminder = async (appointment: Appointment) => {
    try {
      const res = await fetch('/api/notifications/appointment/reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: appointment.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to send reminder');
      toast.success('Reminder sent');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send reminder');
    }
  };

  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    // service_name will be computed from selected services
    service_name: "",
    // staff_id kept for backward compatibility; will be left empty if multiple
    staff_id: "",
    appointment_date: "",
    appointment_time: "",
    duration_minutes: 60,
    status: "scheduled",
    notes: "",
    price: 0,
    serviceItems: [] as AppointmentServiceItem[],
    location_id: "",
  });

  // Booking fee UI state
  const [bookingFeeReceived, setBookingFeeReceived] = useState(false);
  const [bookingFeeAmount, setBookingFeeAmount] = useState<string>("");
  const [bookingPaymentMethod, setBookingPaymentMethod] = useState<string>("");
  const [bookingTxnNumber, setBookingTxnNumber] = useState<string>("");
  const [bookingAccountId, setBookingAccountId] = useState<string>("");

  const { format: formatMoney } = useOrganizationCurrency();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [appointmentsRes, staffRes, servicesRes, locationsRes] = await Promise.all([
        supabase.from("appointments").select("*").order("appointment_date", { ascending: true }),
        supabase.from("staff").select("*").eq("is_active", true),
        supabase.from("services").select("*").eq("is_active", true).eq('organization_id', organization?.id || ''),
        supabase.from("business_locations").select("id, name").eq('organization_id', organization?.id || '').order("name", { ascending: true }),
      ]);

      if (appointmentsRes.error) throw appointmentsRes.error;
      if (staffRes.error) throw staffRes.error;
      if (servicesRes.error) throw servicesRes.error;
      if (locationsRes.error) throw locationsRes.error;

      setAppointments(appointmentsRes.data || []);
      setStaff(staffRes.data || []);
      setServices(servicesRes.data || []);
      setLocations((locationsRes.data || []) as any);

      // Determine default location id from organization settings if available
      try {
        const posDefault = ((organization?.settings || {}) as any)?.pos_default_location_id as string | undefined;
        setDefaultLocationId(posDefault || "");
        setForm((prev) => ({ ...prev, location_id: prev.location_id || posDefault || "" }));
      } catch {}

      // Fetch accounts only if org is selected and table exists
      try {
        if (organization?.id) {
          const hasAccounts = await tableExists(supabase, 'accounts');
          if (hasAccounts) {
            const { data: accData, error: accErr } = await supabase
              .from("accounts")
              .select("id, account_code, account_name")
              .eq("organization_id", organization.id)
              .order("account_code", { ascending: true });
            if (accErr) {
              console.warn('Accounts fetch failed, continuing without accounts', accErr);
              setAccounts([]);
            } else {
              setAccounts((accData || []) as Array<{ id: string; account_code: string; account_name: string }>);
            }
          } else {
            setAccounts([]);
          }
        } else {
          setAccounts([]);
        }
      } catch (accCatch) {
        console.warn('Accounts fetch failed, continuing without accounts', accCatch);
        setAccounts([]);
      }

      // Fetch appointment services for the loaded appointments
      const appointmentIds = (appointmentsRes.data || []).map(a => a.id);
      if (appointmentIds.length > 0) {
        const hasApptServices = await tableExists(supabase, 'appointment_services');
        if (hasApptServices) {
          const { data: apptServices, error: apptServicesError } = await supabase
            .from("appointment_services")
            .select("*")
            .in("appointment_id", appointmentIds);
          if (apptServicesError) throw apptServicesError;
          const grouped: Record<string, AppointmentServiceItem[]> = {};
          (apptServices || []).forEach((item: any) => {
            if (!grouped[item.appointment_id]) grouped[item.appointment_id] = [];
            grouped[item.appointment_id].push({
              id: item.id,
              appointment_id: item.appointment_id,
              service_id: item.service_id,
              staff_id: item.staff_id || "",
              duration_minutes: item.duration_minutes || undefined,
              price: item.price || undefined,
              notes: item.notes || undefined,
              sort_order: item.sort_order || 0,
              commission_percentage: item.commission_percentage || undefined,
            });
          });
          setAppointmentServicesById(grouped);
        } else {
          // Fallback: build single-item mapping from appointments table
          const grouped: Record<string, AppointmentServiceItem[]> = {};
          (appointmentsRes.data || []).forEach((appt: any) => {
            const items: AppointmentServiceItem[] = appt.service_id ? [{
              id: undefined,
              appointment_id: appt.id,
              service_id: appt.service_id,
              staff_id: appt.staff_id || "",
              duration_minutes: appt.duration_minutes || undefined,
              price: appt.price || undefined,
              notes: appt.notes || undefined,
              sort_order: 0,
              commission_percentage: appt.commission_percentage || undefined,
            }] : [];
            grouped[appt.id] = items;
          });
          setAppointmentServicesById(grouped);
        }

        // Build set of appointment IDs that already have job cards
        try {
          const { data: apptJobcards, error: apptJobcardsErr } = await supabase
            .from('job_cards')
            .select('appointment_id')
            .in('appointment_id', appointmentIds as string[]);
          if (apptJobcardsErr) {
            console.warn('Could not fetch job cards by appointment_id (column may not exist). Continuing without linkage.');
            setAppointmentsWithJobcards(new Set());
          } else {
            const apptIdsWithJc = new Set<string>((apptJobcards || [])
              .map((r: any) => r.appointment_id)
              .filter(Boolean));
            setAppointmentsWithJobcards(apptIdsWithJc);
          }
        } catch (linkErr) {
          console.warn('Error building appointment->jobcard linkage:', linkErr);
          setAppointmentsWithJobcards(new Set());
        }
      } else {
        setAppointmentServicesById({});
        setAppointmentsWithJobcards(new Set());
      }
    } catch (error: any) {
      toast.error(error?.message ? `Error fetching appointments: ${error.message}` : "Error fetching data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [organization]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Prefill from URL (e.g., /appointments?create=1&name=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') === '1') {
      const qp = new URLSearchParams({
        name: params.get('name') || '',
        email: params.get('email') || '',
        phone: params.get('phone') || ''
      });
      navigate(`/appointments/new?${qp.toString()}`);
    }
  }, [navigate]);

  // Helper to get dial code from organization country
  const getDialCode = (country: string): string => {
    const c = String(country || '').toLowerCase();
    const map: Record<string, string> = {
      ke: '+254', kenya: '+254',
      ug: '+256', uganda: '+256',
      tz: '+255', tanzania: '+255',
      us: '+1', usa: '+1', 'united states': '+1', 'united states of america': '+1',
      uk: '+44', gb: '+44', 'united kingdom': '+44',
      in: '+91', india: '+91',
      za: '+27', 'south africa': '+27',
      ae: '+971', 'united arab emirates': '+971',
      ca: '+1', canada: '+1',
      au: '+61', australia: '+61',
    };
    return map[c] || '';
  };

  const handleSelectExistingClient = (clientId: string) => {
    setSelectedClientId(clientId);
    const c = clientsList.find(x => x.id === clientId);
    if (c) {
      setForm(prev => ({
        ...prev,
        customer_name: c.full_name || prev.customer_name,
        customer_email: c.email || prev.customer_email,
        customer_phone: c.phone || prev.customer_phone,
      }));
    }
  };

  useEffect(() => {
    const loadClientsAndPrefill = async () => {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('id, full_name, phone, email')
          .order('full_name', { ascending: true });
        if (error) throw error;
        setClientsList(data || []);
      } catch (err) {
        console.error('Error loading clients:', err);
      }

      // Prefill phone dial code based on organization country
      const settings = (organization?.settings || {}) as any;
      const country = settings?.country || settings?.address?.country || settings?.business_country || null;
      const dial = country ? getDialCode(country) : '';
      setForm(prev => {
        if (!prev.customer_phone && dial) {
          return { ...prev, customer_phone: dial };
        }
        return prev;
      });
    };

    if (isModalOpen) {
      loadClientsAndPrefill();
    } else {
      setSelectedClientId("");
      setClientSearch("");
    }
  }, [isModalOpen, organization]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'customer_phone') {
      setSelectedClientId("");
    }
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setForm(prev => ({ ...prev, [name]: value }));
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
      serviceItems: [{ service_id: "", staff_id: "" }],
      location_id: defaultLocationId || "",
    });
    setEditingAppointment(null);
    setIsReadOnly(false);
    setBookingFeeReceived(false);
    setBookingFeeAmount("");
    setBookingPaymentMethod("");
    setBookingTxnNumber("");
    setBookingAccountId("");
  };

  const addServiceItem = () => {
    setForm(prev => ({ ...prev, serviceItems: [...prev.serviceItems, { service_id: "", staff_id: "", commission_percentage: undefined }] }));
  };

  const removeServiceItem = (index: number) => {
    setForm(prev => ({ ...prev, serviceItems: prev.serviceItems.filter((_, i) => i !== index) }));
  };

  const updateServiceItem = (index: number, field: keyof AppointmentServiceItem, value: string | number) => {
    setForm(prev => {
      const updated = [...prev.serviceItems];
      const current = { ...updated[index] };
      if (field === 'service_id') {
        const selectedService = services.find(s => s.id === value);
        current.service_id = String(value);
        if (selectedService) {
          current.duration_minutes = selectedService.duration_minutes;
          current.price = selectedService.price;
          current.commission_percentage =
            typeof selectedService.commission_percentage === 'number'
              ? Number(selectedService.commission_percentage)
              : undefined;
        }
      } else if (field === 'staff_id') {
        current.staff_id = String(value);
      } else if (field === 'duration_minutes') {
        current.duration_minutes = Number(value);
      } else if (field === 'price') {
        current.price = Number(value);
      } else if (field === 'commission_percentage') {
        current.commission_percentage = Number(value);
      }
      updated[index] = current;

      // Recompute aggregate fields
      const totalDuration = updated.reduce((sum, it) => sum + (it.duration_minutes || 0), 0);
      const totalPrice = updated.reduce((sum, it) => sum + (it.price || 0), 0);
      const serviceNames = updated
        .map(it => services.find(s => s.id === it.service_id)?.name)
        .filter(Boolean)
        .join(", ");

      return {
        ...prev,
        serviceItems: updated,
        duration_minutes: totalDuration || prev.duration_minutes,
                  price: totalPrice || prev.price,
          service_name: serviceNames,
          staff_id: updated.length === 1 ? (updated[0].staff_id || "") : "",
        };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!organization?.id) {
        toast.error("Please select an organization before saving");
        return;
      }
      // Ensure at least one service is selected
      if (!form.serviceItems.length || form.serviceItems.some(it => !it.service_id)) {
        toast.error("Please select at least one service");
        return;
      }

      // Require mobile number
      if (!form.customer_phone || !form.customer_phone.trim()) {
        toast.error("Mobile number is required");
        return;
      }

      // Resolve client (prevent duplicates by phone)
      let resolvedClientId: string | null = selectedClientId || null;
      const phoneValue = form.customer_phone.trim();
      try {
        if (!resolvedClientId) {
          const { data: existingClient, error: findClientError } = await supabase
            .from('clients')
            .select('id, phone')
            .eq('phone', phoneValue)
            .maybeSingle();
          if (findClientError && (findClientError as any).code !== 'PGRST116') {
            throw findClientError;
          }
          if (existingClient?.id) {
            resolvedClientId = existingClient.id;
          } else {
            const clientInsert: any = {
              full_name: form.customer_name || '(No name)',
              email: form.customer_email || null,
              phone: phoneValue,
            };
            if (organization?.id) {
              (clientInsert as any).organization_id = organization.id;
            }
            const { data: insertedClient, error: insertClientError } = await supabase
              .from('clients')
              .insert([clientInsert])
              .select('id')
              .single();
            if (insertClientError) throw insertClientError;
            resolvedClientId = insertedClient?.id || null;
          }
        }
      } catch (resolveErr: any) {
        toast.error(resolveErr?.message || 'Failed to resolve client');
        return;
      }

      // Compute aggregates
      const totalDuration = form.serviceItems.reduce((sum, it) => sum + (it.duration_minutes || 0), 0);
      const totalPrice = form.serviceItems.reduce((sum, it) => sum + (it.price || 0), 0);
      const serviceNames = form.serviceItems
        .map(it => services.find(s => s.id === it.service_id)?.name)
        .filter(Boolean)
        .join(", ");

      const appointmentPayload: any = {
        customer_name: form.customer_name,
        customer_email: form.customer_email || null,
        customer_phone: form.customer_phone || null,
        client_id: resolvedClientId,
        service_name: serviceNames || "",
        // Persist primary service_id for fallback UIs when appointment_services table is missing
        service_id: form.serviceItems.length >= 1 ? form.serviceItems[0].service_id : null,
        // Persist primary staff assignment from the first item for fallback display
        staff_id: form.serviceItems.length >= 1 ? (form.serviceItems[0].staff_id || null) : null,
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
        duration_minutes: totalDuration || form.duration_minutes,
        status: form.status,
        notes: form.notes || null,
        price: totalPrice || form.price,
        organization_id: organization.id,
        location_id: form.location_id || null,
      };

      if (editingAppointment) {
        // Do not attempt to update organization_id to avoid schema mismatches
        const { organization_id, ...updatePayload } = appointmentPayload;
        const { error: updateError } = await supabase
          .from("appointments")
          .update(updatePayload)
          .eq("id", editingAppointment.id);
        if (updateError) throw updateError;

        // Replace appointment_services if table exists; otherwise rely on appointment fields
        const hasApptServices = await tableExists(supabase, 'appointment_services');
        if (hasApptServices) {
          const { error: delError } = await supabase
            .from("appointment_services")
            .delete()
            .eq("appointment_id", editingAppointment.id);
          if (delError) throw delError;

          const rows = form.serviceItems.map((it, idx) => ({
            appointment_id: editingAppointment.id,
            service_id: it.service_id,
            staff_id: it.staff_id || null,
            duration_minutes: it.duration_minutes || null,
            price: it.price || null,
            notes: it.notes || null,
            sort_order: idx,
            commission_percentage: typeof it.commission_percentage === 'number' ? it.commission_percentage : null,
          }));
          if (rows.length) {
            const { error: insError } = await supabase.from("appointment_services").insert(rows);
            if (insError) throw insError;
          }
        }
        toast.success("Appointment updated successfully!");
      } else {
        const { data: inserted, error: insertError } = await (async () => {
          try {
            const res = await supabase
              .from("appointments")
              .insert([appointmentPayload])
              .select("id")
              .maybeSingle();
            if (res.error) throw res.error;
            return { data: res.data, error: null } as any;
          } catch (err: any) {
            const message = String(err?.message || "");
            // Fallback: retry without organization_id if column missing in schema
            if (message.toLowerCase().includes("organization_id") ||
                (message.toLowerCase().includes("column") && message.toLowerCase().includes("organization_id"))) {
              const { organization_id: _omit, ...payloadNoOrg } = appointmentPayload as any;
              const retry = await supabase
                .from("appointments")
                .insert([payloadNoOrg])
                .select("id")
                .maybeSingle();
              return { data: retry.data, error: retry.error } as any;
            }
            throw err;
          }
        })();
        if (insertError) throw insertError;
        const apptId = inserted?.id;
        if (!apptId) throw new Error("Failed to create appointment");

        // Insert appointment_services rows only if table exists; else store on appointment
        const hasApptServices = await tableExists(supabase, 'appointment_services');
        if (hasApptServices) {
          const rows = form.serviceItems.map((it, idx) => ({
            appointment_id: apptId,
            service_id: it.service_id,
            staff_id: it.staff_id || null,
            duration_minutes: it.duration_minutes || null,
            price: it.price || null,
            notes: it.notes || null,
            sort_order: idx,
            commission_percentage: typeof it.commission_percentage === 'number' ? it.commission_percentage : null,
          }));
          if (rows.length) {
            const { error: insError } = await supabase.from("appointment_services").insert(rows);
            if (insError) throw insError;
          }
        }

        // Booking fee no longer creates a sales receipt

        toast.success("Appointment created successfully!");
        try {
          if (inserted?.id) {
            await fetch('/api/notifications/appointment/confirmation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ appointment_id: inserted.id })
            });
          }
        } catch {}

      }
      
      fetchData();
      resetForm();
      setIsModalOpen(false);
    } catch (error: any) {
      toast.error(error?.message ? `Error saving appointment: ${error.message}` : "Error saving appointment");
      console.error(error);
    }
  };

  const handleEdit = async (appointment: Appointment) => {
    navigate(`/appointments/${appointment.id}/edit`);
  };

  const handleDelete = async (id: string) => {
    try {
      // Guard: prevent deletion if a job card exists for this appointment
      const { data: existingJc, error: jcErr } = await supabase
        .from('job_cards')
        .select('id')
        .eq('appointment_id', id)
        .limit(1);
      if (jcErr) throw jcErr;
      if (existingJc && existingJc.length > 0) {
        toast.error('Cannot delete appointment: a job card has been created for this appointment');
        return;
      }

      if (!confirm("Are you sure you want to delete this appointment?")) return;

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
  };
  
  const handleView = (appointment: Appointment) => {
    navigate(`/appointments/${appointment.id}/edit?view=1`);
  };

  const handleCreateJobcard = async (appointment: Appointment) => {
    // Enforce: Only confirmed bookings can raise a job card
    const status = String(appointment.status || '').toLowerCase();
    if (status !== 'confirmed') {
      toast.error('Only confirmed bookings can create a job card');
      return;
    }
    // Prefer navigating to the job card creation page with prefill via query param
    navigate(`/job-cards/new?appointment=${appointment.id}`);
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled": return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400";
      case "confirmed": return "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400";
      case "in_progress": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400";
      case "completed": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";
      case "cancelled": return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400";
      case "no_show": return "bg-slate-100 text-slate-700 dark:bg-slate-950/40 dark:text-slate-400";
      default: return "bg-slate-100 text-slate-700 dark:bg-slate-950/40 dark:text-slate-400";
    }
  };

  const filteredAppointments = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return appointments.filter((appt) => {
      if (statusFilter !== "all" && String(appt.status || "").toLowerCase() !== statusFilter) return false;
      if (!term) return true;

      const items = appointmentServicesById[appt.id] || [];
      const serviceNames = items
        .map((it) => services.find((s) => s.id === it.service_id)?.name)
        .filter(Boolean)
        .join(", ")
        .toLowerCase();

      return (
        String(appt.customer_name || "").toLowerCase().includes(term) ||
        String(appt.customer_email || "").toLowerCase().includes(term) ||
        String(appt.customer_phone || "").toLowerCase().includes(term) ||
        String(appt.service_name || "").toLowerCase().includes(term) ||
        serviceNames.includes(term) ||
        String(appt.appointment_date || "").toLowerCase().includes(term) ||
        String(appt.appointment_time || "").toLowerCase().includes(term)
      );
    });
  }, [appointments, searchTerm, statusFilter, services, appointmentServicesById]);

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
    <div className="p-6 w-full max-w-none mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Appointments</h1>
          <p className="text-muted-foreground">Manage your salon appointments</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button 
            variant="outline"
            size="icon"
            onClick={() => fetchData()}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button 
            onClick={() => {
              navigate('/appointments/new');
            }}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            New Appointment
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
        <Card className="overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg p-1.5 bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                <CalendarDays className="w-3 h-3" />
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Scheduled</div>
                <div className="text-xl font-semibold">
                  {appointments.filter(a => a.status === "scheduled").length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg p-1.5 bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3" />
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Confirmed</div>
                <div className="text-xl font-semibold">
                  {appointments.filter(a => a.status === "confirmed").length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg p-1.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400">
                <Clock className="w-3 h-3" />
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">In Progress</div>
                <div className="text-xl font-semibold">
                  {appointments.filter(a => a.status === "in_progress").length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg p-1.5 bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Completed</div>
                <div className="text-xl font-semibold">
                  {appointments.filter(a => a.status === "completed").length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg p-1.5 bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                <XCircle className="w-3 h-3" />
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Cancelled</div>
                <div className="text-xl font-semibold">
                  {appointments.filter(a => a.status === "cancelled").length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg p-1.5 bg-slate-100 text-slate-600 dark:bg-slate-950/40 dark:text-slate-400">
                <AlertCircle className="w-3 h-3" />
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">No Show</div>
                <div className="text-xl font-semibold">
                  {appointments.filter(a => a.status === "no_show").length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">All Appointments</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 mb-3">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, email, or service"
                className="pl-8 h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="hidden md:flex items-center flex-wrap gap-1.5">
                {["all","scheduled","confirmed","in_progress","completed","cancelled","no_show"].map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={statusFilter === s ? "default" : "outline"}
                    className="rounded-full h-8 px-3"
                    onClick={() => setStatusFilter(s)}
                  >
                    {s === "all" ? "All" : s.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                  </Button>
                ))}
                <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(""); setStatusFilter("all"); }}>
                  Clear
                </Button>
              </div>
              <div className="md:hidden flex items-center gap-2 w-full">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="no_show">No Show</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" onClick={() => { setSearchTerm(""); setStatusFilter("all"); }}>
                  Clear
                </Button>
              </div>
            </div>
          </div>

          {filteredAppointments.length === 0 ? (
              <div className="text-center py-8">
                <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No appointments found</p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => { setSearchTerm(""); setStatusFilter("all"); }}
                  >
                    Reset filters
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => fetchData()}
                    disabled={loading}
                  >
                    Refresh
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredAppointments.map((appointment) => {
                  const items = appointmentServicesById[appointment.id] || [];
                  const serviceNames = (items.length
                    ? items.map(it => services.find(s => s.id === it.service_id)?.name).filter(Boolean).join(", ")
                    : appointment.service_name) || "—";

                  return (
                    <div
                      key={appointment.id}
                      className="group relative w-full rounded-xl border bg-card p-3 md:p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-sm"
                    >
                      <div className="absolute top-3 right-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="hover:bg-slate-100 dark:hover:bg-slate-800">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="z-50 bg-background">
                            <DropdownMenuItem onClick={() => handleView(appointment)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Appointment
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleCreateJobcard(appointment)}
                              disabled={String(appointment.status || '').toLowerCase() !== 'confirmed'}
                              className={String(appointment.status || '').toLowerCase() !== 'confirmed' ? 'text-slate-400' : ''}
                              title={String(appointment.status || '').toLowerCase() !== 'confirmed' ? 'Only confirmed bookings can create a job card' : undefined}
                            >
                              <FilePlus className="mr-2 h-4 w-4" />
                              Create Jobcard
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(appointment)}>
                              <Edit2 className="mr-2 h-4 w-4" />
                              Edit Appointment
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSendConfirmation(appointment)}>
                              <Mail className="mr-2 h-4 w-4" />
                              Send Confirmation
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSendReminder(appointment)}>
                              <Clock className="mr-2 h-4 w-4" />
                              Send Reminder
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(appointment.id)}
                              disabled={appointmentsWithJobcards.has(appointment.id)}
                              className={appointmentsWithJobcards.has(appointment.id) ? 'text-slate-400' : ''}
                              title={appointmentsWithJobcards.has(appointment.id) ? 'Cannot delete: job card exists for this appointment' : undefined}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Appointment
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="flex items-center justify-start gap-2">
                        <Badge className={`${getStatusColor(appointment.status || 'scheduled')} capitalize px-1.5 py-0.5 text-xs`}>
                          {String(appointment.status || 'scheduled').replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        <span>{appointment.appointment_date}</span>
                        <span>•</span>
                        <Clock className="w-3 h-3" />
                        <span>
                          {appointment.appointment_time} ({Number(appointment.duration_minutes ?? 0)}min)
                        </span>
                      </div>

                      <div className="mt-2 flex items-start justify-start gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="font-medium text-foreground text-lg">{appointment.customer_name}</span>
                          </div>
                          <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap gap-2 text-xs text-muted-foreground">
                            {appointment.customer_email && (
                              <span className="inline-flex items-center gap-1.5"><Mail className="w-3 h-3" />{appointment.customer_email}</span>
                            )}
                            {appointment.customer_phone && (
                              <span className="inline-flex items-center gap-1.5"><Phone className="w-3 h-3" />{appointment.customer_phone}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-left">
                        <div className="text-xs text-muted-foreground">Amount</div>
                        <div className="text-sm font-semibold">
                          {Number(appointment.price || 0) > 0 ? formatMoney(Number(appointment.price || 0)) : '—'}
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {items.length ? (
                          items.map((it, idx) => {
                            const srvName = services.find(s => s.id === it.service_id)?.name || 'Service';
                            const stfName = staff.find(s => s.id === it.staff_id)?.full_name || 'Unassigned';
                            return (
                              <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted text-foreground/80 text-sm">
                                {srvName}
                                <span className="text-muted-foreground">→</span>
                                {stfName}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-base text-muted-foreground">{serviceNames}</span>
                        )}
                      </div>

                      {appointment.location_id ? (
                        <div className="mt-2 text-xs text-muted-foreground inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {locations.find((l: any) => l.id === appointment.location_id)?.name || 'Location'}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                <div className="col-span-full text-xs text-muted-foreground text-right">{filteredAppointments.length} appointments</div>
              </div>
            )}
        </CardContent>
      </Card>

      {/* Appointment modal removed: converted to window-based routes */}
    </div>
  );
}

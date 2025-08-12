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
import { CalendarDays, Clock, Phone, Mail, User, Edit2, Trash2, Plus, MoreHorizontal, Eye, FilePlus, RefreshCcw, Search } from "lucide-react";
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
        supabase.from("services").select("*").eq("is_active", true),
        supabase.from("business_locations").select("id, name").order("name", { ascending: true }),
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
      setForm((prev) => ({
        ...prev,
        customer_name: params.get('name') || '',
        customer_email: params.get('email') || '',
        customer_phone: params.get('phone') || '',
        serviceItems: prev.serviceItems.length ? prev.serviceItems : [{ service_id: "", staff_id: "" }]
      }));
      setIsModalOpen(true);
    }
  }, []);

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
    // Load service items for this appointment from cache or fetch
    let items = appointmentServicesById[appointment.id];
    if (!items) {
      const hasApptServices = await tableExists(supabase, 'appointment_services');
      if (hasApptServices) {
        const { data: apptServices, error } = await supabase
          .from("appointment_services")
          .select("*")
          .eq("appointment_id", appointment.id);
        if (error) {
          console.error(error);
        } else {
          items = (apptServices || []).map((it: any) => ({
            id: it.id,
            appointment_id: it.appointment_id,
            service_id: it.service_id,
            staff_id: it.staff_id || "",
            duration_minutes: it.duration_minutes || undefined,
            price: it.price || undefined,
            notes: it.notes || undefined,
            sort_order: it.sort_order || 0,
            commission_percentage: it.commission_percentage || undefined,
          }));
        }
      } else {
        items = appointment.service_id ? [{
          id: undefined,
          appointment_id: appointment.id,
          service_id: appointment.service_id,
          staff_id: appointment.staff_id || "",
          duration_minutes: appointment.duration_minutes || undefined,
          price: appointment.price || undefined,
          notes: appointment.notes || undefined,
          sort_order: 0,
          commission_percentage: (appointment as any)?.commission_percentage || undefined,
        }] : [];
      }
    }

    setForm({
      customer_name: appointment.customer_name,
      customer_email: appointment.customer_email || "",
      customer_phone: appointment.customer_phone || "",
      service_name: appointment.service_name,
      staff_id: appointment.staff_id || "",
      appointment_date: appointment.appointment_date,
      appointment_time: appointment.appointment_time,
      duration_minutes: appointment.duration_minutes,
      status: appointment.status,
      notes: appointment.notes || "",
      price: appointment.price,
      serviceItems: (items && items.length) ? items : [{ service_id: "", staff_id: "", commission_percentage: undefined }],
      location_id: (appointment as any)?.location_id || defaultLocationId || "",
    });
    setEditingAppointment(appointment);
    setIsModalOpen(true);
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
    // Reuse edit loader then switch to read-only mode
    handleEdit(appointment);
    setIsReadOnly(true);
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
      case "scheduled": return "bg-blue-100 text-blue-800";
      case "confirmed": return "bg-green-100 text-green-800";
      case "in_progress": return "bg-yellow-100 text-yellow-800";
      case "completed": return "bg-emerald-100 text-emerald-800";
      case "cancelled": return "bg-red-100 text-red-800";
      case "no_show": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
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
    <div className="p-6 w-full max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Appointments</h1>
          <p className="text-muted-foreground">Manage your salon appointments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            size="icon"
            onClick={() => fetchData()}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, email, or service"
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
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
              <div className="space-y-3">
                {filteredAppointments.map((appointment) => {
                  const items = appointmentServicesById[appointment.id] || [];
                  const serviceNames = (items.length
                    ? items.map(it => services.find(s => s.id === it.service_id)?.name).filter(Boolean).join(', ')
                    : appointment.service_name) || '—';
                  const staffNames = items.length
                    ? items.map(it => {
                        const srvName = services.find(s => s.id === it.service_id)?.name || 'Service';
                        const stfName = staff.find(s => s.id === it.staff_id)?.full_name || 'Unassigned';
                        return `${srvName} → ${stfName}`;
                      }).join('; ')
                    : (staff.find(s => s.id === appointment.staff_id)?.full_name || 'Not assigned');

                  return (
                    <div
                      key={appointment.id}
                      className="group rounded-xl border bg-gradient-to-r from-white to-slate-50 dark:from-slate-950 dark:to-slate-900 p-4 sm:p-5 shadow-sm hover:shadow-md transition-colors"
                    >
                      <div className="flex flex-col gap-4 md:grid md:grid-cols-[180px_1fr_220px_auto] md:items-center">
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            <CalendarDays className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{appointment.appointment_date}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              <span>
                                {appointment.appointment_time} ({Number(appointment.duration_minutes ?? 0)}min)
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium text-slate-900 dark:text-slate-100">{appointment.customer_name}</span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 text-sm text-muted-foreground">
                            {appointment.customer_email && (
                              <span className="inline-flex items-center gap-2"><Mail className="w-4 h-4" />{appointment.customer_email}</span>
                            )}
                            {appointment.customer_phone && (
                              <span className="inline-flex items-center gap-2"><Phone className="w-4 h-4" />{appointment.customer_phone}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {items.length ? (
                              items.map((it, idx) => {
                                const srvName = services.find(s => s.id === it.service_id)?.name || 'Service';
                                const stfName = staff.find(s => s.id === it.staff_id)?.full_name || 'Unassigned';
                                return (
                                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs">
                                    {srvName}
                                    <span className="text-slate-400">→</span>
                                    {stfName}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-sm text-muted-foreground">{serviceNames}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center md:justify-center gap-3">
                          <Badge className={getStatusColor(appointment.status || 'scheduled')}>
                            {String(appointment.status || 'scheduled').replace('_', ' ')}
                          </Badge>
                          <div className="text-right font-semibold">
                            {Number(appointment.price || 0) > 0 ? formatMoney(Number(appointment.price || 0)) : '—'}
                          </div>
                        </div>

                        <div className="md:justify-self-end">
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
                      </div>
                    </div>
                  );
                })}
                <div className="text-xs text-muted-foreground text-right">{filteredAppointments.length} appointments</div>
              </div>
            )}
        </CardContent>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {isReadOnly ? "View Appointment" : (editingAppointment ? "Edit Appointment" : "Create New Appointment")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="location_id">Location</Label>
                    <Select 
                      value={form.location_id}
                      onValueChange={(value) => setForm(prev => ({ ...prev, location_id: value }))}
                    >
                      <SelectTrigger disabled={isReadOnly}>
                        <SelectValue placeholder={locations.length ? "Select location" : "No locations"} />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 border rounded-md p-3 space-y-2">
                    <Label>Select Existing Client (optional)</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Input
                        placeholder="Search by name or phone"
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        disabled={isReadOnly}
                      />
                      <Select value={selectedClientId} onValueChange={handleSelectExistingClient}>
                        <SelectTrigger disabled={isReadOnly}>
                          <SelectValue placeholder="Choose client" />
                        </SelectTrigger>
                        <SelectContent>
                          {(clientsList.filter(c =>
                            c.full_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                            (c.phone || '').includes(clientSearch)
                          )).map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.full_name}{c.phone ? ` · ${c.phone}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" onClick={() => { setSelectedClientId(""); setClientSearch(""); }} disabled={isReadOnly}>
                        Clear
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Selecting a client will auto-fill the details below.</p>
                  </div>
                  <div>
                    <Label htmlFor="customer_name">Customer Name</Label>
                    <Input
                      id="customer_name"
                      name="customer_name"
                      value={form.customer_name}
                      onChange={handleInputChange}
                      disabled={isReadOnly}
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
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <Label htmlFor="customer_phone">Customer Phone<span className="text-red-500">*</span></Label>
                    <Input
                      id="customer_phone"
                      name="customer_phone"
                      value={form.customer_phone}
                      onChange={handleInputChange}
                      disabled={isReadOnly}
                      required
                    />
                  </div>

                  <div className="md:col-span-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Services and Staff</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addServiceItem} className="gap-1" disabled={isReadOnly}>
                        <Plus className="w-3 h-3" /> Add Service
                      </Button>
                    </div>

                    {form.serviceItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end border rounded-md p-3">
                        <div className="md:col-span-5">
                          <Label>Service</Label>
                          <Select 
                            value={item.service_id}
                            onValueChange={(value) => updateServiceItem(idx, 'service_id', value)}
                          >
                            <SelectTrigger disabled={isReadOnly}>
                              <SelectValue placeholder="Select Service" />
                            </SelectTrigger>
                            <SelectContent className="z-[100]">
                              {services.map((service) => (
                                <SelectItem key={service.id} value={service.id}>
                                  {service.name} - ${service.price}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-4">
                          <Label>Staff</Label>
                          <Select 
                            value={item.staff_id}
                            onValueChange={(value) => updateServiceItem(idx, 'staff_id', value)}
                          >
                            <SelectTrigger disabled={isReadOnly}>
                              <SelectValue placeholder="Assign Staff" />
                            </SelectTrigger>
                            <SelectContent className="z-[100]">
                              {staff.map((member) => (
                                <SelectItem key={member.id} value={member.id}>
                                  {member.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-2">
                          <Label>Duration</Label>
                          <Input
                            type="number"
                            min={0}
                            step={15}
                            value={item.duration_minutes ?? ''}
                            onChange={(e) => updateServiceItem(idx, 'duration_minutes', Number(e.target.value))}
                            disabled={isReadOnly}
                          />
                        </div>
                        <div className="md:col-span-1">
                          <Label>Price</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.price ?? ''}
                            onChange={(e) => updateServiceItem(idx, 'price', Number(e.target.value))}
                            disabled={isReadOnly}
                          />
                        </div>
                        <div className="md:col-span-1">
                          <Label>Commission %</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={item.commission_percentage ?? ''}
                            onChange={(e) => updateServiceItem(idx, 'commission_percentage', Number(e.target.value))}
                            disabled={isReadOnly}
                          />
                        </div>
                        <div className="md:col-span-12 flex justify-end">
                          {form.serviceItems.length > 1 && !isReadOnly && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeServiceItem(idx)} className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-1" /> Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <Label htmlFor="appointment_date">Date</Label>
                    <Input
                      id="appointment_date"
                      name="appointment_date"
                      type="date"
                      value={form.appointment_date}
                      onChange={handleInputChange}
                      disabled={isReadOnly}
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
                      disabled={isReadOnly}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="duration_minutes">Total Duration (minutes)</Label>
                    <Input
                      id="duration_minutes"
                      name="duration_minutes"
                      type="number"
                      value={form.duration_minutes}
                      onChange={handleInputChange}
                      min="15"
                      step="15"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <Label htmlFor="price">Total Price</Label>
                    <Input
                      id="price"
                      name="price"
                      type="number"
                      step="0.01"
                      value={form.price}
                      onChange={handleInputChange}
                      min="0"
                      disabled={isReadOnly}
                    />
                  </div>

                  {/* Booking fee section */}
                  <div className="md:col-span-2 border rounded-md p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <input
                        id="booking-fee-received"
                        type="checkbox"
                        checked={bookingFeeReceived}
                        onChange={(e) => setBookingFeeReceived(e.target.checked)}
                        disabled={isReadOnly}
                      />
                      <Label htmlFor="booking-fee-received">Booking fee received</Label>
                    </div>
                    {bookingFeeReceived && (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <Label htmlFor="booking-amount">Amount Paid</Label>
                          <Input
                            id="booking-amount"
                            type="number"
                            step="0.01"
                            value={bookingFeeAmount}
                            onChange={(e) => setBookingFeeAmount(e.target.value)}
                            placeholder="0.00"
                            disabled={isReadOnly}
                          />
                        </div>
                        <div>
                          <Label htmlFor="booking-method">Payment Method</Label>
                          <Select value={bookingPaymentMethod} onValueChange={setBookingPaymentMethod}>
                            <SelectTrigger disabled={isReadOnly}>
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="mpesa">M-Pesa</SelectItem>
                              <SelectItem value="card">Card</SelectItem>
                              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="booking-account">Account Deposited To</Label>
                          <Select value={bookingAccountId} onValueChange={setBookingAccountId}>
                            <SelectTrigger disabled={isReadOnly}>
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts.map(acc => (
                                <SelectItem key={acc.id} value={acc.id}>
                                  {acc.account_code} · {acc.account_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="booking-ref">Transaction Number</Label>
                          <Input
                            id="booking-ref"
                            value={bookingTxnNumber}
                            onChange={(e) => setBookingTxnNumber(e.target.value)}
                            placeholder="e.g. QFG3XXXXXX"
                            disabled={isReadOnly}
                          />
                        </div>
                        <div className="md:col-span-4">
                          <div className="text-sm text-muted-foreground">
                            Balance: <span className="font-medium text-foreground">${Math.max(0, (Number(form.price || 0)) - (Number(bookingFeeAmount || 0))).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select 
                      value={form.status} 
                      onValueChange={(value) => handleSelectChange("status", value)}
                    >
                      <SelectTrigger disabled={isReadOnly}>
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
                    disabled={isReadOnly}
                  />
                </div>

                <div className="flex justify-end gap-4 pt-4">
                  {isReadOnly ? (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => { setIsModalOpen(false); setIsReadOnly(false); }}
                    >
                      Close
                    </Button>
                  ) : (
                    <>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => { setIsModalOpen(false); setIsReadOnly(false); }}
                      >
                        Cancel
                      </Button>
                      <Button type="submit">
                        {editingAppointment ? "Update" : "Create"} Appointment
                      </Button>
                    </>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

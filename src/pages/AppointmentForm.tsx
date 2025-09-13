import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSaas } from "@/lib/saas";
import { tableExists } from "@/utils/mockDatabase";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { Plus, Trash2 } from "lucide-react";

interface AppointmentServiceItem {
  id?: string;
  appointment_id?: string;
  service_id: string;
  staff_id: string;
  duration_minutes?: number;
  price?: number;
  notes?: string;
  sort_order?: number;
  commission_percentage?: number;
}

interface Staff {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
}

interface Service {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
  category?: string;
  commission_percentage?: number | null;
}

interface ClientRow {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
}

export default function AppointmentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { organization } = useSaas();
  const { format: formatMoney } = useOrganizationCurrency();

  const [loading, setLoading] = useState<boolean>(true);
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);

  const [staff, setStaff] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; account_code: string; account_name: string }>>([]);

  const [clientsList, setClientsList] = useState<ClientRow[]>([]);
  const [clientSearch, setClientSearch] = useState<string>("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  const [bookingFeeReceived, setBookingFeeReceived] = useState(false);
  const [bookingFeeAmount, setBookingFeeAmount] = useState<string>("");
  const [bookingPaymentMethod, setBookingPaymentMethod] = useState<string>("");
  const [bookingTxnNumber, setBookingTxnNumber] = useState<string>("");
  const [bookingAccountId, setBookingAccountId] = useState<string>("");

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
    serviceItems: [] as AppointmentServiceItem[],
    location_id: "",
  });

  useEffect(() => {
    setIsReadOnly(searchParams.get("view") === "1");
  }, [searchParams]);

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

  const loadClients = useCallback(async () => {
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
  }, []);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRes, clientsRes, servicesRes, locationsRes] = await Promise.all([
        supabase.from("staff").select("*").eq("is_active", true),
        supabase.from("clients").select("*"),
        supabase.from("services").select("*").eq("is_active", true).eq('organization_id', organization?.id || ''),
        supabase.from("business_locations").select("id, name").eq('organization_id', organization?.id || '').order("name", { ascending: true }),
      ]);

      if (staffRes.error) throw staffRes.error;
      if (servicesRes.error) throw servicesRes.error;
      if (locationsRes.error) throw locationsRes.error;

      setStaff(staffRes.data || []);
      setServices(servicesRes.data || []);
      setLocations((locationsRes.data || []) as any);

      if (organization?.id) {
        try {
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
        } catch (accCatch) {
          console.warn('Accounts fetch failed, continuing without accounts', accCatch);
          setAccounts([]);
        }
      } else {
        setAccounts([]);
      }

      // If editing, load appointment details and items
      if (id) {
        const { data: appt, error: apptErr } = await supabase
          .from("appointments")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (apptErr) throw apptErr;
        if (!appt) throw new Error("Appointment not found");

        let items: AppointmentServiceItem[] = [];
        const hasApptServices = await tableExists(supabase, 'appointment_services');
        if (hasApptServices) {
          const { data: apptServices, error } = await supabase
            .from("appointment_services")
            .select("*")
            .eq("appointment_id", id);
          if (error) throw error;
          items = (apptServices || []).map((it: any) => ({
            id: it.id,
            appointment_id: it.appointment_id,
            service_id: it.service_id,
            staff_id: it.staff_id || "",
            duration_minutes: it.duration_minutes || undefined,
            price: (it as any).price ?? (it as any).unit_price ?? undefined,
            notes: it.notes || undefined,
            sort_order: it.sort_order || 0,
            commission_percentage: it.commission_percentage || undefined,
          }));
        } else {
          items = appt.service_id ? [{
            id: undefined,
            appointment_id: appt.id,
            service_id: appt.service_id,
            staff_id: appt.staff_id || "",
            duration_minutes: appt.duration_minutes || undefined,
            price: appt.price || undefined,
            notes: appt.notes || undefined,
            sort_order: 0,
            commission_percentage: (appt as any)?.commission_percentage || undefined,
          }] : [];
        }

        setForm({
          customer_name: appt.customer_name,
          customer_email: appt.customer_email || "",
          customer_phone: appt.customer_phone || "",
          service_name: appt.service_name,
          staff_id: appt.staff_id || "",
          appointment_date: appt.appointment_date,
          appointment_time: appt.appointment_time,
          duration_minutes: appt.duration_minutes,
          status: appt.status,
          notes: appt.notes || "",
          price: appt.price,
          serviceItems: (items && items.length) ? items : [{ service_id: "", staff_id: "", commission_percentage: undefined }],
          location_id: (appt as any)?.location_id || "",
        });
      } else {
        // Prefill from query params when creating new
        setForm(prev => ({
          ...prev,
          customer_name: searchParams.get('name') || prev.customer_name,
          customer_email: searchParams.get('email') || prev.customer_email,
          customer_phone: searchParams.get('phone') || prev.customer_phone,
          serviceItems: prev.serviceItems.length ? prev.serviceItems : [{ service_id: "", staff_id: "" }],
        }));
      }

      // Prefill dial code if present and phone empty
      try {
        const settings = (organization?.settings || {}) as any;
        const country = settings?.country || settings?.address?.country || settings?.business_country || null;
        const dial = country ? getDialCode(country) : '';
        setForm(prev => {
          if (!prev.customer_phone && dial) {
            return { ...prev, customer_phone: dial };
          }
          return prev;
        });
      } catch {}

      // Prefill default appointment location if configured and creating new
      try {
        if (!id) {
          const settings = (organization?.settings || {}) as any;
          const defaultApptLocationId = settings?.appointments_default_location_id || '';
          if (defaultApptLocationId) {
            setForm(prev => ({ ...prev, location_id: prev.location_id || defaultApptLocationId }));
          }
        }
      } catch {}

      await loadClients();
    } catch (error: any) {
      toast.error(error?.message ? `Error loading data: ${error.message}` : "Error loading data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [id, organization, searchParams, loadClients]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

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

  const resetAndReturn = () => {
    navigate("/appointments");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!organization?.id) {
        toast.error("Please select an organization before saving");
        return;
      }

      // Validate mandatory fields
      if (!form.location_id) {
        toast.error("Location is mandatory. Please select a location.");
        return;
      }

      if (!form.serviceItems.length || form.serviceItems.some(it => !it.service_id)) {
        toast.error("Please select at least one service");
        return;
      }

      // Validate that all service items have staff assigned
      if (form.serviceItems.some(it => !it.staff_id)) {
        toast.error("Staff assignment is mandatory for all services. Please assign staff to each service.");
        return;
      }

      if (!form.customer_phone || !form.customer_phone.trim()) {
        toast.error("Mobile number is required");
        return;
      }

      if (!form.appointment_date) {
        toast.error("Appointment date is mandatory. Please select a date.");
        return;
      }

      if (!form.appointment_time) {
        toast.error("Appointment time is mandatory. Please select a time.");
        return;
      }

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
        service_id: form.serviceItems.length >= 1 ? form.serviceItems[0].service_id : null,
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

      if (id) {
        const { organization_id, ...updatePayload } = appointmentPayload;
        const { error: updateError } = await supabase
          .from("appointments")
          .update(updatePayload)
          .eq("id", id);
        if (updateError) throw updateError;

        const hasApptServices = await tableExists(supabase, 'appointment_services');
        if (hasApptServices) {
          const { error: delError } = await supabase
            .from("appointment_services")
            .delete()
            .eq("appointment_id", id);
          if (delError) throw delError;

          const rows = form.serviceItems.map((it, idx) => ({
            appointment_id: id,
            service_id: it.service_id,
            staff_id: it.staff_id || null,
            duration_minutes: it.duration_minutes || null,
            quantity: 1,
            unit_price: (typeof it.price === 'number' ? it.price : null) || 0,
            total_price: (typeof it.price === 'number' ? it.price : null) || 0,
            notes: it.notes || null,
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

        const hasApptServices = await tableExists(supabase, 'appointment_services');
        if (hasApptServices) {
          const rows = form.serviceItems.map((it, idx) => ({
            appointment_id: apptId,
            service_id: it.service_id,
            staff_id: it.staff_id || null,
            duration_minutes: it.duration_minutes || null,
            quantity: 1,
            unit_price: (typeof it.price === 'number' ? it.price : null) || 0,
            total_price: (typeof it.price === 'number' ? it.price : null) || 0,
            notes: it.notes || null,
            commission_percentage: typeof it.commission_percentage === 'number' ? it.commission_percentage : null,
          }));
          if (rows.length) {
            const { error: insError } = await supabase.from("appointment_services").insert(rows);
            if (insError) throw insError;
          }
        }

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

      resetAndReturn();
    } catch (error: any) {
      toast.error(error?.message ? `Error saving appointment: ${error.message}` : "Error saving appointment");
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading appointment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 w-full max-w-[1800px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{isReadOnly ? "View Appointment" : (id ? "Edit Appointment" : "Create New Appointment")}</h1>
          <p className="text-muted-foreground">Manage appointment details</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isReadOnly ? "View Appointment" : (id ? "Edit Appointment" : "Create New Appointment")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="location_id">Location<span className="text-red-500">*</span></Label>
                <Select 
                  value={form.location_id}
                  onValueChange={(value) => setForm(prev => ({ ...prev, location_id: value }))}
                  required
                >
                  <SelectTrigger disabled={isReadOnly} className={!form.location_id ? "border-red-500" : ""}>
                    <SelectValue placeholder={locations.length ? "Select location (Required)" : "No locations"} />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4 border rounded-md p-3 space-y-2">
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

              <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Services and Staff<span className="text-red-500">*</span></Label>
                  {!isReadOnly && (
                    <Button type="button" variant="outline" size="sm" onClick={addServiceItem} className="gap-1">
                      <Plus className="w-3 h-3" /> Add Service
                    </Button>
                  )}
                </div>

                {form.serviceItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end border rounded-md p-3">
                    <div className="md:col-span-5">
                      <Label>Service<span className="text-red-500">*</span></Label>
                      <Select 
                        value={item.service_id}
                        onValueChange={(value) => updateServiceItem(idx, 'service_id', value)}
                        required
                      >
                        <SelectTrigger disabled={isReadOnly} className={!item.service_id ? "border-red-500" : ""}>
                          <SelectValue placeholder="Select Service (Required)" />
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
                      <Label>Staff<span className="text-red-500">*</span></Label>
                      <Select 
                        value={item.staff_id}
                        onValueChange={(value) => updateServiceItem(idx, 'staff_id', value)}
                        required
                      >
                        <SelectTrigger disabled={isReadOnly} className={!item.staff_id ? "border-red-500" : ""}>
                          <SelectValue placeholder="Assign Staff (Required)" />
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
                <Label htmlFor="appointment_date">Date<span className="text-red-500">*</span></Label>
                <Input
                  id="appointment_date"
                  name="appointment_date"
                  type="date"
                  value={form.appointment_date}
                  onChange={handleInputChange}
                  disabled={isReadOnly}
                  required
                  className={!form.appointment_date ? "border-red-500" : ""}
                />
              </div>
              <div>
                <Label htmlFor="appointment_time">Time<span className="text-red-500">*</span></Label>
                <Input
                  id="appointment_time"
                  name="appointment_time"
                  type="time"
                  value={form.appointment_time}
                  onChange={handleInputChange}
                  disabled={isReadOnly}
                  required
                  className={!form.appointment_time ? "border-red-500" : ""}
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

              <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4 border rounded-md p-4 space-y-4">
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
                        Balance: <span className="font-medium text-foreground">{formatMoney(Math.max(0, (Number(form.price || 0)) - (Number(bookingFeeAmount || 0))))}</span>
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
                  onClick={() => { resetAndReturn(); }}
                >
                  Close
                </Button>
              ) : (
                <>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => { resetAndReturn(); }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {id ? "Update" : "Create"} Appointment
                  </Button>
                </>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
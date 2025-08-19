import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft, 
  ArrowRight,
  Calendar,
  Clock,
  User,
  Users,
  Scissors,
  Package,
  DollarSign,
  Star,
  CheckCircle,
  AlertTriangle,
  Plus,
  Minus,
  Phone,
  Mail,
  MapPin,
  Timer,
  Sparkles,
  Receipt,
  CreditCard,
  Edit3,
  Save,
  FileText,
  Camera,
  Upload,
  Check,
  X,
  Info,
  Target,
  Zap,
  Award
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addMinutes } from "date-fns";
import { useFeatureGating } from "@/hooks/useFeatureGating";
import { CreateButtonGate, FeatureGate } from "@/components/features/FeatureGate";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSaas } from "@/lib/saas";

interface Staff {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  specialties?: string[];
  profile_image?: string;
  commission_rate?: number;
}

interface Client {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  address?: string;
  total_visits?: number;
  last_visit_date?: string;
  client_status?: string;
}

interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration_minutes: number;
  category?: string;
  commission_percentage?: number | null;
}

interface Appointment {
  id: string;
  client_id?: string;
  service_id?: string;
  staff_id?: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  notes?: string;
  customer_name?: string; // Added for client name in appointment list
  service_name?: string; // Added for service name in appointment list
}

interface InventoryItem {
  id: string;
  name: string;
  type: string;
  unit?: string;
  cost_price: number;
  current_stock?: number;
}

interface ServiceKit {
  id: string;
  service_id: string;
  good_id: string;
  default_quantity: number;
  inventory_items: InventoryItem;
}

interface JobCardData {
  appointment_id?: string;
  client_id?: string;
  staff_id?: string;
  services: string[];
  start_time?: string;
  end_time?: string;
  notes?: string;
  client_feedback?: string;
  service_charge: number;
  payment_method?: string;
  payment_transaction_number?: string;
  receipt_issued: boolean;
  next_appointment: boolean;
  products_used: { [key: string]: number };
}

export default function CreateJobCard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get('appointment');
  
  // State Management
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { hasFeature, getFeatureAccess } = useFeatureGating();
  const { format: formatMoney } = useOrganizationCurrency();
  const { organization } = useSaas();
  
  // Data State
  const [staff, setStaff] = useState<Staff[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [serviceKits, setServiceKits] = useState<ServiceKit[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string; is_active: boolean; location_id?: string }>>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [inventoryByItemId, setInventoryByItemId] = useState<Record<string, number>>({});
  
  // Form State
  const [jobCardData, setJobCardData] = useState<JobCardData>({
    services: [],
    service_charge: 0,
    receipt_issued: false,
    next_appointment: false,
    products_used: {}
  });
  
  // UI State
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [serviceStaffMap, setServiceStaffMap] = useState<Record<string, string>>({});
  const [totalDuration, setTotalDuration] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [productCosts, setProductCosts] = useState(0);

  const steps = [
    { 
      id: 1, 
      title: "Appointment & Client", 
      subtitle: "Select appointment or client details",
      icon: Calendar 
    },
    { 
      id: 2, 
      title: "Services & Staff", 
      subtitle: "Choose services and assign staff",
      icon: Scissors 
    },
    { 
      id: 3, 
      title: "Products & Materials", 
      subtitle: "Track products and materials used",
      icon: Package 
    },
    { 
      id: 4, 
      title: "Service Completion", 
      subtitle: "Notes, feedback, and final details",
      icon: CheckCircle 
    },
    { 
      id: 5, 
      title: "Payment & Receipt", 
      subtitle: "Process payment and finalize",
      icon: Receipt 
    }
  ];

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      if (!organization?.id) {
        throw new Error('No active organization selected');
      }

      const [staffRes, clientsRes, servicesRes, appointmentsRes, locationsRes, orgRes, whRes] = await Promise.all([
        supabase.from("staff").select("*").eq("is_active", true).eq('organization_id', organization.id),
        supabase.from("clients").select("*").eq('organization_id', organization.id),
        supabase.from("services").select("*").eq("is_active", true).eq('organization_id', organization.id),
        supabase.from("appointments").select("*").eq('organization_id', organization.id).gte("appointment_date", format(new Date(), 'yyyy-MM-dd')),
        supabase.from('business_locations').select('id, name, is_default').eq('organization_id', organization.id).order('name'),
        supabase.from('organizations').select('id, settings').eq('id', organization.id).single(),
        supabase.from('warehouses').select('id, name, is_active, location_id').eq('organization_id', organization.id).order('name')
      ]);

      if (staffRes.data) setStaff(staffRes.data);
      if (clientsRes.data) setClients(clientsRes.data);
      if (servicesRes.data) setServices(servicesRes.data);
      if (appointmentsRes.data) setAppointments(appointmentsRes.data);
      if (locationsRes.data) {
        setLocations(locationsRes.data as any);
        const defaultLoc = (locationsRes.data as any[]).find((l) => l.is_default);
        const settings = (orgRes.data as any)?.settings || {};
        const initialLoc = (settings.jobcards_default_location_id || defaultLoc?.id || '') as string;
        setSelectedLocationId(initialLoc);
        setWarehouses(whRes.data || []);
        const initialWh = (settings.jobcards_default_warehouse_id || settings.pos_default_warehouse_id || '') as string;
        setSelectedWarehouseId(initialWh);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load initial data");
    } finally {
      setLoading(false);
    }
  };

  const loadAppointmentData = useCallback(async (appointmentId: string) => {
    const appointment = appointments.find(apt => apt.id === appointmentId);
    if (!appointment) return;

    // Avoid redundant state churn
    setSelectedAppointment(prev => (prev?.id === appointment.id ? prev : appointment));

    const client = clients.find(c => c.id === appointment.client_id);
    if (client) setSelectedClient(client);

    try {
      // Load multi-service details from appointment_services with joined service records
      const { data: apptServices, error } = await supabase
        .from("appointment_services")
        .select(`
          service_id,
          staff_id,
          duration_minutes,
          price,
          commission_percentage,
          services ( id, name, description, price, duration_minutes, category )
        `)
        .eq("appointment_id", appointment.id);

      if (error) throw error;

      if (apptServices && apptServices.length > 0) {
        // Build selected services from join
        const svcList: Service[] = apptServices
          .map((row: any) => row.services)
          .filter(Boolean) as Service[];
        setSelectedServices(svcList);

        // Map service_id -> commission override if provided
        const commissionByService: Record<string, number | null> = {};
        for (const row of apptServices as any[]) {
          if (row.service_id && typeof row.commission_percentage === 'number') {
            commissionByService[row.service_id] = row.commission_percentage as number;
          }
        }

        // Build service -> staff assignment map
        const assignmentMap: Record<string, string> = {};
        for (const row of apptServices as any[]) {
          if (row.service_id && row.staff_id) assignmentMap[row.service_id] = row.staff_id;
        }
        setServiceStaffMap(assignmentMap);

        // Store commission overrides for later use on submit by stashing on window
        (window as any).__appointmentServiceCommission = commissionByService;

        // Pick a primary staff for backward compatibility
        const firstStaffId = (apptServices.find((r: any) => !!r.staff_id) as any)?.staff_id as string | undefined;
        if (firstStaffId) {
          const staffMember = staff.find(s => s.id === firstStaffId) || null;
          setSelectedStaff(staffMember);
        }

        setJobCardData(prev => ({
          ...prev,
          appointment_id: appointment.id,
          client_id: appointment.client_id || undefined,
          staff_id: firstStaffId || undefined,
          services: svcList.map(s => s.id)
        }));
        // Carry forward appointment location into job card/receipt
        const apptLoc = (appointment as any)?.location_id || '';
        if (apptLoc) setSelectedLocationId(apptLoc);
        return;
      }

      // Fallback to single service/staff on appointment if no rows
      const service = services.find(s => s.id === appointment.service_id) || null;
      if (service) setSelectedServices([service]);
      if (appointment.staff_id) setServiceStaffMap({ [service?.id as string]: appointment.staff_id });
      const fallbackStaff = staff.find(s => s.id === appointment.staff_id) || null;
      if (fallbackStaff) setSelectedStaff(fallbackStaff);

      setJobCardData(prev => ({
        ...prev,
        appointment_id: appointment.id,
        client_id: appointment.client_id || undefined,
        staff_id: appointment.staff_id || undefined,
        services: service ? [service.id] : []
      }));
    } catch (err) {
      console.error("Error loading appointment services:", err);
    }
  }, [appointments, clients, services, staff]);


  const loadServiceKits = useCallback(async () => {
    if (selectedServices.length === 0) return;
    
    try {
      const serviceIds = selectedServices.map(s => s.id);
      const { data, error } = await supabase
        .from("service_kits")
        .select(`
          *,
          inventory_items!service_kits_good_id_fkey (*)
        `)
        .in("service_id", serviceIds);

      if (error) throw error;
      setServiceKits(data || []);
      // Fetch availability for current kits at selected warehouse or by location fallback
      const itemIds = (data || []).map(k => k.good_id);
      if (itemIds.length > 0) {
        const { data: levels } = await supabase
          .from('inventory_levels')
          .select('item_id, quantity, warehouse_id, location_id')
          .in('item_id', itemIds)
          .or(`warehouse_id.eq.${selectedWarehouseId || 'null'},location_id.eq.${selectedLocationId || 'null'}`);
        const map: Record<string, number> = {};
        for (const row of (levels || [])) {
          map[row.item_id] = (map[row.item_id] || 0) + (row.quantity || 0);
        }
        setInventoryByItemId(map);
      } else {
        setInventoryByItemId({});
      }
      
      // Initialize product quantities
      const initialQuantities: { [key: string]: number } = {};
      data?.forEach(kit => {
        initialQuantities[kit.good_id] = (initialQuantities[kit.good_id] || 0) + (kit.default_quantity || 0);
      });
      setJobCardData(prev => ({ ...prev, products_used: initialQuantities }));
    } catch (error) {
      console.error("Error loading service kits:", error);
      toast.error("Failed to load service materials");
    }
  }, [selectedServices, selectedWarehouseId, selectedLocationId]);

  // When warehouse or location changes, refresh availability for current kits
  useEffect(() => {
    if (serviceKits.length > 0) {
      (async () => {
        const itemIds = serviceKits.map(k => k.good_id);
        const { data: levels } = await supabase
          .from('inventory_levels')
          .select('item_id, quantity, warehouse_id, location_id')
          .in('item_id', itemIds)
          .or(`warehouse_id.eq.${selectedWarehouseId || 'null'},location_id.eq.${selectedLocationId || 'null'}`);
        const map: Record<string, number> = {};
        for (const row of (levels || [])) {
          map[row.item_id] = (map[row.item_id] || 0) + (row.quantity || 0);
        }
        setInventoryByItemId(map);
      })();
    }
  }, [selectedWarehouseId, selectedLocationId, serviceKits]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Once initial data is loaded, if an appointment query param is present, prefill from it
  useEffect(() => {
    if (!loading && appointmentId) {
      // call async loader and ignore result
      loadAppointmentData(appointmentId);
    }
  }, [loading, appointmentId, loadAppointmentData]);

  // If a user selects an appointment in step 1 (no URL param), auto load its services and staff
  useEffect(() => {
    if (!loading && selectedAppointment?.id) {
      loadAppointmentData(selectedAppointment.id);
    }
  }, [loading, selectedAppointment, loadAppointmentData]);

  // Bridge to allow child step to set serviceStaffMap locally without prop drilling refactors
  useEffect(() => {
    (window as any).__setServiceStaffMap = (map: Record<string, string>) => {
      setServiceStaffMap(map);
    };
    // Expose current map for Step 2 initialization
    (window as any).__currentServiceStaffMap = serviceStaffMap;
    return () => {
      try {
        delete (window as any).__setServiceStaffMap;
        delete (window as any).__currentServiceStaffMap;
      } catch { /* ignore cleanup errors */ }
    };
  }, [serviceStaffMap]);

  useEffect(() => {
    // Calculate totals when services change
    const serviceCost = selectedServices.reduce((sum, service) => sum + service.price, 0);
    const duration = selectedServices.reduce((sum, service) => sum + service.duration_minutes, 0);
    
    setTotalCost(serviceCost);
    setTotalDuration(duration);
    setJobCardData(prev => ({ ...prev, service_charge: serviceCost }));
    // Ensure serviceStaffMap stays in sync with selected services
    setServiceStaffMap(prev => {
      const next: Record<string, string> = {};
      for (const s of selectedServices) {
        if (prev[s.id]) next[s.id] = prev[s.id];
      }
      return next;
    });
  }, [selectedServices]);

  useEffect(() => {
    // Load service kits when services change
    if (selectedServices.length > 0) {
      loadServiceKits();
    }
  }, [selectedServices, loadServiceKits]);


  const updateProductQuantity = (productId: string, quantity: number) => {
    setJobCardData(prev => ({
      ...prev,
      products_used: {
        ...prev.products_used,
        [productId]: quantity
      }
    }));
  };

  const calculateProductCosts = useCallback(() => {
    // Build a cost map per unique good to avoid double-counting when the same item
    // appears in multiple service kits
    const costsByGoodId: { [key: string]: number } = {};
    for (const kit of serviceKits) {
      if (costsByGoodId[kit.good_id] === undefined) {
        costsByGoodId[kit.good_id] = kit.inventory_items.cost_price || 0;
      }
    }
    let total = 0;
    for (const [goodId, quantity] of Object.entries(jobCardData.products_used)) {
      const unitCost = costsByGoodId[goodId] || 0;
      total += (quantity || 0) * unitCost;
    }
    setProductCosts(total);
  }, [serviceKits, jobCardData.products_used]);

  useEffect(() => {
    calculateProductCosts();
  }, [calculateProductCosts]);

  const generateJobNumber = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `JOB${year}${month}${day}${random}`;
  };

  const handleSubmit = async () => {
    if (!selectedClient || selectedServices.length === 0) {
      toast.error("Please complete all required fields");
      return;
    }
    if (!selectedLocationId) {
      toast.error("Location is required for Job cards");
      return;
    }

    // Validate that every selected service has a staff assigned
    const missingAssignments = selectedServices.filter(s => !serviceStaffMap[s.id]);
    if (missingAssignments.length > 0) {
      toast.error("Assign a staff member for each selected service");
      return;
    }

    if (jobCardData.payment_method === 'mpesa' && !(jobCardData.payment_transaction_number && jobCardData.payment_transaction_number.trim())) {
      toast.error("M-Pesa transaction number is required for M-Pesa payments");
      return;
    }

    setSaving(true);
    try {
      // Enforce stock availability when prevent_negative_stock is enabled
      try {
        const { data: orgRow } = await supabase.from('organizations').select('settings').eq('id', organization!.id).single();
        const settings = (orgRow as any)?.settings || {};
        const preventNeg = !!settings.prevent_negative_stock;
        if (preventNeg && Object.keys(jobCardData.products_used).length > 0) {
          const required = jobCardData.products_used;
          const ids = Object.keys(required);
          const { data: levels } = await supabase
            .from('inventory_levels')
            .select('item_id, quantity')
            .in('item_id', ids)
            .or(`warehouse_id.eq.${selectedWarehouseId || 'null'},location_id.eq.${selectedLocationId || 'null'}`);
          const have: Record<string, number> = {};
          for (const row of (levels || [])) have[row.item_id] = (have[row.item_id] || 0) + (row.quantity || 0);
          const shortages = ids.filter(id => (required[id] || 0) > (have[id] || 0));
          if (shortages.length > 0) {
            toast.error('Insufficient stock for selected kit items.');
            setSaving(false);
            return;
          }
        }
      } catch {}
      const now = new Date().toISOString();
      // Pick a primary staff for the job card (first assigned) for backward compatibility
      const primaryStaffId = serviceStaffMap[selectedServices[0].id];
      
      let jobCard: any = null;
      try {
        const res = await supabase
          .from("job_cards")
          .insert([{ 
            client_id: selectedClient.id,
            staff_id: primaryStaffId || null,
            start_time: jobCardData.start_time || now,
            end_time: jobCardData.end_time,
            total_amount: jobCardData.service_charge,
            status: jobCardData.end_time ? "completed" : "in_progress",
            location_id: selectedLocationId || null,
            organization_id: organization?.id || null,
          }])
          .select()
          .single();
        jobCard = res.data;
        if (res.error) throw res.error;
      } catch (insErr: any) {
        const message = String(insErr?.message || "");
        const code = (insErr as any)?.code || '';
        const schemaCacheMissingLocation = /schema cache/i.test(message) && /job_cards/i.test(message) && /location_id/i.test(message);
        const isMissingLocationCol = code === '42703' || /column\s+"?location_id"?\s+does not exist/i.test(message) || schemaCacheMissingLocation;
        const isUnknownColumn = code === '42703' || /column\s+"?[a-zA-Z0-9_]+"?\s+does not exist/i.test(message);

        if (isMissingLocationCol) {
          // Retry without location_id
          const res2 = await supabase
            .from("job_cards")
            .insert([{ 
              client_id: selectedClient.id,
              staff_id: primaryStaffId || null,
              start_time: jobCardData.start_time || now,
              end_time: jobCardData.end_time,
              total_amount: jobCardData.service_charge,
              status: jobCardData.end_time ? "completed" : "in_progress",
              organization_id: organization?.id || null,
            }])
            .select()
            .single();
          if (res2.error) throw res2.error;
          jobCard = res2.data;
        } else if (isUnknownColumn) {
          // Fallback to a minimal payload compatible with older schemas
          const resMin = await supabase
            .from("job_cards")
            .insert([{ 
              client_id: selectedClient.id,
              staff_id: primaryStaffId || null,
              start_time: jobCardData.start_time || now,
              status: jobCardData.end_time ? "completed" : "in_progress",
              organization_id: organization?.id || null,
            }])
            .select()
            .single();
          if (resMin.error) throw resMin.error;
          jobCard = resMin.data;
        } else {
          throw insErr;
        }
      }

      // Save service assignments to job_card_services
      if (selectedServices.length > 0) {
        try {
          const overrideMap: Record<string, number | null> = (window as any).__appointmentServiceCommission || {};
          const rows = selectedServices.map(svc => ({
            job_card_id: jobCard.id,
            service_id: svc.id,
            staff_id: serviceStaffMap[svc.id],
            quantity: 1,
            unit_price: svc.price,
            duration_minutes: svc.duration_minutes,
            commission_percentage: typeof overrideMap[svc.id] === 'number' ? overrideMap[svc.id] : (svc as any).commission_percentage ?? null,
            // Add commission calculation
            commission_amount: 0, // Will be calculated by the commission calculator
          }));
          const { error: jcsError } = await supabase.from("job_card_services").insert(rows as any);
          if (jcsError) throw jcsError;
        } catch (svcErr) {
          console.error('Failed to save job card services:', svcErr);
          toast.error('Job saved, but services could not be saved');
        }
      }

      // Save job card products
      if (Object.keys(jobCardData.products_used).length > 0) {
        try {
          const productEntries = Object.entries(jobCardData.products_used)
            .filter(([_, quantity]) => quantity > 0)
            .map(([productId, quantity]) => {
              const kit = serviceKits.find(k => k.good_id === productId);
              return {
                job_card_id: jobCard.id,
                inventory_item_id: productId,
                quantity_used: quantity,
                unit_cost: kit?.inventory_items.cost_price || 0,
                total_cost: quantity * (kit?.inventory_items.cost_price || 0)
              };
            });

          if (productEntries.length > 0) {
            const { error: productsError } = await supabase
              .from("job_card_products")
              .insert(productEntries);

            if (productsError) throw productsError;

            // Consume inventory after recording usage
            for (const entry of productEntries) {
              // Try warehouse-level consumption first
              if (selectedWarehouseId) {
                const { data: existingWh } = await supabase
                  .from('inventory_levels')
                  .select('id, quantity')
                  .eq('item_id', entry.inventory_item_id)
                  .eq('warehouse_id', selectedWarehouseId)
                  .limit(1)
                  .maybeSingle();
                if (existingWh) {
                  await supabase.from('inventory_levels').update({ quantity: (existingWh.quantity || 0) - entry.quantity_used }).eq('id', existingWh.id);
                  continue;
                }
              }
              // Fallback to location-level consumption
              const { data: existingLoc } = await supabase
                .from('inventory_levels')
                .select('id, quantity')
                .eq('item_id', entry.inventory_item_id)
                .eq('location_id', selectedLocationId)
                .limit(1)
                .maybeSingle();
              if (existingLoc) {
                await supabase.from('inventory_levels').update({ quantity: (existingLoc.quantity || 0) - entry.quantity_used }).eq('id', existingLoc.id);
              }
            }
          }
        } catch (prodErr) {
          console.error('Failed to save job card products:', prodErr);
          toast.error('Job saved, but products could not be saved');
        }
      }

      // After creating the job card and related rows, optionally create a receipt
      try {
        const finalTotal = (totalCost || 0) + (productCosts || 0);
        const shouldCreateReceipt = jobCardData.receipt_issued || !!jobCardData.payment_method;
        if (shouldCreateReceipt) {
          const nowDate = new Date();
          const y = nowDate.getFullYear().toString().slice(-2);
          const m = String(nowDate.getMonth() + 1).padStart(2, '0');
          const d = String(nowDate.getDate()).padStart(2, '0');
          const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
          const receiptNumber = `RCT-${y}${m}${d}-${rand}`;

          const { data: receipt, error: receiptError } = await supabase
            .from('receipts')
            .insert([
              {
                receipt_number: receiptNumber,
                customer_id: selectedClient?.id || null,
                job_card_id: jobCard.id,
                subtotal: finalTotal,
                tax_amount: 0,
                discount_amount: 0,
                total_amount: finalTotal,
                status: jobCardData.payment_method ? 'paid' : 'open',
                notes: `Receipt for ${jobNumber}`,
                location_id: selectedLocationId || null,
                organization_id: organization?.id || null,
              },
            ])
            .select('id')
            .single();

          if (receiptError) throw receiptError;

          // Build receipt items from selected services and assigned staff
          if (selectedServices.length > 0 && receipt?.id) {
            const itemsPayload = selectedServices.map((svc) => ({
              receipt_id: receipt.id,
              service_id: svc.id,
              product_id: null,
              description: svc.name || 'Service',
              quantity: 1,
              unit_price: svc.price || 0,
              total_price: svc.price || 0,
              staff_id: serviceStaffMap[svc.id] || null,
            }));

            const { error: itemsError } = await supabase
              .from('receipt_items')
              .insert(itemsPayload);
            if (itemsError) throw itemsError;
          }

          // Record full payment if a method is provided
          if (jobCardData.payment_method && receipt?.id) {
            const { error: payError } = await supabase
              .from('receipt_payments')
              .insert([
                {
                  receipt_id: receipt.id,
                  amount: finalTotal,
                  method: jobCardData.payment_method,
                  reference_number: jobCardData.payment_transaction_number || null,
                  location_id: selectedLocationId || null,
                },
              ]);
            if (payError) throw payError;
          }
        }
      } catch (receiptErr) {
        console.error('Failed to create receipt from job card:', receiptErr);
        toast.error('Job saved, but creating receipt failed');
      }

      toast.success("Job card created successfully!");
      navigate("/job-cards");
    } catch (error) {
      console.error("Error creating job card:", error);
      toast.error((error as any)?.message || "Failed to create job card");
    } finally {
      setSaving(false);
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceedToStep = (stepNumber: number) => {
    switch (stepNumber) {
      case 2:
        return selectedClient !== null;
      case 3:
        return selectedClient && selectedServices.length > 0 && selectedServices.every(s => !!serviceStaffMap[s.id]);
      case 4:
        return selectedClient && selectedServices.length > 0 && selectedServices.every(s => !!serviceStaffMap[s.id]);
      case 5:
        return selectedClient && selectedServices.length > 0 && selectedServices.every(s => !!serviceStaffMap[s.id]);
      default:
        return true;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto"></div>
          <p className="text-slate-600 font-medium">Loading job card form...</p>
        </div>
      </div>
    );
  }

  return (
    <FeatureGate feature="job_cards">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        {/* Header */}
        <div className="bg-background border-b border-border shadow-sm sticky top-0 z-40">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => navigate('/job-cards')}
                  className="hover:bg-slate-100"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Create New Job Card</h1>
                  <p className="text-slate-600">Track service delivery from start to finish</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-sm">
                  Step {currentStep} of {steps.length}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-56">
                  <Label className="text-xs">Location</Label>
                  <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                    <SelectTrigger>
                      <SelectValue placeholder={locations.length ? 'Select location' : 'No locations'} />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-56">
                  <Label className="text-xs">Warehouse</Label>
                  <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                    <SelectTrigger>
                      <SelectValue placeholder={warehouses.length ? 'Select warehouse' : 'No warehouses'} />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.filter(w => w.is_active).map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <Progress value={(currentStep / steps.length) * 100} className="h-2" />
            </div>

            {/* Step Indicators */}
            <div className="mt-6 flex justify-between">
              {steps.map((step, index) => {
                const isActive = step.id === currentStep;
                const isCompleted = step.id < currentStep;
                const canAccess = canProceedToStep(step.id);
                
                return (
                  <div key={step.id} className="flex flex-col items-center">
                    <div 
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                        isCompleted 
                          ? 'bg-emerald-500 border-emerald-500 text-white' 
                          : isActive 
                          ? 'bg-violet-600 border-violet-600 text-white' 
                          : canAccess
                          ? 'border-slate-300 text-slate-600 hover:border-violet-300'
                          : 'border-slate-200 text-slate-400'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <step.icon className="w-5 h-5" />
                      )}
                    </div>
                    <div className="mt-2 text-center">
                      <div className={`text-sm font-medium ${
                        isActive ? 'text-violet-600' : isCompleted ? 'text-emerald-600' : 'text-slate-600'
                      }`}>
                        {step.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 max-w-24">
                        {step.subtitle}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
          {currentStep === 1 && (
            <StepAppointmentClient
              appointments={appointments}
              clients={clients}
              selectedAppointment={selectedAppointment}
              selectedClient={selectedClient}
              onAppointmentSelect={setSelectedAppointment}
              onClientSelect={setSelectedClient}
              onNext={nextStep}
            />
          )}

          {currentStep === 2 && (
            <StepServicesStaff
              services={services}
              staff={staff}
              selectedServices={selectedServices}
              selectedStaff={selectedStaff}
              selectedClient={selectedClient}
              totalCost={totalCost}
              totalDuration={totalDuration}
              onServicesChange={setSelectedServices}
              onStaffSelect={setSelectedStaff}
              onNext={nextStep}
              onPrev={prevStep}
            />
          )}

          {currentStep === 3 && (
            <StepProductsMaterials
              serviceKits={serviceKits}
              productsUsed={jobCardData.products_used}
              productCosts={productCosts}
              onQuantityChange={updateProductQuantity}
              onNext={nextStep}
              onPrev={prevStep}
              selectedServices={selectedServices}
            />
          )}

          {currentStep === 4 && (
            <StepServiceCompletion
              jobCardData={jobCardData}
              selectedClient={selectedClient}
              selectedStaff={selectedStaff}
              selectedServices={selectedServices}
              onDataChange={(data) => setJobCardData(prev => ({ ...prev, ...data, services: prev.services }))}
              onNext={nextStep}
              onPrev={prevStep}
            />
          )}

          {currentStep === 5 && (
            <StepPaymentReceipt
              jobCardData={jobCardData}
              selectedClient={selectedClient}
              selectedStaff={selectedStaff}
              selectedServices={selectedServices}
              totalCost={totalCost}
              productCosts={productCosts}
              onDataChange={(data) => setJobCardData(prev => ({ ...prev, ...data, services: prev.services }))}
              onPrev={prevStep}
              onSubmit={handleSubmit}
              saving={saving}
            />
          )}
        </div>
      </div>
    </FeatureGate>
  );
}

// Step Components will be created next...
// I'll continue with the step components in the next part due to length constraints

// Step 1: Appointment & Client Selection
interface StepAppointmentClientProps {
  appointments: Appointment[];
  clients: Client[];
  selectedAppointment: Appointment | null;
  selectedClient: Client | null;
  onAppointmentSelect: (appointment: Appointment | null) => void;
  onClientSelect: (client: Client | null) => void;
  onNext: () => void;
}

function StepAppointmentClient({
  appointments,
  clients,
  selectedAppointment,
  selectedClient,
  onAppointmentSelect,
  onClientSelect,
  onNext
}: StepAppointmentClientProps) {
  const [showNewClient, setShowNewClient] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [appointmentFilter, setAppointmentFilter] = useState<'today' | 'upcoming' | 'all'>("today");
  const [appointmentSearch, setAppointmentSearch] = useState("");

  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone?.includes(searchTerm)
  );

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const filteredAppointments = appointments
    .filter(apt => {
      if (appointmentFilter === 'today') return apt.appointment_date === todayStr;
      if (appointmentFilter === 'upcoming') return apt.appointment_date > todayStr;
      return apt.appointment_date >= todayStr;
    })
    .filter(apt => {
      if (!appointmentSearch.trim()) return true;
      const client = clients.find(c => c.id === apt.client_id);
      const hay = `${client?.full_name || ''} ${apt.service_name || ''} ${apt.appointment_time || ''}`.toLowerCase();
      return hay.includes(appointmentSearch.toLowerCase());
    });

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Start Your Job Card</h2>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Begin by selecting an existing appointment or choose a client to create a new service job card
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Existing Appointments */}
        <Card className="shadow-lg border-slate-200">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Calendar className="w-5 h-5" />
              Appointments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex items-center gap-3 p-4 border-b">
              <Select value={appointmentFilter} onValueChange={(v) => setAppointmentFilter(v as any)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1">
                <Input
                  placeholder="Search appointments..."
                  value={appointmentSearch}
                  onChange={(e) => setAppointmentSearch(e.target.value)}
                />
              </div>
            </div>

            {filteredAppointments.length > 0 ? (
              <div className="space-y-2 p-4">
                {filteredAppointments.map((appointment) => {
                  const client = clients.find(c => c.id === appointment.client_id);
                  const isSelected = selectedAppointment?.id === appointment.id;
                  
                  return (
                    <div
                      key={appointment.id}
                      onClick={() => {
                        onAppointmentSelect(appointment);
                        if (client) onClientSelect(client);
                      }}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-slate-200 hover:border-blue-300 hover:bg-blue-25'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-blue-100 text-blue-600">
                              {client?.full_name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-slate-900">{client?.full_name || appointment.customer_name}</div>
                            <div className="text-sm text-slate-600">{appointment.appointment_date} • {appointment.appointment_time}</div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {appointment.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No appointments found</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client Selection */}
        <Card className="shadow-lg border-slate-200">
          <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 border-b">
            <CardTitle className="flex items-center gap-2 text-violet-800">
              <Users className="w-5 h-5" />
              Select Client
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="relative">
                <Input
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
                <User className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {filteredClients.map((client) => {
                  const isSelected = selectedClient?.id === client.id;
                  
                  return (
                    <div
                      key={client.id}
                      onClick={() => onClientSelect(client)}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                        isSelected 
                          ? 'border-violet-500 bg-violet-50' 
                          : 'border-slate-200 hover:border-violet-300 hover:bg-violet-25'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-violet-100 text-violet-600 text-sm">
                            {client.full_name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-900 truncate">{client.full_name}</div>
                          <div className="text-sm text-slate-600 flex items-center gap-3">
                            {client.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {client.phone}
                              </span>
                            )}
                            {client.total_visits && (
                              <span className="text-xs bg-slate-100 px-2 py-1 rounded">
                                {client.total_visits} visits
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selected Summary */}
      {selectedClient && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-emerald-900">Client Selected</h3>
                  <p className="text-emerald-700">{selectedClient.full_name}</p>
                  {selectedAppointment && (
                    <p className="text-sm text-emerald-600">
                      From appointment at {selectedAppointment.appointment_time}
                    </p>
                  )}
                </div>
              </div>
              <Button onClick={onNext} className="bg-emerald-600 hover:bg-emerald-700">
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Step 2: Services & Staff Selection
interface StepServicesStaffProps {
  services: Service[];
  staff: Staff[];
  selectedServices: Service[];
  selectedStaff: Staff | null;
  selectedClient: Client | null;
  totalCost: number;
  totalDuration: number;
  onServicesChange: (services: Service[]) => void;
  onStaffSelect: (staff: Staff | null) => void;
  onNext: () => void;
  onPrev: () => void;
}

function StepServicesStaff({
  services,
  staff,
  selectedServices,
  selectedStaff,
  selectedClient,
  totalCost,
  totalDuration,
  onServicesChange,
  onStaffSelect,
  onNext,
  onPrev
}: StepServicesStaffProps) {
  const [serviceSearch, setServiceSearch] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [localAssignments, setLocalAssignments] = useState<Record<string, string>>({});
  const { format: formatMoney } = useOrganizationCurrency();

  // Initialize local assignments from parent-provided map on first render or when selected services change
  useEffect(() => {
    // Pull initial map from parent state via global bridge if available, otherwise derive from selectedStaff
    const parentMap = (window as any).__currentServiceStaffMap as Record<string, string> | undefined;
    const initial: Record<string, string> = {};
    for (const svc of selectedServices) {
      if (parentMap && parentMap[svc.id]) {
        initial[svc.id] = parentMap[svc.id];
      } else if (selectedStaff) {
        initial[svc.id] = selectedStaff.id;
      }
    }
    setLocalAssignments(initial);
  }, [selectedServices, selectedStaff]);

  // Sync local assignments with outer state via window callback
  useEffect(() => {
    // This component will read and write via custom events to parent state
  }, []);

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
    service.category?.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  const filteredStaff = staff.filter(member =>
    member.full_name.toLowerCase().includes(staffSearch.toLowerCase()) ||
    member.specialties?.join(' ').toLowerCase().includes(staffSearch.toLowerCase())
  );

  const toggleService = (service: Service) => {
    const isSelected = selectedServices.some(s => s.id === service.id);
    if (isSelected) {
      onServicesChange(selectedServices.filter(s => s.id !== service.id));
    } else {
      onServicesChange([...selectedServices, service]);
    }
  };

  const canProceed = selectedServices.length > 0 && selectedServices.every(s => !!localAssignments[s.id]);

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Services & Staff Assignment</h2>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Select the services to be performed and assign the primary staff member
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Services Selection */}
        <Card className="shadow-lg border-slate-200">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <Scissors className="w-5 h-5" />
              Select Services
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="relative">
                <Input
                  placeholder="Search services..."
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  className="pl-10"
                />
                <Scissors className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              </div>

              <div className="max-h-80 overflow-y-auto space-y-3">
                {filteredServices.map((service) => {
                  const isSelected = selectedServices.some(s => s.id === service.id);
                  
                  return (
                    <div
                      key={service.id}
                      onClick={() => toggleService(service)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                        isSelected 
                          ? 'border-purple-500 bg-purple-50' 
                          : 'border-slate-200 hover:border-purple-300 hover:bg-purple-25'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isSelected ? 'bg-purple-500 border-purple-500' : 'border-slate-300'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{service.name}</div>
                              {service.description && (
                                <div className="text-sm text-slate-600 mt-1">{service.description}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-3 text-sm text-slate-600">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {service.duration_minutes} min
                            </div>
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-4 h-4" />
                              {formatMoney(service.price)}
                            </div>
                            {service.category && (
                              <Badge variant="outline" className="text-xs">
                                {service.category}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Staff Assignment per Service */}
        <Card className="shadow-lg border-slate-200">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b">
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <Users className="w-5 h-5" />
              Assign Staff to Selected Services
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-4">
              {selectedServices.length === 0 && (
                <div className="text-sm text-slate-500">Select at least one service on the left.</div>
              )}
              <div className="space-y-3">
                {selectedServices.map((svc) => (
                  <div key={svc.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{svc.name}</div>
                        <div className="text-xs text-slate-500">
                          {svc.duration_minutes} min • {formatMoney(svc.price)}
                        </div>
                      </div>
                      <div className="w-64">
                        <Select onValueChange={(value) => {
                          setLocalAssignments(prev => ({ ...prev, [svc.id]: value }));
                          // lift to parent via window dispatch (handled below in Continue click)
                        }} value={localAssignments[svc.id] || ""}>
                          <SelectTrigger>
                            <SelectValue placeholder="Assign staff" />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredStaff.map(member => (
                              <SelectItem key={member.id} value={member.id}>{member.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selection Summary */}
      {(selectedServices.length > 0 || selectedStaff) && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <h3 className="font-semibold text-blue-900 mb-4">Selection Summary</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label className="text-blue-800">Selected Services ({selectedServices.length})</Label>
                <div className="mt-2 space-y-1">
                  {selectedServices.map(service => (
                    <div key={service.id} className="text-sm text-blue-700">
                      {service.name} - {formatMoney(service.price)}
                      {localAssignments[service.id] && (
                        <span className="ml-2 text-xs text-blue-600">[
                          {staff.find(s => s.id === localAssignments[service.id])?.full_name}
                        ]</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-blue-800">Assigned Staff</Label>
                <div className="mt-2 text-sm text-blue-700">
                  {selectedServices.every(s => !!localAssignments[s.id]) ? 'All services assigned' : 'Pending assignments'}
                </div>
              </div>
              <div>
                <Label className="text-blue-800">Totals</Label>
                <div className="mt-2 space-y-1 text-sm text-blue-700">
                  <div>Duration: {totalDuration} minutes</div>
                  <div className="font-medium">Cost: {formatMoney(totalCost)}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        <Button 
          onClick={() => {
            // Lift local assignments up via a custom event the parent listens to by updating state directly
            // We cannot directly access setServiceStaffMap here; use window callback pattern
            (window as any).__setServiceStaffMap?.(localAssignments);
            onNext();
          }} 
          disabled={!canProceed}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// Step 3: Products & Materials
interface StepProductsMaterialsProps {
  serviceKits: ServiceKit[];
  productsUsed: { [key: string]: number };
  productCosts: number;
  onQuantityChange: (productId: string, quantity: number) => void;
  onNext: () => void;
  onPrev: () => void;
  selectedServices: Service[];
}

function StepProductsMaterials({
  serviceKits,
  productsUsed,
  productCosts,
  onQuantityChange,
  onNext,
  onPrev,
  selectedServices
}: StepProductsMaterialsProps) {
  const { format: formatMoney } = useOrganizationCurrency();
  const kitsByService = useMemo(() => {
    const map: Record<string, ServiceKit[]> = {};
    for (const kit of serviceKits) {
      if (!map[kit.service_id]) map[kit.service_id] = [];
      map[kit.service_id].push(kit);
    }
    return map;
  }, [serviceKits]);
  const servicesWithKits = useMemo(() => selectedServices.filter(svc => (kitsByService[svc.id] || []).length > 0), [selectedServices, kitsByService]);
  const showTabs = servicesWithKits.length > 1;
  const defaultTab = servicesWithKits[0]?.id || selectedServices[0]?.id;
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Products & Materials</h2>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Track the products and materials used during the service
        </p>
      </div>

      {serviceKits.length > 0 ? (
        <Card className="shadow-lg border-slate-200">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Package className="w-5 h-5" />
              Service Materials
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {showTabs ? (
              <Tabs defaultValue={defaultTab} className="space-y-6">
                <TabsList className="h-12 gap-2 p-2">
                  {servicesWithKits.map((svc) => (
                    <TabsTrigger key={svc.id} value={svc.id} className="px-6 py-3 text-base md:text-lg">{svc.name}</TabsTrigger>
                  ))}
                </TabsList>
                {servicesWithKits.map((svc) => {
                  const kits = kitsByService[svc.id] || [];
                  return (
                    <TabsContent key={svc.id} value={svc.id} className="space-y-4">
                      {kits.map((kit) => {
                        const quantity = productsUsed[kit.good_id] || kit.default_quantity || 0;
                        const totalItemCost = quantity * (kit.inventory_items.cost_price || 0);
                        const availableQty = inventoryByItemId[kit.good_id] ?? 0;
                        return (
                          <div key={kit.id} className="border border-border rounded-lg p-4 bg-card">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                    <Package className="w-5 h-5 text-green-600" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-slate-900">{kit.inventory_items.name}</div>
                                    <div className="text-sm text-slate-600">
                                      {kit.inventory_items.type} • {formatMoney(kit.inventory_items.cost_price)} per {kit.inventory_items.unit || 'unit'}
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-4 grid grid-cols-3 gap-4">
                                  <div>
                                    <Label className="text-sm text-slate-600">Default Quantity</Label>
                                    <div className="text-sm font-medium">{kit.default_quantity}</div>
                                  </div>
                                  <div>
                                    <Label className="text-sm text-slate-600">Available</Label>
                                    <div className={`text-sm font-medium ${availableQty <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>{availableQty}</div>
                                  </div>
                                  <div>
                                    <Label className="text-sm text-slate-600">Quantity Used</Label>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => onQuantityChange(kit.good_id, Math.max(0, quantity - 1))}
                                      >
                                        <Minus className="w-3 h-3" />
                                      </Button>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={quantity}
                                        onChange={(e) => onQuantityChange(kit.good_id, parseFloat(e.target.value) || 0)}
                                        className="w-20 text-center"
                                      />
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => onQuantityChange(kit.good_id, quantity + 1)}
                                      >
                                        <Plus className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  <div>
                                    <Label className="text-sm text-slate-600">Total Cost</Label>
                                    <div className="text-sm font-medium text-green-600">
                                      {formatMoney(totalItemCost)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </TabsContent>
                  );
                })}
              </Tabs>
            ) : (
              <div className="space-y-6">
                {selectedServices.map((svc) => {
                  const kits = kitsByService[svc.id] || [];
                  if (kits.length === 0) return null;
                  return (
                    <div key={svc.id} className="space-y-4">
                      <div className="text-base font-semibold text-slate-900">{svc.name}</div>
                      <div className="space-y-4">
                        {kits.map((kit) => {
                          const quantity = productsUsed[kit.good_id] || kit.default_quantity || 0;
                          const totalItemCost = quantity * (kit.inventory_items.cost_price || 0);
                          const availableQty = inventoryByItemId[kit.good_id] ?? 0;
                          return (
                            <div key={kit.id} className="border border-border rounded-lg p-4 bg-card">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                      <Package className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div>
                                      <div className="font-medium text-slate-900">{kit.inventory_items.name}</div>
                                      <div className="text-sm text-slate-600">
                                        {kit.inventory_items.type} • {formatMoney(kit.inventory_items.cost_price)} per {kit.inventory_items.unit || 'unit'}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="mt-4 grid grid-cols-3 gap-4">
                                    <div>
                                      <Label className="text-sm text-slate-600">Default Quantity</Label>
                                      <div className="text-sm font-medium">{kit.default_quantity}</div>
                                    </div>
                                    <div>
                                      <Label className="text-sm text-slate-600">Available</Label>
                                      <div className={`text-sm font-medium ${availableQty <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>{availableQty}</div>
                                    </div>
                                    <div>
                                      <Label className="text-sm text-slate-600">Quantity Used</Label>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => onQuantityChange(kit.good_id, Math.max(0, quantity - 1))}
                                        >
                                          <Minus className="w-3 h-3" />
                                        </Button>
                                        <Input
                                          type="number"
                                          min="0"
                                          step="0.1"
                                          value={quantity}
                                          onChange={(e) => onQuantityChange(kit.good_id, parseFloat(e.target.value) || 0)}
                                          className="w-20 text-center"
                                        />
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => onQuantityChange(kit.good_id, quantity + 1)}
                                        >
                                          <Plus className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </div>
                                    <div>
                                      <Label className="text-sm text-slate-600">Total Cost</Label>
                                      <div className="text-sm font-medium text-green-600">
                                        {formatMoney(totalItemCost)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <Separator className="my-6" />
            <div className="flex justify-between items-center">
              <div className="text-lg font-semibold text-slate-900">
                Total Materials Cost
              </div>
              <div className="text-xl font-bold text-green-600">
                {formatMoney(productCosts)}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg border-slate-200">
          <CardContent className="p-12 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-slate-400" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No Service Kits Configured</h3>
            <p className="text-slate-600">
              No products or materials are configured for the selected services.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        <Button onClick={onNext} className="bg-green-600 hover:bg-green-700">
          Continue
        </Button>
      </div>
    </div>
  );
}

// Step 4: Service Completion
interface StepServiceCompletionProps {
  jobCardData: JobCardData;
  selectedClient: Client | null;
  selectedStaff: Staff | null;
  selectedServices: Service[];
  onDataChange: (data: Partial<JobCardData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

function StepServiceCompletion({
  jobCardData,
  selectedClient,
  selectedStaff,
  selectedServices,
  onDataChange,
  onNext,
  onPrev
}: StepServiceCompletionProps) {
  const [startTime, setStartTime] = useState(
    jobCardData.start_time || new Date().toISOString().slice(0, 16)
  );
  const [endTime, setEndTime] = useState(
    jobCardData.end_time || ""
  );

  const handleStartTimeChange = (time: string) => {
    setStartTime(time);
    onDataChange({ start_time: new Date(time).toISOString() });
  };

  const handleEndTimeChange = (time: string) => {
    setEndTime(time);
    onDataChange({ end_time: time ? new Date(time).toISOString() : undefined });
  };

  const markAsCompleted = () => {
    const now = new Date().toISOString().slice(0, 16);
    setEndTime(now);
    onDataChange({ end_time: new Date(now).toISOString() });
  };

  const totalDuration = selectedServices.reduce((sum, service) => sum + service.duration_minutes, 0);
  const estimatedEndTime = startTime ? addMinutes(new Date(startTime), totalDuration) : null;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Service Completion</h2>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Record service details, timing, and client feedback
        </p>
      </div>

      <div className="grid gap-8">
        {/* Service Timing */}
        <Card className="shadow-lg border-slate-200">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Timer className="w-5 h-5" />
              Service Timing
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="end-time">End Time</Label>
                  {!endTime && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={markAsCompleted}
                      className="text-xs"
                    >
                      Mark as Completed Now
                    </Button>
                  )}
                </div>
                <Input
                  id="end-time"
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => handleEndTimeChange(e.target.value)}
                />
                {estimatedEndTime && !endTime && (
                  <p className="text-xs text-slate-500">
                    Estimated completion: {format(estimatedEndTime, 'h:mm a')}
                  </p>
                )}
              </div>
            </div>
            
            {endTime && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-medium">Service Completed</span>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  Duration: {Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60))} minutes
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Service Notes */}
        <Card className="shadow-lg border-slate-200">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <Edit3 className="w-5 h-5" />
              Service Notes & Observations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Textarea
              placeholder="Record any observations, techniques used, client preferences, or special notes about the service..."
              value={jobCardData.notes || ""}
              onChange={(e) => onDataChange({ notes: e.target.value })}
              className="min-h-32"
            />
          </CardContent>
        </Card>

        {/* Client Feedback */}
        <Card className="shadow-lg border-slate-200">
          <CardHeader className="bg-gradient-to-r from-yellow-50 to-orange-50 border-b">
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <Star className="w-5 h-5" />
              Client Satisfaction
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Label className="text-base font-medium">How satisfied was the client with the service?</Label>
              <RadioGroup
                value={jobCardData.client_feedback || ""}
                onValueChange={(value) => onDataChange({ client_feedback: value })}
              >
                <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50">
                  <RadioGroupItem value="extremely-satisfied" />
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <Label>Extremely Satisfied</Label>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50">
                  <RadioGroupItem value="satisfied" />
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1,2,3,4].map(i => (
                        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      ))}
                      <Star className="w-4 h-4 text-slate-300" />
                    </div>
                    <Label>Satisfied</Label>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50">
                  <RadioGroupItem value="neutral" />
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1,2,3].map(i => (
                        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      ))}
                      {[4,5].map(i => (
                        <Star key={i} className="w-4 h-4 text-slate-300" />
                      ))}
                    </div>
                    <Label>Neutral</Label>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50">
                  <RadioGroupItem value="unsatisfied" />
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1,2].map(i => (
                        <Star key={i} className="w-4 h-4 fill-red-400 text-red-400" />
                      ))}
                      {[3,4,5].map(i => (
                        <Star key={i} className="w-4 h-4 text-slate-300" />
                      ))}
                    </div>
                    <Label>Unsatisfied</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        <Button onClick={onNext} className="bg-purple-600 hover:bg-purple-700">
          Continue to Payment
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// Step 5: Payment & Receipt
interface StepPaymentReceiptProps {
  jobCardData: JobCardData;
  selectedClient: Client | null;
  selectedStaff: Staff | null;
  selectedServices: Service[];
  totalCost: number;
  productCosts: number;
  onDataChange: (data: Partial<JobCardData>) => void;
  onPrev: () => void;
  onSubmit: () => void;
  saving: boolean;
}

function StepPaymentReceipt({
  jobCardData,
  selectedClient,
  selectedStaff,
  selectedServices,
  totalCost,
  productCosts,
  onDataChange,
  onPrev,
  onSubmit,
  saving
}: StepPaymentReceiptProps) {
  const { format: formatMoney } = useOrganizationCurrency();
  const finalTotal = totalCost + productCosts;
  const staffCommission = selectedStaff?.commission_rate ? 
    (totalCost * (selectedStaff.commission_rate / 100)) : 0;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Payment & Receipt</h2>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Finalize payment details and complete the job card
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Payment Details */}
        <Card className="shadow-lg border-slate-200">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CreditCard className="w-5 h-5" />
              Payment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="service-charge">Service Charge</Label>
              <Input
                id="service-charge"
                type="number"
                step="0.01"
                value={jobCardData.service_charge}
                onChange={(e) => onDataChange({ service_charge: parseFloat(e.target.value) || 0 })}
                className="text-lg font-medium"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-method">Payment Method</Label>
              <Select 
                value={jobCardData.payment_method || ""} 
                onValueChange={(value) => onDataChange({ payment_method: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Cash
                    </div>
                  </SelectItem>
                  <SelectItem value="mpesa">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      M-Pesa
                    </div>
                  </SelectItem>
                  <SelectItem value="card">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Card
                    </div>
                  </SelectItem>
                  <SelectItem value="bank_transfer">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Bank Transfer
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {jobCardData.payment_method === 'mpesa' && (
              <div className="space-y-2">
                <Label htmlFor="mpesa-txn">M-Pesa Transaction Number<span className="text-red-500">*</span></Label>
                <Input
                  id="mpesa-txn"
                  placeholder="e.g. QFG3XXXXXX"
                  value={jobCardData.payment_transaction_number || ""}
                  onChange={(e) => onDataChange({ payment_transaction_number: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Required when paying via M-Pesa</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="receipt-issued"
                  checked={jobCardData.receipt_issued}
                  onCheckedChange={(checked) => onDataChange({ receipt_issued: !!checked })}
                />
                <Label htmlFor="receipt-issued">Receipt Issued</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="next-appointment"
                  checked={jobCardData.next_appointment}
                  onCheckedChange={(checked) => onDataChange({ next_appointment: !!checked })}
                />
                <Label htmlFor="next-appointment">Next Appointment Scheduled</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Job Card Summary */}
        <Card className="shadow-lg border-slate-200">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <FileText className="w-5 h-5" />
              Job Card Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Client Info */}
              <div>
                <Label className="text-sm font-medium text-slate-600">Client</Label>
                <div className="flex items-center gap-3 mt-2">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-blue-100 text-blue-600">
                      {selectedClient?.full_name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{selectedClient?.full_name}</div>
                    <div className="text-sm text-slate-600">{selectedClient?.phone}</div>
                  </div>
                </div>
              </div>

              {/* Staff Info */}
              <div>
                <Label className="text-sm font-medium text-slate-600">Staff Member</Label>
                <div className="flex items-center gap-3 mt-2">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={selectedStaff?.profile_image} />
                    <AvatarFallback className="bg-orange-100 text-orange-600">
                      {selectedStaff?.full_name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{selectedStaff?.full_name}</div>
                    {selectedStaff?.commission_rate && (
                      <div className="text-sm text-slate-600">
                        Commission: {formatMoney(staffCommission)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Services */}
              <div>
                <Label className="text-sm font-medium text-slate-600">Services</Label>
                <div className="mt-2 space-y-2">
                  {selectedServices.map(service => (
                    <div key={service.id} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                      <span className="text-sm">{service.name}</span>
                      <span className="text-sm font-medium">{formatMoney(service.price)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between text-sm font-bold">
                  <span>Services Total:</span>
                  <span>{formatMoney(totalCost)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span>Material Cost:</span>
                  <span>{formatMoney(productCosts)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Final Actions */}
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-emerald-900">Ready to Complete</h3>
                <p className="text-emerald-700">Review all details and create the job card</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onPrev}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
              <Button 
                onClick={onSubmit} 
                disabled={saving || (jobCardData.payment_method === 'mpesa' && !(jobCardData.payment_transaction_number && jobCardData.payment_transaction_number.trim()))}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Complete Job Card
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Users, Receipt, Trash2, Plus, Printer, ChevronDown, AlertCircle } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createInvoiceWithFallback } from "@/utils/mockDatabase";
import { useOrganizationCurrency, useOrganizationTaxRate, useOrganization } from "@/lib/saas/hooks";
import { useTransactionNumbers } from "@/hooks/useTransactionNumbers";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { recordInvoicePaymentWithFallback } from "@/utils/mockDatabase";
import { useRegionalSettings } from "@/hooks/useRegionalSettings";
// import { formatCurrency as formatCurrencyWithSeparators, formatNumber } from "@/lib/currencyUtils";


interface Customer { id: string; full_name: string; email: string | null; phone: string | null }
interface Service { id: string; name: string; price: number; commission_percentage?: number }
interface Staff { id: string; full_name: string; commission_rate?: number }

export default function InvoiceCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { symbol } = useOrganizationCurrency();
  const { taxRate: orgTaxRate, taxEnabled } = useOrganizationTaxRate() as any;
  const { organization } = useOrganization();
  const { getNextNumber } = useTransactionNumbers();
  const { formatCurrency: formatRegionalCurrency, settings: regionalSettings } = useRegionalSettings();

  const persistKeyCustomer = useMemo(() => (
    organization?.id ? `invoice_customer_persist_v1_${organization.id}` : null
  ), [organization?.id]);
  const persistKeyCustomerGlobal = 'invoice_customer_persist_v1__global';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [jobCards, setJobCards] = useState<Array<{ id: string; job_card_number: string; client_name?: string; total_amount: number }>>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string; is_default?: boolean; is_active?: boolean }>>([]);
  const [defaultLocationIdForUser, setDefaultLocationIdForUser] = useState<string | null>(null);
  const [customerJobCards, setCustomerJobCards] = useState<Array<{ id: string; job_card_number: string; total_amount: number }>>([]);
  const [filteredJobCards, setFilteredJobCards] = useState<Array<{ id: string; job_card_number: string; client_name?: string; total_amount: number }>>([]);
  const [selectedJobCardInfo, setSelectedJobCardInfo] = useState<{
    id: string;
    job_card_number: string;
    client_name?: string;
    total_amount: number;
    service_count?: number;
  } | null>(null);

  // Unique locations by name (prefer default when duplicates exist)
  const uniqueLocations = useMemo(() => {
    const map = new Map<string, { id: string; name: string; is_default?: boolean; is_active?: boolean }>();
    for (const loc of locations) {
      const key = (loc.name || "").trim().toLowerCase();
      const existing = map.get(key);
      if (!existing) {
        map.set(key, loc);
      } else if (loc.is_default && !existing.is_default) {
        map.set(key, loc);
      }
    }
    return Array.from(map.values());
  }, [locations]);

  const [formData, setFormData] = useState({
    customer_id: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    due_date: "", // Leave blank; do not prefill
    payment_method: "",
    notes: "",
    jobcard_id: "",
    jobcard_reference: "",
    location_id: "", // Don't prefill location
  });
  const jobcardRequired = Boolean(((organization as any)?.settings || {})?.jobcard_required_on_invoice);

  const persistCustomerDetails = () => {
    try {
      const payload = {
        customer_id: formData.customer_id || "",
        customer_name: formData.customer_name || "",
        customer_email: formData.customer_email || "",
        customer_phone: formData.customer_phone || "",
      };
      const hasAny = payload.customer_id || payload.customer_name || payload.customer_email || payload.customer_phone;
      if (!hasAny) return;
      // Always write global fallback
      localStorage.setItem(persistKeyCustomerGlobal, JSON.stringify(payload));
      // Also write org-specific when available
      if (persistKeyCustomer) {
        localStorage.setItem(persistKeyCustomer, JSON.stringify(payload));
      }
    } catch {}
  };

  const [newItem, setNewItem] = useState({
    service_id: "",
    description: "",
    quantity: 1,
    unit_price: "",
    discount_percentage: 0,
    staff_id: "",
    commission_percentage: 0,
  });

  // Initialize invoice date (using due_date field as Invoice Date) to today if empty
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      due_date: prev.due_date || new Date().toISOString().slice(0, 10),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load last used Bill To details (persisted) on mount/org change
  useEffect(() => {
    try {
      const readJson = (key: string | null) => {
        if (!key) return null;
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      };
      const persisted = readJson(persistKeyCustomer) || readJson(persistKeyCustomerGlobal);
      if (persisted) {
        setFormData(prev => ({
          ...prev,
          customer_id: prev.customer_id || persisted.customer_id || "",
          customer_name: prev.customer_name || persisted.customer_name || "",
          customer_email: prev.customer_email || persisted.customer_email || "",
          customer_phone: prev.customer_phone || persisted.customer_phone || "",
        }));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistKeyCustomer]);

  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [applyTax, setApplyTax] = useState<boolean>(false);
  const [receivedPayment, setReceivedPayment] = useState<boolean>(false);
  const [depositAccounts, setDepositAccounts] = useState<Array<{ id: string; account_code: string; account_name: string; account_subtype?: string | null }>>([]);
  const [paymentData, setPaymentData] = useState<{ method: string; account_id: string; reference: string; amount: string }>({ method: "", account_id: "", reference: "", amount: "" });

  const prevAccountForMethod = (method: string, options: Array<{ id: string; account_code: string; account_name: string; account_subtype?: string | null }>): string => {
    const m = (method || '').toLowerCase();
    if (m === 'cash') return options.find(o => (o.account_subtype || '').toLowerCase() === 'cash')?.id || '';
    if (m === 'card') return options.find(o => (o.account_subtype || '').toLowerCase() === 'bank')?.id || '';
    if (m === 'bank_transfer') return options.find(o => (o.account_subtype || '').toLowerCase() === 'bank')?.id || '';
    if (m === 'mpesa') return options.find(o => (o.account_name || '').toLowerCase().includes('mpesa') || (o.account_name || '').toLowerCase().includes('mobile'))?.id || '';
    return '';
  };
  

  useEffect(() => {
    (async () => {
      try {
        const [{ data: cust }, { data: svc }, { data: stf }, { data: jc }] = await Promise.all([
          supabase.from("clients").select("id, full_name, email, phone").eq("is_active", true).order("full_name"),
          supabase.from("services").select("id, name, price, commission_percentage").eq("is_active", true).eq('organization_id', organization?.id || '').order("name"),
          supabase.from("staff").select("id, full_name, commission_rate").eq("is_active", true).eq('organization_id', organization?.id || '').order("full_name"),
          supabase.from("job_cards")
            .select(`
              id, 
              job_card_number, 
              total_amount,
              clients(full_name)
            `)
            .eq('organization_id', organization?.id || '')
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
        ]);
        setCustomers(cust || []);
        setServices(svc || []);
        setStaff(stf || []);
        setJobCards((jc || []).map((jc: any) => ({
          id: jc.id,
          job_card_number: jc.job_card_number,
          client_name: jc.clients?.full_name,
          total_amount: jc.total_amount
        })));
      } catch {}
    })();
  }, [organization?.id]);


  // Auto-persist customer details when they change (only when non-empty)
  useEffect(() => {
    const hasAny = formData.customer_id || formData.customer_name || formData.customer_email || formData.customer_phone;
    if (!hasAny) return;
    persistCustomerDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.customer_id, formData.customer_name, formData.customer_email, formData.customer_phone, persistKeyCustomer]);

  // Ensure tax is off when tax is disabled in settings; otherwise leave as chosen by user
  useEffect(() => {
    if (taxEnabled === false) {
      setApplyTax(false);
    }
  }, [taxEnabled]);

  // Load deposit accounts for payment details card
  useEffect(() => {
    (async () => {
      try {
        if (!organization?.id) { setDepositAccounts([]); return; }
        const { data, error } = await supabase
          .from('accounts')
          .select('id, account_code, account_name, account_subtype, account_type')
          .eq('organization_id', organization.id)
          .eq('account_type', 'Asset')
          .in('account_subtype', ['Cash', 'Bank'])
          .order('account_code', { ascending: true });
        if (error) throw error;
        const opts = (data || []).map((a: any) => ({ id: a.id, account_code: a.account_code, account_name: a.account_name, account_subtype: a.account_subtype }));
        setDepositAccounts(opts);
      } catch {
        setDepositAccounts([]);
      }
    })();
  }, [organization?.id]);

  const fetchLocations = async () => {
    try {
      const { data } = await supabase
        .from("business_locations")
        .select("id, name, is_default, is_active")
        .eq('organization_id', organization?.id || '')
        .order("name");
      const active = (data || []).filter((l: any) => l.is_active !== false);
      setLocations(active as any);
    } catch (error) {
      console.warn("Failed to fetch business_locations", error);
      setLocations([]);
    }
  };

  // Resolve default location for current user via staff_default_locations
  const resolveUserDefaultLocation = async () => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const email = userRes.user?.email || null;
      if (!email) return null;
      const { data: staffRow } = await supabase.from("staff").select("id, email").eq("email", email).maybeSingle();
      const staffId = (staffRow as any)?.id as string | undefined;
      if (!staffId) return null;
      const { data: mapping } = await supabase.from("staff_default_locations").select("location_id").eq("staff_id", staffId).maybeSingle();
      return ((mapping as any)?.location_id as string | undefined) || null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    fetchLocations();
    (async () => {
      const locId = await resolveUserDefaultLocation();
      setDefaultLocationIdForUser(locId);
    })();
  }, [organization?.id]);

  // Don't automatically prefill location - let user select

  // Ensure selected location exists after deduping
  useEffect(() => {
    if (!formData.location_id) return;
    if (uniqueLocations.every(l => l.id !== formData.location_id)) {
      const fallback = uniqueLocations[0]?.id || "";
      if (fallback) setFormData(prev => ({ ...prev, location_id: fallback }));
    }
  }, [uniqueLocations, formData.location_id]);

  // Filter job cards based on selected customer
  useEffect(() => {
    if (formData.customer_id) {
      // Filter job cards to show only those belonging to the selected customer
      const filtered = jobCards.filter(jc => {
        // Find the job card's client_id
        return customerJobCards.some(cjc => cjc.id === jc.id);
      });
      setFilteredJobCards(filtered.length > 0 ? filtered : customerJobCards.map(cjc => {
        const fullJc = jobCards.find(jc => jc.id === cjc.id);
        return fullJc || { ...cjc, client_name: undefined };
      }));
    } else {
      // Show all job cards when no customer is selected
      setFilteredJobCards(jobCards);
    }
  }, [formData.customer_id, jobCards, customerJobCards]);

  // Ensure Bill To details always mirror the selected customer's defaults
  useEffect(() => {
    if (!formData.customer_id) return;
    const selected = customers.find(c => c.id === formData.customer_id);
    if (!selected) return;
    const nextEmail = selected.email || "";
    const nextPhone = selected.phone || "";
    if (
      formData.customer_name !== selected.full_name ||
      formData.customer_email !== nextEmail ||
      formData.customer_phone !== nextPhone
    ) {
      setFormData(prev => ({
        ...prev,
        customer_name: selected.full_name,
        customer_email: nextEmail,
        customer_phone: nextPhone,
      }));
    }
  }, [formData.customer_id, customers, formData.customer_name, formData.customer_email, formData.customer_phone]);

  // Do not auto-prefill from URL parameters; all selections should be user-initiated

  

  const calculateTotals = useMemo(() => {
    return () => {
      const subtotal = selectedItems.reduce((sum, item: any) => Number(sum) + (Number(item.total_price) || 0), 0);
      const canApply = taxEnabled !== false && applyTax;
      const taxAmount = canApply ? Number(subtotal) * ((Number(orgTaxRate) || 0) / 100) : 0;
      const total = Number(subtotal) + Number(taxAmount);
      return { subtotal, taxAmount, total };
    };
  }, [selectedItems, applyTax, orgTaxRate]);

  const addItemToInvoice = () => {
    if (!newItem.service_id || !newItem.staff_id || !newItem.description || !newItem.unit_price) {
      toast.error("Service and Staff are mandatory fields");
      return;
    }
    const unit = parseFloat(newItem.unit_price) || 0;
    const totalPrice = Number((newItem.quantity * unit * (1 - (newItem.discount_percentage / 100))).toFixed(2));
    const item: any = {
      id: `temp-${Date.now()}`,
      invoice_id: "",
      product_id: newItem.service_id,
      service_id: newItem.service_id,
      description: newItem.description,
      quantity: newItem.quantity,
      unit_price: unit,
      discount_percentage: newItem.discount_percentage || 0,
      staff_id: newItem.staff_id || "",
      commission_percentage: Number(newItem.commission_percentage || 0),
      total_price: totalPrice,
    };
    setSelectedItems(prev => [...prev, item]);
    setNewItem({ service_id: "", description: "", quantity: 1, unit_price: "", discount_percentage: 0, staff_id: "", commission_percentage: 0 });
  };

  const removeItemFromInvoice = (idx: number) => setSelectedItems(selectedItems.filter((_, i) => i !== idx));

  const handleJobCardSelection = async (jobCardId: string) => {
    if (!jobCardId) return;
    
    try {
      // Prefill and lock customer from selected job card
      try {
        const { data: jcRow } = await supabase
          .from('job_cards')
          .select('id, client_id, clients:client_id ( id, full_name, email, phone )')
          .eq('id', jobCardId)
          .maybeSingle();
        if (jcRow) {
          const cli = (jcRow as any).clients;
          if (cli?.id) {
            setCustomers(prev => (prev.some(c => c.id === cli.id) ? prev : [...prev, { id: cli.id, full_name: cli.full_name, email: cli.email, phone: cli.phone }]));
          }
          setFormData(prev => ({
            ...prev,
            customer_id: (jcRow as any).client_id || prev.customer_id,
            customer_name: prev.customer_name || cli?.full_name || '',
            customer_email: prev.customer_email || cli?.email || '',
            customer_phone: prev.customer_phone || cli?.phone || '',
            jobcard_id: jobCardId,
          }));
        }
      } catch {}

      // Fetch job card services with their details
      const { data: jobCardServices, error } = await supabase
        .from('job_card_services')
        .select(`
          id,
          service_id,
          staff_id,
          quantity,
          unit_price,
          commission_percentage,
          commission_amount,
          services(id, name),
          staff(id, full_name)
        `)
        .eq('job_card_id', jobCardId);

      if (error) throw error;

      if (jobCardServices && jobCardServices.length > 0) {
        // Clear existing items and add job card services
        const invoiceItems = jobCardServices.map((jcs: any) => ({
          id: `jobcard-${jcs.id}`,
          invoice_id: "",
          product_id: jcs.service_id,
          service_id: jcs.service_id,
          description: jcs.services?.name || 'Service',
          quantity: jcs.quantity || 1,
          unit_price: jcs.unit_price || 0,
          discount_percentage: 0,
          staff_id: jcs.staff_id || "",
          commission_percentage: jcs.commission_percentage || 0,
          total_price: (jcs.quantity || 1) * (jcs.unit_price || 0),
        }));

        setSelectedItems(invoiceItems);
        // Update selected job card summary info for sidebar card
        const basic = jobCards.find(jc => jc.id === jobCardId) || null;
        if (basic) {
          setSelectedJobCardInfo({ ...basic, service_count: jobCardServices.length });
        } else {
          setSelectedJobCardInfo(null);
        }
        toast.success(`Added ${invoiceItems.length} service(s) from job card`);
      } else {
        toast.info("No services found for this job card");
      }
    } catch (error) {
      console.error("Error loading job card services:", error);
      toast.error("Failed to load job card services");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!organization?.id) {
      toast.error('Organization not loaded. Please refresh and try again.');
      return;
    }
    
    // Verify user has organization access
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated. Please log in and try again.');
        return;
      }
      
      const { data: orgUser, error: orgError } = await supabase
        .from('organization_users')
        .select('*')
        .eq('user_id', user.id)
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .single();
        
      if (orgError || !orgUser) {
        console.error('Organization access check failed:', orgError);
        toast.error('You do not have access to create invoices for this organization.');
        return;
      }
      
      console.log('User organization access verified:', orgUser);
    } catch (error) {
      console.error('Error checking organization access:', error);
      toast.error('Failed to verify organization access.');
      return;
    }
    if (!formData.customer_name.trim()) return toast.error('Customer name is mandatory');
    if (selectedItems.length === 0) return toast.error('Please add at least one item to the invoice');
    if (!formData.location_id) return toast.error('Please select a location');
    if (!formData.due_date) return toast.error('Invoice date is required');
    // Enforce invoice customer equals job card customer when a job card is selected
    if (formData.jobcard_reference) {
      try {
        const { data: jcMin } = await supabase
          .from('job_cards')
          .select('id, client_id')
          .eq('id', formData.jobcard_reference)
          .maybeSingle();
        const jobCustomerId = (jcMin as any)?.client_id || '';
        if (jobCustomerId && formData.customer_id && jobCustomerId !== formData.customer_id) {
          toast.error('Selected Job Card belongs to a different customer');
          return;
        }
        // If customer_id is empty, adopt job card customer
        if (!formData.customer_id && jobCustomerId) {
          setFormData(prev => ({ ...prev, customer_id: jobCustomerId }));
        }
      } catch {}
    }
    try {
      // Generate next invoice number from configured series
      const invoiceNumber = await getNextNumber('invoice');
      const totals = calculateTotals();
      // Always use selected customer's default bill-to details when a customer is selected
      const selectedCustomer = formData.customer_id ? customers.find(c => c.id === formData.customer_id) : null;
      const customerNameForInvoice = selectedCustomer ? selectedCustomer.full_name : formData.customer_name;
      const customerEmailForInvoice = selectedCustomer ? (selectedCustomer.email || null) : (formData.customer_email || null);
      const customerPhoneForInvoice = selectedCustomer ? (selectedCustomer.phone || null) : (formData.customer_phone || null);
      const invoiceData = {
        invoice_number: invoiceNumber,
        customer_id: formData.customer_id || null,
        customer_name: customerNameForInvoice,
        customer_email: customerEmailForInvoice,
        customer_phone: customerPhoneForInvoice,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        discount_amount: 0,
        total_amount: totals.total,
        status: 'draft',
        due_date: formData.due_date || null,
        issue_date: formData.due_date || new Date().toISOString().slice(0, 10),
        payment_method: formData.payment_method || null,
        notes: formData.notes || null,
        jobcard_id: formData.jobcard_id || null,
        jobcard_reference: formData.jobcard_reference || null,
        location_id: formData.location_id || null,
        organization_id: organization?.id || '',
      };
      
      console.log('Invoice data being sent:', invoiceData);
      console.log('Organization ID:', organization?.id);
      
      if (!organization?.id) {
        throw new Error('Organization ID is missing');
      }
      const created = await createInvoiceWithFallback(supabase, invoiceData, selectedItems);

      // If payment was received, record it immediately
      if (receivedPayment) {
        const amountNum = Number(paymentData.amount || totals.total || 0) || 0;
        if (!paymentData.method) {
          toast.error('Select a payment method');
        } else if (paymentData.method === 'mpesa' && !paymentData.reference.trim()) {
          toast.error('Reference number is required for Mpesa');
        } else if (amountNum <= 0) {
          toast.error('Amount received must be greater than 0');
        } else {
          try {
            await recordInvoicePaymentWithFallback(supabase, {
              invoice_id: created.id,
              amount: amountNum,
              method: paymentData.method,
              reference_number: paymentData.reference || null,
              payment_date: new Date().toISOString().slice(0, 10),
              location_id: formData.location_id || null,
              account_id: paymentData.account_id || undefined,
            } as any);
          } catch (payErr) {
            console.warn('Failed to record payment for invoice', payErr);
          }
        }
      }
      // Persist customer fields for next invoice session
      persistCustomerDetails();
      toast.success('Invoice created');
      navigate('/invoices');
    } catch (e) {
      console.error('Invoice creation error:', e);
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      toast.error(`Failed to create invoice: ${errorMessage}`);
    }
  };

  // Calculate commission summary
  const commissionSummary = useMemo(() => {
    const staffCommissions = new Map();
    selectedItems.forEach(item => {
      if (item.staff_id && item.commission_percentage > 0) {
        const staffName = staff.find(s => s.id === item.staff_id)?.full_name || 'Unknown Staff';
        const commissionAmount = (item.total_price * item.commission_percentage) / 100;
        
        if (staffCommissions.has(item.staff_id)) {
          const existing = staffCommissions.get(item.staff_id);
          existing.amount += commissionAmount;
          existing.items.push(item.description);
        } else {
          staffCommissions.set(item.staff_id, {
            name: staffName,
            amount: commissionAmount,
            items: [item.description]
          });
        }
      }
    });
    return Array.from(staffCommissions.values());
  }, [selectedItems, staff]);

  const handlePrintInvoice = () => {
    if (selectedItems.length === 0) {
      toast.error("No items to print. Please add items to the invoice first.");
      return;
    }
    
    const totals = calculateTotals();
    const invoiceData = {
      invoice_number: "Draft Invoice",
      customer_name: formData.customer_name,
      customer_email: formData.customer_email,
      customer_phone: formData.customer_phone,
      issue_date: new Date(formData.due_date || new Date().toISOString().slice(0, 10)).toLocaleDateString(),
      due_date: formData.due_date ? new Date(formData.due_date).toLocaleDateString() : '',
      items: selectedItems,
      subtotal: totals.subtotal,
      tax_amount: totals.taxAmount,
      total_amount: totals.total,
      jobcard_reference: formData.jobcard_reference
    };
    
    // Create a print-friendly version
    const printContent = `
      <html>
        <head>
          <title>Invoice - ${invoiceData.invoice_number}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            .customer-info { margin-bottom: 20px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .items-table th, .items-table td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            .items-table th { background-color: #f5f5f5; }
            .totals { margin-left: auto; width: 300px; }
            .total-row { font-weight: bold; border-top: 2px solid #333; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>INVOICE</h1>
            <p><strong>Invoice #:</strong> ${invoiceData.invoice_number}</p>
            <p><strong>Date:</strong> ${invoiceData.issue_date}</p>
            ${invoiceData.due_date ? `<p><strong>Due Date:</strong> ${invoiceData.due_date}</p>` : ''}
            ${invoiceData.jobcard_reference ? `<p><strong>Job Card Reference:</strong> ${invoiceData.jobcard_reference}</p>` : ''}
          </div>
          
          <div class="customer-info">
            <h3>Bill To:</h3>
            <p><strong>${invoiceData.customer_name}</strong></p>
            ${invoiceData.customer_email ? `<p>Email: ${invoiceData.customer_email}</p>` : ''}
            ${invoiceData.customer_phone ? `<p>Phone: ${invoiceData.customer_phone}</p>` : ''}
          </div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Staff</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${invoiceData.items.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.quantity}</td>
                  <td>${symbol}${item.unit_price.toFixed(2)}</td>
                  <td>${staff.find(s => s.id === item.staff_id)?.full_name || '-'}</td>
                  <td>${symbol}${item.total_price.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="totals">
            <table style="width: 100%;">
              <tr><td>Subtotal:</td><td style="text-align: right;">${symbol}${invoiceData.subtotal.toFixed(2)}</td></tr>
              ${taxEnabled !== false && applyTax ? `<tr><td>Tax (${orgTaxRate.toFixed(1)}%):</td><td style="text-align: right;">${symbol}${invoiceData.tax_amount.toFixed(2)}</td></tr>` : ''}
              <tr class="total-row"><td><strong>Total:</strong></td><td style="text-align: right;"><strong>${symbol}${invoiceData.total_amount.toFixed(2)}</strong></td></tr>
            </table>
          </div>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    } else {
      toast.error("Unable to open print window. Please check your browser's popup settings.");
    }
  };

  const handleSendWhatsApp = () => {
    if (selectedItems.length === 0) {
      toast.error("No items to send. Please add items to the invoice first.");
      return;
    }
    
    if (!formData.customer_phone) {
      toast.error("Customer phone number is required to send via WhatsApp.");
      return;
    }
    
    const totals = calculateTotals();
    const message = `*INVOICE*

*Invoice #:* Draft Invoice
*Date:* ${new Date().toLocaleDateString()}
*Customer:* ${formData.customer_name}
${formData.jobcard_reference ? `*Job Card Reference:* ${formData.jobcard_reference}` : ''}

*ITEMS:*
${selectedItems.map(item => 
  `• ${item.description}
  ${item.quantity} × ${symbol}${item.unit_price.toFixed(2)} = ${symbol}${item.total_price.toFixed(2)}`
).join('\n')}

*TOTAL SUMMARY:*
Subtotal: ${symbol}${totals.subtotal.toFixed(2)}
${taxEnabled !== false && applyTax ? `Tax (${orgTaxRate.toFixed(1)}%): ${symbol}${totals.taxAmount.toFixed(2)}` : ''}
*Total: ${symbol}${totals.total.toFixed(2)}*

Thank you for your business!`;
    
    // Clean phone number (remove non-digits)
    const cleanPhone = formData.customer_phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
    toast.success("WhatsApp opened with invoice details!");
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 px-3 lg:px-4 py-4 bg-slate-50/30 min-h-screen w-full">
      {/* Main Form */}
      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl shadow-lg">
              <Receipt className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Create Invoice</h1>
              <p className="text-slate-600">Full-page invoice creation</p>
            </div>
          </div>
        
        </div>

        <form id="invoice-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              Customer & Bill To Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_id">Existing Customer</Label>
                <Select value={formData.customer_id} disabled={Boolean(formData.jobcard_reference)} onValueChange={async (value) => {
                  if (formData.jobcard_reference) {
                    toast.error("Customer is controlled by the selected job card");
                    return;
                  }
                  const customer = customers.find(c => c.id === value);
                  
                  // Always sync bill-to fields with selected customer's defaults
                  setFormData({
                    ...formData,
                    customer_id: value,
                    customer_name: customer?.full_name || "",
                    customer_email: customer?.email || "",
                    customer_phone: customer?.phone || "",
                  });
                  
                  // Fetch job cards for this customer (only completed ones)
                  if (value) {
                    try {
                      const { data: customerJCs } = await supabase
                        .from("job_cards")
                        .select("id, job_card_number, total_amount")
                        .eq('client_id', value)
                        .eq('organization_id', organization?.id || '')
                        .eq('status', 'completed')
                        .order('created_at', { ascending: false });
                      setCustomerJobCards(customerJCs || []);
                    } catch (error) {
                      console.error("Error fetching customer job cards:", error);
                      setCustomerJobCards([]);
                    }
                  } else {
                    setCustomerJobCards([]);
                  }
                }}>
                  <SelectTrigger disabled={Boolean(formData.jobcard_reference)}>
                    <SelectValue placeholder="Select existing customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer_name">Bill To Name *</Label>
                <Input id="customer_name" value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} required readOnly={Boolean(formData.jobcard_reference) || Boolean(formData.customer_id)} placeholder="Auto-filled from selected customer" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_email">Bill To Email</Label>
                <Input id="customer_email" type="email" value={formData.customer_email} onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })} readOnly={Boolean(formData.jobcard_reference) || Boolean(formData.customer_id)} placeholder="Auto-filled from selected customer" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer_phone">Bill To Phone</Label>
                <Input id="customer_phone" value={formData.customer_phone} onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })} readOnly={Boolean(formData.jobcard_reference) || Boolean(formData.customer_id)} placeholder="Auto-filled from selected customer" />
              </div>
            </div>
          </div>
          
          

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-purple-600" />
              Invoice Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="due_date">Invoice Date *</Label>
                <Input className="w-full" id="due_date" type="date" required value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location_id">Location *</Label>
                <Select value={formData.location_id} onValueChange={(v) => setFormData(prev => ({ ...prev, location_id: v }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={locations.length ? 'Select a location' : 'No locations found'} />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueLocations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobcard_reference">Job Card Reference</Label>
                <Select 
                  value={formData.jobcard_reference} 
                  onValueChange={(value) => {
                    setFormData({ ...formData, jobcard_reference: value, jobcard_id: value });
                    handleJobCardSelection(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job card" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredJobCards.map((jc) => (
                      <SelectItem key={jc.id} value={jc.id}>
                        {jc.job_card_number} {jc.client_name ? `- ${jc.client_name}` : ''} ({symbol}{jc.total_amount})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.customer_id && customerJobCards.length > 0 && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-blue-800">
                        <p className="text-sm font-medium">Completed Job Cards Available</p>
                        <p className="text-xs mt-1">This customer has {customerJobCards.length} completed job card{customerJobCards.length !== 1 ? 's' : ''}:</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {customerJobCards.map((jc) => (
                            <span key={jc.id} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">
                              {jc.job_card_number}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {(taxEnabled !== false) ? (
              <div className="flex items-center gap-2 pt-1">
                <Checkbox id="apply_tax" checked={applyTax} onCheckedChange={(c) => setApplyTax(Boolean(c))} />
                <Label htmlFor="apply_tax">Add tax to invoice</Label>
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-1 opacity-60">
                <Checkbox id="apply_tax" checked={false} disabled />
                <Label htmlFor="apply_tax" className="text-slate-500">Add tax to invoice (disabled in settings)</Label>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-green-600" />
              Invoice Items
            </h3>
            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-purple-800">Add Item</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-8 gap-3 items-end">
                  <div className="col-span-2">
                    <Label className="text-xs font-medium text-gray-700 mb-1 block">Service *</Label>
                    <Select value={newItem.service_id} onValueChange={async (value) => {
                      const service = services.find(s => s.id === value);
                      // Use service commission rate or fallback to current
                      const commissionRate = service?.commission_percentage || newItem.commission_percentage;
                      
                      setNewItem({
                        ...newItem,
                        service_id: value,
                        description: service?.name || "",
                        unit_price: service?.price?.toString() || "",
                        commission_percentage: commissionRate,
                      });
                    }}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select service" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
                        {services.map((s: any) => (
                          <SelectItem key={s.id} value={s.id} className="text-sm">{s.name} - {symbol}{s.price}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700 mb-1 block">Qty *</Label>
                    <Input className="h-9 text-sm" type="number" min="1" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700 mb-1 block">Price *</Label>
                    <Input className="h-9 text-sm" type="number" step="0.01" value={newItem.unit_price} onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700 mb-1 block">Discount %</Label>
                    <Input className="h-9 text-sm" type="number" min="0" max="100" value={newItem.discount_percentage} onChange={(e) => setNewItem({ ...newItem, discount_percentage: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700 mb-1 block">Staff *</Label>
                    <Select value={newItem.staff_id} onValueChange={(value) => {
                      const selectedStaff = staff.find(s => s.id === value);
                      // Use staff commission rate only if service doesn't have one
                      const commissionRate = newItem.commission_percentage > 0 
                        ? newItem.commission_percentage 
                        : selectedStaff?.commission_rate || 0;
                      setNewItem(prev => ({ 
                        ...prev, 
                        staff_id: value,
                        commission_percentage: commissionRate
                      }));
                    }}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select staff" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200 shadow-lg z-50">
                        {staff.map((s: any) => (
                          <SelectItem key={s.id} value={s.id} className="text-sm">{s.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700 mb-1 block">Commission %</Label>
                    <Input className="h-9 text-sm" type="number" min="0" max="100" step="0.1" value={newItem.commission_percentage} onChange={(e) => setNewItem({ ...newItem, commission_percentage: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700 mb-1 block">&nbsp;</Label>
                    <Button type="button" size="sm" className="w-full h-9 bg-violet-600 hover:bg-violet-700 text-sm" onClick={addItemToInvoice}>
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {selectedItems.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Invoice Items ({selectedItems.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Discount</TableHead>
                        <TableHead>Staff</TableHead>
                        <TableHead>Commission</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedItems.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{symbol}{item.unit_price}</TableCell>
                          <TableCell>{item.discount_percentage}%</TableCell>
                          <TableCell>{staff.find(s => s.id === item.staff_id)?.full_name || '-'}</TableCell>
                          <TableCell>{item.commission_percentage}%</TableCell>
                          <TableCell>{symbol}{item.total_price}</TableCell>
                          <TableCell>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeItemFromInvoice(idx)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
          {/* Payment Section */}
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch id="received_payment" checked={receivedPayment} onCheckedChange={(v) => {
                  setReceivedPayment(v);
                  if (v) {
                    const t = calculateTotals();
                    setPaymentData(prev => ({ ...prev, amount: String((t.total || 0).toFixed(2)) }));
                  }
                }} />
                <Label htmlFor="received_payment">I have received payment</Label>
              </div>
            </div>
            {receivedPayment && (
              <Card className="bg-white/90">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Payment Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Payment Method *</Label>
                      <Select value={paymentData.method} onValueChange={(v) => {
                        setPaymentData(prev => ({ ...prev, method: v }));
                        // Default deposit account from organization settings mapping, if present
                        const map = ((organization?.settings as any)?.default_deposit_accounts_by_method || {}) as Record<string, string>;
                        const next = map[v] || prevAccountForMethod(v, depositAccounts);
                        setPaymentData(prev => ({ ...prev, account_id: next || prev.account_id }));
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="mpesa">Mpesa</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Deposit to Account</Label>
                      <Select value={paymentData.account_id || "__none__"} onValueChange={(v) => setPaymentData(prev => ({ ...prev, account_id: v === "__none__" ? "" : v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose account" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— None —</SelectItem>
                          {depositAccounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.account_code} · {acc.account_name}{acc.account_subtype ? ` (${acc.account_subtype})` : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="reference">Reference {paymentData.method === 'mpesa' ? '(required for Mpesa)' : ''}</Label>
                      <Input
                        id="reference"
                        value={paymentData.reference}
                        onChange={(e) => setPaymentData(prev => ({ ...prev, reference: e.target.value }))}
                        required={paymentData.method === 'mpesa'}
                        className={paymentData.method === 'mpesa' ? 'bg-gradient-to-r from-red-50 to-rose-50 border-red-300 placeholder:text-red-400' : ''}
                        placeholder={paymentData.method === 'mpesa' ? 'Mpesa reference is required' : 'Optional reference'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount_received">Amount Received</Label>
                      <Input id="amount_received" type="number" step="0.01" value={paymentData.amount} onChange={(e) => setPaymentData(prev => ({ ...prev, amount: e.target.value }))} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
        </form>
        {/* Bottom Action Buttons */}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={() => navigate('/invoices')}>Cancel</Button>
          <Button type="submit" form="invoice-form" variant="secondary">Save Invoice</Button>
        </div>
      </div>

      {/* Invoice Preview Sidebar */}
      <div className="w-full xl:w-80 space-y-4">
        {/* Job Card Summary (replaces Invoice Details) */}
        {selectedJobCardInfo && (
          <Card className="bg-white border border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-slate-900">Job Card Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Reference:</span>
                <span className="font-medium">{selectedJobCardInfo.job_card_number}</span>
              </div>
              {selectedJobCardInfo.client_name && (
                <div className="flex justify-between">
                  <span>Client:</span>
                  <span className="font-medium">{selectedJobCardInfo.client_name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Services:</span>
                <span className="font-medium">{typeof selectedJobCardInfo.service_count === 'number' ? selectedJobCardInfo.service_count : selectedItems.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Total:</span>
                <span className="font-semibold">{symbol}{Number(selectedJobCardInfo.total_amount || 0).toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        )}
        {/* Invoice Preview */}
        <Card className="bg-white border border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-slate-900">Invoice Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Invoice #:</span>
                <span className="font-medium">TBD</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-medium">{formData.customer_name || 'Not selected'}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span className="font-medium">{new Date(formData.due_date).toLocaleDateString()}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-900">Items ({selectedItems.length})</div>
              {selectedItems.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No items added yet</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedItems.map((item, idx) => (
                    <div key={idx} className="text-xs bg-slate-50 p-2 rounded">
                      <div className="font-medium">{item.description}</div>
                      <div className="text-slate-600">
                        {item.quantity} × {symbol}{item.unit_price} = {symbol}{item.total_price.toFixed(2)}
                      </div>
                      {item.staff_id && (
                        <div className="text-blue-600">
                          Staff: {staff.find(s => s.id === item.staff_id)?.full_name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-1 text-sm">
              {(() => {
                const totals = calculateTotals();
                return (
                  <>
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{symbol}{totals.subtotal.toFixed(2)}</span>
                    </div>
                    {taxEnabled !== false && applyTax && (
                      <div className="flex justify-between">
                        <span>Tax ({(orgTaxRate).toFixed(1)}%):</span>
                        <span>{symbol}{totals.taxAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Total:</span>
                      <span>{symbol}{totals.total.toFixed(2)}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Invoice Actions Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              className="w-full btn-theme-outline"
              disabled={selectedItems.length === 0}
            >
              <Receipt className="w-4 h-4 mr-2" />
              Invoice Actions
              <ChevronDown className="w-4 h-4 ml-auto" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-full bg-background border border-border shadow-lg z-50">
            <DropdownMenuItem 
              onClick={() => handlePrintInvoice()}
              className="flex items-center gap-2 px-3 py-2 hover:bg-accent hover:text-accent-foreground cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print Invoice
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleSendWhatsApp()}
              className="flex items-center gap-2 px-3 py-2 hover:bg-accent hover:text-accent-foreground cursor-pointer text-[#25D366]"
            >
              <WhatsAppIcon className="w-4 h-4" />
              Send via WhatsApp
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Commission Summary */}
        {commissionSummary.length > 0 && (
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-green-800 flex items-center gap-2">
                💰 Commission Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {commissionSummary.map((commission, idx) => (
                <div key={idx} className="bg-white/60 p-3 rounded-lg">
                  <div className="font-medium text-green-900">{commission.name}</div>
                  <div className="text-lg font-bold text-green-700">
                    {symbol}{commission.amount.toFixed(2)}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    {commission.items.join(', ')}
                  </div>
                </div>
              ))}
              <div className="border-t border-green-200 pt-2">
                <div className="flex justify-between font-semibold text-green-800">
                  <span>Total Commission:</span>
                  <span>{symbol}{commissionSummary.reduce((sum, c) => sum + c.amount, 0).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
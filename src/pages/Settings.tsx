import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building, Users, CreditCard, MessageSquare, MapPin, Plus, Edit2, Trash2, Crown, Shield, User } from "lucide-react";
import { Dialog as UIDialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { usePermissions } from "@/lib/saas/hooks";
import { toast } from "sonner";
import { useOrganization } from "@/lib/saas/hooks";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Globe } from "lucide-react";

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "company");
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && tabParam !== activeTab) {
      // Map deprecated 'users' tab to the new 'roles' tab
      setActiveTab(tabParam === 'users' ? 'roles' : tabParam);
    }
  }, [searchParams]);

  // Company Settings State
  const [companyData, setCompanyData] = useState({
    name: "",
    address: "",
    city: "",
        country: "",
phone: "",
    email: "",
    website: "",
    tax_id: "",
    logo_url: "",
    timezone: "",
    currency: "",
    language: "en",
  });

  const { organization, updateOrganization } = useOrganization();
  const [currencies, setCurrencies] = useState<{ id: string; code: string; name: string; symbol: string; is_active: boolean; }[]>([]);
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string>("");
  const [countries, setCountries] = useState<{ id: string; code: string; name: string; is_active: boolean }[]>([])
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>("US")

  // Regional settings state
  const [regionalSettings, setRegionalSettings] = useState({
    date_format: 'MMM dd, yyyy',
    time_format: '12h',
    thousand_separator: ',',
    decimal_separator: '.',
    currency_decimals: 2,
  })

  // New: Finance Settings - Tax Rate
  const [taxRatePercent, setTaxRatePercent] = useState<string>("");

  // New: Accounting - Default deposit accounts per payment method
  type AccountOption = { id: string; account_code: string; account_name: string; account_subtype?: string | null }
  const [depositAccounts, setDepositAccounts] = useState<AccountOption[]>([])
  const [depositAccountMap, setDepositAccountMap] = useState<Record<string, string>>({})

  // Users & Roles State
  const [roles, setRoles] = useState([
    { id: "1", name: "Administrator", description: "Full access to all features", permissions: ["all"], users_count: 1 },
    { id: "2", name: "Manager", description: "Manage operations and staff", permissions: ["manage_staff", "view_reports", "manage_inventory"], users_count: 1 },
    { id: "3", name: "Staff", description: "Basic staff access", permissions: ["manage_appointments", "view_clients"], users_count: 3 },
    { id: "4", name: "Receptionist", description: "Front desk operations", permissions: ["manage_appointments", "manage_clients"], users_count: 2 },
  ]);
  // Roles UI state for improved usability
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roleSearch, setRoleSearch] = useState("");
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [roleForm, setRoleForm] = useState<{ id?: string; name: string; description: string; permissions: string[] }>({ name: "", description: "", permissions: [] });
  const [roleToDelete, setRoleToDelete] = useState<typeof roles[number] | null>(null);

  useEffect(() => {
    if (!selectedRoleId && roles.length > 0) {
      setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId]);

  const permissionPresets: Record<string, string[]> = {
    Administrator: ["all"],
    Manager: ["manage_staff", "view_reports", "manage_inventory"],
    Staff: ["manage_appointments", "view_clients"],
    Receptionist: ["manage_appointments", "manage_clients"],
  };

  const openNewRoleDialog = () => {
    setRoleForm({ name: "", description: "", permissions: [] });
    setIsRoleDialogOpen(true);
  };
  const openEditRoleDialog = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return;
    setRoleForm({ id: role.id, name: role.name, description: role.description, permissions: role.permissions });
    setIsRoleDialogOpen(true);
  };
  const applyPreset = (presetName: string) => {
    const perms = permissionPresets[presetName] || [];
    setRoleForm(f => ({ ...f, permissions: perms }));
  };
  const saveRoleDefinitions = async (defs: typeof roles = roles) => {
    if (!organization) return;
    try {
      await updateOrganization(organization.id, {
        settings: {
          ...(organization.settings as any),
          role_definitions: defs,
        },
      } as any);
      toast.success("Roles saved");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save roles");
    }
  };
  const saveRoleForm = async () => {
    const id = roleForm.id || (globalThis.crypto?.randomUUID?.() ? crypto.randomUUID() : `role_${Date.now()}`);
    const updated: typeof roles[number] = {
      id,
      name: roleForm.name.trim(),
      description: roleForm.description.trim(),
      permissions: roleForm.permissions.length ? roleForm.permissions : [],
      users_count: roles.find(r => r.id === id)?.users_count || 0,
    };
    const next = (() => {
      const exists = roles.some(r => r.id === id);
      return exists ? roles.map(r => (r.id === id ? updated : r)) : [...roles, updated];
    })();
    setRoles(next);
    setIsRoleDialogOpen(false);
    setSelectedRoleId(id);
    await saveRoleDefinitions(next);
  };
  const requestDeleteRole = (roleId: string) => {
    setRoleToDelete(roles.find(r => r.id === roleId) || null);
  };
  const confirmDeleteRole = async () => {
    if (!roleToDelete) return;
    const deletedId = roleToDelete.id;
    const next = roles.filter(r => r.id !== deletedId);
    setRoles(next);
    if (selectedRoleId === deletedId) setSelectedRoleId(next[0]?.id || null);
    setRoleToDelete(null);
    await saveRoleDefinitions(next);
  };
  const filteredRoles = roles.filter(r => r.name.toLowerCase().includes(roleSearch.toLowerCase()));
  const selectedRole = roles.find(r => r.id === selectedRoleId) || null;
  const toggleSelectedRolePermission = (permId: string, checked: boolean) => {
    if (!selectedRole) return;
    if (selectedRole.permissions.includes("all")) return;
    setRoles(prev => prev.map(r => {
      if (r.id !== selectedRole.id) return r;
      const perms = checked
        ? Array.from(new Set([...(r.permissions || []), permId]))
        : (r.permissions || []).filter(p => p !== permId);
      return { ...r, permissions: perms };
    }));
  };

  // Roles Editor state (organization-specific overrides)
  type PermRow = { action: string; resource: string }
  const [roleOverrides, setRoleOverrides] = useState<Record<string, PermRow[]>>({})
  useEffect(() => {
    const s = (organization?.settings as any) || {}
    const overrides = (s.role_permissions as Record<string, PermRow[]>) || {}
    setRoleOverrides(overrides)
  }, [organization])

  const addPermissionRow = (roleKey: string) => {
    setRoleOverrides(prev => ({
      ...prev,
      [roleKey]: [...(prev[roleKey] || []), { action: "read", resource: "dashboard" }],
    }))
  }
  const removePermissionRow = (roleKey: string, idx: number) => {
    setRoleOverrides(prev => ({
      ...prev,
      [roleKey]: (prev[roleKey] || []).filter((_, i) => i !== idx),
    }))
  }
  const updatePermissionRow = (roleKey: string, idx: number, field: keyof PermRow, value: string) => {
    setRoleOverrides(prev => {
      const rows = [...(prev[roleKey] || [])]
      rows[idx] = { ...rows[idx], [field]: value }
      return { ...prev, [roleKey]: rows }
    })
  }
  const saveRoleOverrides = async () => {
    if (!organization) return toast.error('No organization selected')
    try {
      await updateOrganization(organization.id, {
        settings: {
          ...(organization.settings as any),
          role_permissions: roleOverrides,
        },
      } as any)
      toast.success('Role permissions updated')
    } catch (e) {
      console.error(e)
      toast.error('Failed to save role permissions')
    }
  }

  // Master permission catalog for checkbox UI
  const allPermissions = [
    { id: "manage_staff", label: "Manage Staff" },
    { id: "view_reports", label: "View Reports" },
    { id: "manage_inventory", label: "Manage Inventory" },
    { id: "manage_appointments", label: "Manage Appointments" },
    { id: "view_clients", label: "View Clients" },
    { id: "manage_clients", label: "Manage Clients" },
    { id: "manage_billing", label: "Manage Billing" },
    { id: "manage_settings", label: "Manage Settings" },
  ] as const;

  const toggleRolePermission = (roleId: string, permissionId: string, checked: boolean) => {
    setRoles(prev => prev.map(r => {
      if (r.id !== roleId) return r;
      if (r.permissions.includes("all")) return r; // keep admin as full access
      const next = checked
        ? Array.from(new Set([...(r.permissions || []), permissionId]))
        : (r.permissions || []).filter(p => p !== permissionId);
      return { ...r, permissions: next };
    }));
  };

  // Subscription State
  const [subscription] = useState({
    plan: "Professional",
    status: "Active",
    billing_cycle: "Monthly",
    amount: 49.99,
    next_billing: "2024-02-15",
    features: ["Unlimited Users", "Advanced Reports", "Email Support", "Mobile App", "API Access"],
  });

  // Communications State
  const [communicationSettings, setCommunicationSettings] = useState({
    email_notifications: true,
    sms_notifications: true,
    appointment_reminders: true,
    promotional_emails: false,
    staff_notifications: true,
    email_signature: "Best regards,\nAURA OS Team",
    sms_provider: "twilio",
    smtp_server: "smtp.gmail.com",
    smtp_port: "587",
    smtp_username: "",
    smtp_password: "",
  });

  // Locations State
  const [stockLocations, setStockLocations] = useState<{
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    default_warehouse_id?: string | null;
  }[]>([])
  // Warehouses State
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string; location_id: string; is_active: boolean }>>([])
  const [warehouseForm, setWarehouseForm] = useState<{ id?: string; name: string; location_id: string; is_active: boolean }>({ name: '', location_id: '', is_active: true })
  const [warehouseDialogOpen, setWarehouseDialogOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<{ id: string; name: string; location_id: string; is_active: boolean } | null>(null)
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<{
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
  } | null>(null)
  const [locationForm, setLocationForm] = useState({
    name: "",
    description: "",
    is_active: true,
    default_warehouse_id: "",
  })
  const [defaultPosWarehouseId, setDefaultPosWarehouseId] = useState<string>("")

  const openNewLocation = () => {
    setEditingLocation(null)
    setLocationForm({ name: "", description: "", is_active: true, default_warehouse_id: "" })
    setIsLocationDialogOpen(true)
  }

  const openEditLocation = (location: {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
  }) => {
    setEditingLocation(location)
    setLocationForm({
      name: location.name,
      description: location.description || "",
      is_active: location.is_active,
      default_warehouse_id: location.default_warehouse_id || "",
    })
    setIsLocationDialogOpen(true)
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('currencies')
        .select('*')
        .eq('is_active', true)
        .order('code')
      setCurrencies(data || [])
      const { data: countryData } = await supabase
        .from('countries')
        .select('*')
        .eq('is_active', true)
        .order('name')
      setCountries(countryData || [])
      // Warehouses will be loaded after organization is available
    })()
  }, [])

  useEffect(() => {
    if (organization) {
      const s = (organization.settings as any) || {}
      setCompanyData(prev => ({
        ...prev,
        name: organization.name || prev.name,
        address: s.address || "",
        city: s.city || prev.city,
        country: s.country || prev.country,
        phone: s.phone || prev.phone,
        email: s.email || prev.email,
        website: s.website || prev.website,
        timezone: s.timezone || prev.timezone,
      }))
      setSelectedCurrencyId((organization as any).currency_id || "")
      setSelectedCountryCode(s.country || "US")
      // Load saved role definitions if present
      const defs = (s.role_definitions as typeof roles) || [];
      if (Array.isArray(defs) && defs.length > 0) {
        setRoles(defs);
      }
      // Load regional settings if present
      if (s.regional_settings) {
        setRegionalSettings({
          date_format: s.regional_settings.date_format || 'MMM dd, yyyy',
          time_format: s.regional_settings.time_format || '12h',
          thousand_separator: s.regional_settings.thousand_separator || ',',
          decimal_separator: s.regional_settings.decimal_separator || '.',
          currency_decimals: typeof s.regional_settings.currency_decimals === 'number' ? s.regional_settings.currency_decimals : 2,
        })
      }
      // Initialize tax rate percent from org settings
      const tax = s.tax_rate_percent
      const parsed = typeof tax === 'number' ? tax : typeof tax === 'string' ? parseFloat(tax) : 0
      setTaxRatePercent(Number.isFinite(parsed) ? String(parsed) : "")
      // Initialize default POS warehouse from org settings
      setDefaultPosWarehouseId(s.pos_default_warehouse_id || "")
      // Initialize deposit account mapping from org settings
      const map = (s.default_deposit_accounts_by_method as Record<string, string>) || {}
      setDepositAccountMap(map)
    }
  }, [organization])

  // Load selectable deposit accounts (Cash/Bank assets)
  useEffect(() => {
    (async () => {
      if (!organization) return setDepositAccounts([])
      try {
        // Prefer subtype-aware lookup from Chart of Accounts
        const { data, error } = await supabase
          .from('accounts')
          .select('id, account_code, account_name, account_subtype, account_type')
          .eq('organization_id', organization.id)
          .eq('account_type', 'Asset')
          .in('account_subtype', ['Cash', 'Bank'])
          .order('account_code', { ascending: true });

        if (error) throw error;

        const opts = (data || []).map((a: any) => ({
          id: a.id,
          account_code: a.account_code,
          account_name: a.account_name,
          account_subtype: a.account_subtype,
        }));
        setDepositAccounts(opts);
      } catch (e) {
        // Fallback for schemas without account_subtype: derive Cash/Bank from canonical codes or names
        try {
          const { data: allAssets, error: fbErr } = await supabase
            .from('accounts')
            .select('id, account_code, account_name, account_type')
            .eq('organization_id', organization.id)
            .eq('account_type', 'Asset')
            .order('account_code', { ascending: true });
          if (fbErr) throw fbErr;

          const candidates = (allAssets || []).filter((a: any) => {
            const code = String(a.account_code || '').trim();
            const name = String(a.account_name || '').toLowerCase();
            const isCanonical = code === '1001' || code === '1002';
            const nameSuggests = name.includes('cash') || name.includes('bank');
            return isCanonical || nameSuggests;
          });

          const opts = candidates.map((a: any) => ({
            id: a.id,
            account_code: a.account_code,
            account_name: a.account_name,
            account_subtype: a.account_code === '1001' ? 'Cash' : a.account_code === '1002' ? 'Bank' : undefined,
          }));
          setDepositAccounts(opts);
        } catch {
          setDepositAccounts([]);
        }
      }
    })()
  }, [organization])

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) {
      toast.error("No organization selected");
      return;
    }
    try {
      await updateOrganization(organization.id, {
        name: companyData.name,
        logo_url: companyData.logo_url,
        currency_id: selectedCurrencyId || null,
        settings: {
          ...(organization.settings as any),
          address: companyData.address,
          city: companyData.city,
          country: selectedCountryCode,
          phone: companyData.phone,
          email: companyData.email,
          website: companyData.website,
          timezone: companyData.timezone,
          regional_settings: regionalSettings,
        },
      } as any)
      toast.success("Company settings updated successfully");
      // Ensure local UI reflects saved country and currency immediately
      setSelectedCountryCode(selectedCountryCode)
      setSelectedCurrencyId(selectedCurrencyId)
    } catch (err) {
      console.error(err)
      toast.error("Failed to update organization");
    }
  };

  const handleCommunicationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Here you would save to Supabase
    toast.success("Communication settings updated successfully");
  };

  const getRoleIcon = (roleName: string) => {
    switch (roleName) {
      case "Administrator": return <Crown className="w-4 h-4 text-yellow-500" />;
      case "Manager": return <Shield className="w-4 h-4 text-blue-500" />;
      default: return <User className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge variant={status === "Active" ? "default" : "secondary"}>
        {status}
      </Badge>
    );
  };

  const handleSaveLocation = async () => {
    if (!organization) return toast.error('No organization selected');
    if (editingLocation) {
      try {
        await supabase
          .from('business_locations')
          .update({
            name: locationForm.name,
            address: locationForm.description,
            is_active: locationForm.is_active,
            default_warehouse_id: locationForm.default_warehouse_id || null,
          })
          .eq('id', editingLocation.id);
        toast.success('Location updated successfully');
        setIsLocationDialogOpen(false);
        fetchStockLocations();
      } catch (e: any) {
        console.error(e);
        toast.error(`Failed to update location${e?.message ? `: ${e.message}` : ''}`);
      }
    } else {
      try {
        await supabase
          .from('business_locations')
          .insert({
            organization_id: organization.id,
            name: locationForm.name,
            address: locationForm.description,
            is_active: locationForm.is_active,
            default_warehouse_id: locationForm.default_warehouse_id || null,
          });
        toast.success('Location created successfully');
        setIsLocationDialogOpen(false);
        fetchStockLocations();
      } catch (e: any) {
        console.error(e);
        toast.error(`Failed to create location${e?.message ? `: ${e.message}` : ''}`);
      }
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (!organization) return toast.error('No organization selected');
    if (window.confirm('Are you sure you want to delete this location?')) {
      try {
        await supabase
          .from('business_locations')
          .delete()
          .eq('id', id);
        toast.success('Location deleted successfully');
        fetchStockLocations();
      } catch (e: any) {
        console.error(e);
        toast.error(`Failed to delete location${e?.message ? `: ${e.message}` : ''}`);
      }
    }
  };

  const handleSaveDepositAccounts = async () => {
    if (!organization) return toast.error('No organization selected');
    try {
      await updateOrganization(organization.id, {
        settings: {
          ...(organization.settings as any),
          default_deposit_accounts_by_method: depositAccountMap,
        },
      } as any)
      toast.success('Default deposit accounts updated')
    } catch (e) {
      console.error(e)
      toast.error('Failed to save default deposit accounts')
    }
  }

  const handleSaveTaxRate = async () => {
    if (!organization) return toast.error('No organization selected');
    try {
      await updateOrganization(organization.id, {
        settings: {
          ...(organization.settings as any),
          tax_rate_percent: taxRatePercent === '' ? null : parseFloat(taxRatePercent),
        },
      } as any)
      toast.success('Tax rate updated')
    } catch (e) {
      console.error(e)
      toast.error('Failed to save tax rate')
    }
  }

  const fetchStockLocations = async () => {
    if (!organization) return;
    try {
      const { data, error } = await supabase
        .from('business_locations')
        .select('id, name, address, is_active, default_warehouse_id')
        .eq('organization_id', organization.id)
        .order('name');
      if (error) throw error;
      const mapped = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.address ?? null,
        is_active: row.is_active,
        default_warehouse_id: row.default_warehouse_id || null,
      }));
      setStockLocations(mapped);
    } catch (e: any) {
      console.error(e);
      toast.error(`Failed to fetch locations${e?.message ? `: ${e.message}` : ''}`);
      setStockLocations([]);
    }
  };

  useEffect(() => {
    fetchStockLocations();
  }, [organization]);

  const saveWarehouse = async () => {
    try {
      if (!organization?.id) return toast.error('No organization selected');
      if (!warehouseForm.name || !warehouseForm.location_id) return toast.error('Name and location are required');
      if (editingWarehouse) {
        const { error } = await supabase
          .from('warehouses')
          .update({ name: warehouseForm.name, location_id: warehouseForm.location_id, is_active: warehouseForm.is_active })
          .eq('id', editingWarehouse.id);
        if (error) throw error;
        toast.success('Warehouse updated');
      } else {
        const { error } = await supabase
          .from('warehouses')
          .insert([{ name: warehouseForm.name, location_id: warehouseForm.location_id, is_active: warehouseForm.is_active, organization_id: organization.id }]);
        if (error) throw error;
        toast.success('Warehouse created');
      }
      const { data: whs, error: fetchError } = await supabase
        .from('warehouses')
        .select('id, name, location_id, is_active')
        .eq('organization_id', organization.id)
        .order('name');
      if (fetchError) throw fetchError;
      setWarehouses(whs || []);
      setWarehouseDialogOpen(false);
      setEditingWarehouse(null);
      setWarehouseForm({ name: '', location_id: '', is_active: true });
    } catch (e: any) {
      console.error(e);
      const message = e?.message || e?.error_description || 'Unknown error';
      toast.error(`Failed to save warehouse${message ? `: ${message}` : ''}`);
    }
  }

  const deleteWarehouse = async (id: string) => {
    if (!confirm('Delete this warehouse?')) return
    try {
      // Prevent deletion if warehouse has related transactions
      const [levelsRes, grRes, adjRes] = await Promise.all([
        supabase.from('inventory_levels').select('id', { count: 'exact', head: true }).eq('warehouse_id', id),
        supabase.from('goods_received').select('id', { count: 'exact', head: true }).eq('warehouse_id', id),
        supabase.from('inventory_adjustments').select('id', { count: 'exact', head: true }).eq('warehouse_id', id),
      ])
      const levelsCount = levelsRes.count || 0
      const goodsReceivedCount = grRes.count || 0
      const adjustmentsCount = adjRes.count || 0
      if (levelsCount > 0 || goodsReceivedCount > 0 || adjustmentsCount > 0) {
        toast.error('Cannot delete warehouse with existing transactions')
        return
      }

      const { error } = await supabase.from('warehouses').delete().eq('id', id)
      if (error) throw error
      setWarehouses(prev => prev.filter(w => w.id !== id))
      toast.success('Warehouse deleted')
    } catch (e) {
      console.error(e)
      toast.error('Failed to delete warehouse')
    }
  }

  useEffect(() => {
    if (!organization?.id) {
      setWarehouses([])
      return
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from('warehouses')
          .select('id, name, location_id, is_active')
          .eq('organization_id', organization.id)
          .order('name')
        if (error) throw error
        setWarehouses(data || [])
      } catch (e: any) {
        console.error(e)
        toast.error(`Failed to load warehouses${e?.message ? `: ${e.message}` : ''}`)
        setWarehouses([])
      }
    })()
  }, [organization?.id])

  const handleSaveDefaultPosWarehouse = async () => {
    if (!organization) return toast.error('No organization selected');
    try {
      await updateOrganization(organization.id, {
        settings: {
          ...(organization.settings as any),
          pos_default_warehouse_id: defaultPosWarehouseId || null,
        },
      } as any)
      toast.success('Default POS warehouse updated')
    } catch (e) {
      console.error(e)
      toast.error('Failed to save default POS warehouse')
    }
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your salon's configuration and preferences
        </p>
      </div>

      {/* Tabs */}
      <Tabs
        orientation="vertical"
        value={activeTab}
        onValueChange={(val) => {
          const y = window.scrollY;
          setActiveTab(val);
          setSearchParams({ tab: val });
          requestAnimationFrame(() => window.scrollTo({ top: y }));
        }}
        className="grid gap-6 md:grid-cols-[240px_1fr] items-start"
      >
        <TabsList className="flex h-auto w-full flex-col items-stretch gap-2 rounded-lg border bg-background p-2 sticky top-16 z-30">
          <TabsTrigger value="company" className="justify-start gap-2 data-[state=active]:bg-muted">
            <Building className="w-4 h-4" />
            Company
          </TabsTrigger>
          <TabsTrigger value="roles" className="justify-start gap-2 data-[state=active]:bg-muted">
            <Shield className="w-4 h-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="subscription" className="justify-start gap-2 data-[state=active]:bg-muted">
            <CreditCard className="w-4 h-4" />
            Subscription
          </TabsTrigger>
          <TabsTrigger value="communications" className="justify-start gap-2 data-[state=active]:bg-muted">
            <MessageSquare className="w-4 h-4" />
            Communications
          </TabsTrigger>
          <TabsTrigger value="locations" className="justify-start gap-2 data-[state=active]:bg-muted">
            <MapPin className="w-4 h-4" />
            Locations
          </TabsTrigger>
          <TabsTrigger value="warehouses" className="justify-start gap-2 data-[state=active]:bg-muted">
            <Building className="w-4 h-4" />
            Warehouses
          </TabsTrigger>
          <TabsTrigger value="accounting" className="justify-start gap-2 data-[state=active]:bg-muted">
            <CreditCard className="w-4 h-4" />
            Accounting
          </TabsTrigger>
          <TabsTrigger value="regional" className="justify-start gap-2 data-[state=active]:bg-muted">
            <Globe className="w-4 h-4" />
            Regional Settings
          </TabsTrigger>
        </TabsList>

        <div className="space-y-6 min-h-[50vh]">
          {/* Company Settings */}
          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-pink-600" />
                  Company Information
                </CardTitle>
                <CardDescription>
                  Update your business details and preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCompanySubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Business Name</Label>
                      <Input id="name" value={companyData.name} onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input id="website" value={companyData.website} onChange={(e) => setCompanyData({ ...companyData, website: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input id="address" value={companyData.address} onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input id="city" value={companyData.city} onChange={(e) => setCompanyData({ ...companyData, city: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Select value={selectedCountryCode} onValueChange={setSelectedCountryCode}>
                        <SelectTrigger id="country">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          {countries.map((c) => (
                            <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" value={companyData.phone} onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" value={companyData.email} onChange={(e) => setCompanyData({ ...companyData, email: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Input id="timezone" value={companyData.timezone} onChange={(e) => setCompanyData({ ...companyData, timezone: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select value={selectedCurrencyId} onValueChange={setSelectedCurrencyId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {currencies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.code} — {c.name} ({c.symbol})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="logo_url">Logo URL</Label>
                      <Input id="logo_url" value={companyData.logo_url} onChange={(e) => setCompanyData({ ...companyData, logo_url: e.target.value })} />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit">Save Changes</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Regional Settings */}
          <TabsContent value="regional">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-pink-600" />
                  Regional & Formatting
                </CardTitle>
                <CardDescription>Configure date/time and currency number formatting used across the app</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Date format</Label>
                    <Select
                      value={regionalSettings.date_format}
                      onValueChange={(v) => setRegionalSettings(s => ({ ...s, date_format: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select date format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MMM dd, yyyy">Jan 31, 2025</SelectItem>
                        <SelectItem value="dd/MM/yyyy">31/01/2025</SelectItem>
                        <SelectItem value="MM/dd/yyyy">01/31/2025</SelectItem>
                        <SelectItem value="yyyy-MM-dd">2025-01-31</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Time format</Label>
                    <Select
                      value={regionalSettings.time_format}
                      onValueChange={(v) => setRegionalSettings(s => ({ ...s, time_format: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select time format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12h">12-hour (h:mm a)</SelectItem>
                        <SelectItem value="24h">24-hour (HH:mm)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                  <div className="space-y-2">
                    <Label>Thousand separator</Label>
                    <Select
                      value={regionalSettings.thousand_separator}
                      onValueChange={(v) => setRegionalSettings(s => ({ ...s, thousand_separator: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                                            <SelectContent>
                        <SelectItem value=",">Comma ,</SelectItem>
                        <SelectItem value=".">Dot .</SelectItem>
                        <SelectItem value=" ">Space ␠</SelectItem>
                        <SelectItem value="'">Apostrophe '</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Decimal separator</Label>
                    <Select
                      value={regionalSettings.decimal_separator}
                      onValueChange={(v) => setRegionalSettings(s => ({ ...s, decimal_separator: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                                            <SelectContent>
                        <SelectItem value=".">Dot .</SelectItem>
                        <SelectItem value=",">Comma ,</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Currency decimals</Label>
                    <Select
                      value={String(regionalSettings.currency_decimals)}
                      onValueChange={(v) => setRegionalSettings(s => ({ ...s, currency_decimals: parseInt(v, 10) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end mt-6">
                  <Button onClick={handleCompanySubmit}>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users & Roles - Redesigned */}
          <TabsContent value="roles" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left: Role list */}
              <Card className="md:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-pink-600" />
                      Roles
                    </span>
                    <Button size="sm" onClick={openNewRoleDialog} className="bg-gradient-to-r from-pink-500 to-purple-600">
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-3">
                    <Input placeholder="Search roles..." value={roleSearch} onChange={(e) => setRoleSearch(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    {filteredRoles.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setSelectedRoleId(r.id)}
                        className={`w-full text-left rounded-md border px-3 py-2 hover:bg-muted ${selectedRoleId === r.id ? 'bg-muted' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getRoleIcon(r.name)}
                            <span className="font-medium">{r.name}</span>
                          </div>
                          <Badge variant="outline">{r.users_count} users</Badge>
                        </div>
                      </button>
                    ))}
                    {filteredRoles.length === 0 && (
                      <div className="text-sm text-muted-foreground">No roles found</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Right: Role details */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {selectedRole ? (
                        <>
                          {getRoleIcon(selectedRole.name)}
                          <span>{selectedRole.name}</span>
                        </>
                      ) : (
                        <span>Select a role</span>
                      )}
                    </span>
                    {selectedRole && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditRoleDialog(selectedRole.id)}>
                          <Edit2 className="w-4 h-4 mr-1" /> Edit
                        </Button>
                        <Button variant="outline" size="sm" className="text-destructive" onClick={() => requestDeleteRole(selectedRole.id)}>
                          <Trash2 className="w-4 h-4 mr-1" /> Delete
                        </Button>
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedRole ? (
                    <div className="text-sm text-muted-foreground">Choose a role from the left to manage permissions.</div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <p className="text-sm text-muted-foreground">{selectedRole.description}</p>
                      </div>
                      {/* Permissions matrix */}
                      <div>
                        <h4 className="font-semibold mb-2">Permissions</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {allPermissions.map((perm) => (
                            <label key={perm.id} className="flex items-center gap-3 rounded-md border p-2">
                              <Checkbox
                                checked={selectedRole.permissions.includes('all') ? true : selectedRole.permissions.includes(perm.id)}
                                onCheckedChange={(c) => toggleSelectedRolePermission(perm.id, Boolean(c))}
                                disabled={selectedRole.permissions.includes('all')}
                              />
                              <span className="text-sm">{perm.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      {/* Organization overrides editor for selected role */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Overrides for this organization</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addPermissionRow(selectedRole.name.toLowerCase())}
                          >
                            Add Permission
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {(roleOverrides[selectedRole.name.toLowerCase()] || []).map((row, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                              <div className="col-span-5">
                                <Select
                                  value={row.action}
                                  onValueChange={(v) => updatePermissionRow(selectedRole.name.toLowerCase(), idx, 'action', v)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Action" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="read">View</SelectItem>
                                    <SelectItem value="create">Create</SelectItem>
                                    <SelectItem value="update">Edit</SelectItem>
                                    <SelectItem value="delete">Delete</SelectItem>
                                    <SelectItem value="approve">Approve</SelectItem>
                                    <SelectItem value="*">All</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-6">
                                <Input
                                  value={row.resource}
                                  onChange={(e) => updatePermissionRow(selectedRole.name.toLowerCase(), idx, 'resource', e.target.value)}
                                  placeholder="Resource e.g. appointments, job_cards"
                                />
                              </div>
                              <div className="col-span-1 flex justify-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removePermissionRow(selectedRole.name.toLowerCase(), idx)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" onClick={() => saveRoleDefinitions()}>Save Roles</Button>
                        <Button onClick={saveRoleOverrides}>Save Role Permissions</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Role create/edit dialog */}
            <UIDialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{roleForm.id ? 'Edit Role' : 'Add Role'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={roleForm.name} onChange={(e) => setRoleForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input value={roleForm.description} onChange={(e) => setRoleForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Preset</Label>
                    <Select onValueChange={(v) => applyPreset(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a preset (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Administrator">Administrator</SelectItem>
                        <SelectItem value="Manager">Manager</SelectItem>
                        <SelectItem value="Staff">Staff</SelectItem>
                        <SelectItem value="Receptionist">Receptionist</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Permissions</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {allPermissions.map((perm) => (
                        <label key={perm.id} className="flex items-center gap-3 rounded-md border p-2">
                          <Checkbox
                            checked={roleForm.permissions.includes('all') ? true : roleForm.permissions.includes(perm.id)}
                            onCheckedChange={(c) => setRoleForm(f => ({
                              ...f,
                              permissions: c ? Array.from(new Set([...(f.permissions || []), perm.id])) : (f.permissions || []).filter(p => p !== perm.id),
                            }))}
                            disabled={roleForm.permissions.includes('all')}
                          />
                          <span className="text-sm">{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>Cancel</Button>
                  <Button onClick={saveRoleForm}>{roleForm.id ? 'Save' : 'Create'}</Button>
                </DialogFooter>
              </DialogContent>
            </UIDialog>

            {/* Delete role confirm */}
            <UIDialog open={!!roleToDelete} onOpenChange={(open) => setRoleToDelete(open ? roleToDelete : null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete role</DialogTitle>
                </DialogHeader>
                <div className="text-sm text-muted-foreground">
                  Are you sure you want to delete the role "{roleToDelete?.name}"? This cannot be undone.
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRoleToDelete(null)}>Cancel</Button>
                  <Button className="text-destructive" onClick={confirmDeleteRole}>Delete</Button>
                </DialogFooter>
              </DialogContent>
            </UIDialog>
          </TabsContent>

          {/* Subscription */}
          <TabsContent value="subscription">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-pink-600" />
                  Subscription Management
                </CardTitle>
                <CardDescription>
                  Manage your subscription plan and billing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current Plan */}
                <div className="p-6 border rounded-lg bg-gradient-to-r from-pink-50 to-purple-50">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-semibold">{subscription.plan} Plan</h3>
                      <p className="text-muted-foreground">
                        ${subscription.amount} / {subscription.billing_cycle.toLowerCase()}
                      </p>
                    </div>
                    <Badge className="bg-green-100 text-green-800">
                      {subscription.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Next billing date:</span>
                      <div className="font-medium">{subscription.next_billing}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Billing cycle:</span>
                      <div className="font-medium">{subscription.billing_cycle}</div>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div>
                  <h4 className="font-semibold mb-3">Current Plan Features</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {subscription.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button className="bg-gradient-to-r from-pink-500 to-purple-600">
                    Upgrade Plan
                  </Button>
                  <Button variant="outline">
                    View Billing History
                  </Button>
                  <Button variant="outline">
                    Update Payment Method
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Communications */}
          <TabsContent value="communications">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-pink-600" />
                  Communication Settings
                </CardTitle>
                <CardDescription>
                  Configure notifications and communication preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCommunicationSubmit} className="space-y-6">
                  {/* Notification Preferences */}
                  <div>
                    <h4 className="font-semibold mb-4">Notification Preferences</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="email_notifications">Email Notifications</Label>
                          <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                        </div>
                        <Switch
                          id="email_notifications"
                          checked={communicationSettings.email_notifications}
                          onCheckedChange={(checked) => 
                            setCommunicationSettings({ ...communicationSettings, email_notifications: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="sms_notifications">SMS Notifications</Label>
                          <p className="text-sm text-muted-foreground">Receive notifications via SMS</p>
                        </div>
                        <Switch
                          id="sms_notifications"
                          checked={communicationSettings.sms_notifications}
                          onCheckedChange={(checked) => 
                            setCommunicationSettings({ ...communicationSettings, sms_notifications: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="appointment_reminders">Appointment Reminders</Label>
                          <p className="text-sm text-muted-foreground">Send automatic appointment reminders</p>
                        </div>
                        <Switch
                          id="appointment_reminders"
                          checked={communicationSettings.appointment_reminders}
                          onCheckedChange={(checked) => 
                            setCommunicationSettings({ ...communicationSettings, appointment_reminders: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="staff_notifications">Staff Notifications</Label>
                          <p className="text-sm text-muted-foreground">Notify staff about schedule changes</p>
                        </div>
                        <Switch
                          id="staff_notifications"
                          checked={communicationSettings.staff_notifications}
                          onCheckedChange={(checked) => 
                            setCommunicationSettings({ ...communicationSettings, staff_notifications: checked })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Email Settings */}
                  <div>
                    <h4 className="font-semibold mb-4">Email Settings</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="smtp_server">SMTP Server</Label>
                        <Input
                          id="smtp_server"
                          value={communicationSettings.smtp_server}
                          onChange={(e) => setCommunicationSettings({ ...communicationSettings, smtp_server: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="smtp_port">SMTP Port</Label>
                        <Input
                          id="smtp_port"
                          value={communicationSettings.smtp_port}
                          onChange={(e) => setCommunicationSettings({ ...communicationSettings, smtp_port: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="smtp_username">SMTP Username</Label>
                        <Input
                          id="smtp_username"
                          value={communicationSettings.smtp_username}
                          onChange={(e) => setCommunicationSettings({ ...communicationSettings, smtp_username: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="smtp_password">SMTP Password</Label>
                        <Input
                          id="smtp_password"
                          type="password"
                          value={communicationSettings.smtp_password}
                          onChange={(e) => setCommunicationSettings({ ...communicationSettings, smtp_password: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Email Signature */}
                  <div>
                    <Label htmlFor="email_signature">Email Signature</Label>
                    <Textarea
                      id="email_signature"
                      value={communicationSettings.email_signature}
                      onChange={(e) => setCommunicationSettings({ ...communicationSettings, email_signature: e.target.value })}
                      rows={4}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" className="bg-gradient-to-r from-pink-500 to-purple-600">
                      Save Communication Settings
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Locations */}
          <TabsContent value="locations">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-pink-600" />
                    Business Locations
                  </span>
                  <Button size="sm" className="bg-gradient-to-r from-pink-500 to-purple-600" onClick={openNewLocation}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Location
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockLocations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                          No locations yet. Click "Add Location" to create your first location.
                        </TableCell>
                      </TableRow>
                    ) : (
                      stockLocations.map((location) => (
                        <TableRow key={location.id}>
                          <TableCell className="font-medium">{location.name}</TableCell>
                          <TableCell className="text-muted-foreground">{location.description}</TableCell>
                          <TableCell>
                            <Select
                              value={location.default_warehouse_id ?? "__none__"}
                              onValueChange={async (val) => {
                                try {
                                  const next = val === "__none__" ? null : val
                                  await supabase
                                    .from('business_locations')
                                    .update({ default_warehouse_id: next })
                                    .eq('id', location.id);
                                  setStockLocations(prev => prev.map(l => l.id === location.id ? { ...l, default_warehouse_id: next } : l));
                                  toast.success('Default warehouse updated');
                                } catch (e) {
                                  console.error(e);
                                  toast.error('Failed to set default warehouse');
                                }
                              }}
                            >
                              <SelectTrigger className="w-56">
                                <SelectValue placeholder="Select default warehouse" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— None —</SelectItem>
                                {warehouses
                                  .filter(w => w.is_active)
                                  .map(w => (
                                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Badge variant={location.is_active ? "default" : "secondary"}>
                              {location.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button variant="ghost" size="sm" onClick={() => openEditLocation(location)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteLocation(location.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <UIDialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingLocation ? 'Edit Location' : 'Add Location'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="loc_name">Name</Label>
                        <Input id="loc_name" value={locationForm.name} onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="loc_desc">Address</Label>
                        <Textarea id="loc_desc" value={locationForm.description} onChange={(e) => setLocationForm({ ...locationForm, description: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Default Warehouse</Label>
                        <Select
                          value={locationForm.default_warehouse_id || ""}
                          onValueChange={(v) => setLocationForm(prev => ({ ...prev, default_warehouse_id: v === "__none__" ? null : v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a default warehouse (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— None —</SelectItem>
                            {warehouses.filter(w => w.is_active).map(w => (
                              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="loc_active">Active</Label>
                          <p className="text-xs text-muted-foreground">Inactive locations will be hidden in selectors</p>
                        </div>
                        <Switch id="loc_active" checked={locationForm.is_active} onCheckedChange={(checked) => setLocationForm({ ...locationForm, is_active: checked })} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsLocationDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleSaveLocation}>{editingLocation ? 'Save Changes' : 'Create Location'}</Button>
                    </DialogFooter>
                  </DialogContent>
                </UIDialog>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Warehouses */}
          <TabsContent value="warehouses">
            <Card>
              <CardHeader>
                <CardTitle>Warehouses</CardTitle>
                <CardDescription>Manage warehouses per location</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-end mb-3">
                  <div className="mr-auto space-y-2">
                    <Label>Default POS Warehouse</Label>
                    <div className="flex items-center gap-2">
                      <Select value={defaultPosWarehouseId || "__none__"} onValueChange={(v) => setDefaultPosWarehouseId(v === "__none__" ? "" : v)}>
                        <SelectTrigger className="w-72">
                          <SelectValue placeholder="Select default POS warehouse" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— None —</SelectItem>
                          {warehouses.filter(w => w.is_active).map(w => (
                            <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" onClick={handleSaveDefaultPosWarehouse}>Save</Button>
                    </div>
                  </div>
                  <Button onClick={() => { setEditingWarehouse(null); setWarehouseForm({ name: '', location_id: stockLocations[0]?.id || '', is_active: true }); setWarehouseDialogOpen(true) }} disabled={stockLocations.length === 0}>
                    <Plus className="h-4 w-4 mr-2" /> New Warehouse
                  </Button>
                </div>
                <div className="overflow-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {warehouses.map(w => (
                        <TableRow key={w.id}>
                          <TableCell>{w.name}</TableCell>
                          <TableCell>{stockLocations.find(l => l.id === w.location_id)?.name || w.location_id}</TableCell>
                          <TableCell>{w.is_active ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button size="sm" variant="outline" onClick={() => { setEditingWarehouse(w); setWarehouseForm({ id: w.id, name: w.name, location_id: w.location_id, is_active: w.is_active }); setWarehouseDialogOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteWarehouse(w.id)}><Trash2 className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <UIDialog open={warehouseDialogOpen} onOpenChange={setWarehouseDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Name</Label>
                    <Input value={warehouseForm.name} onChange={(e) => setWarehouseForm(prev => ({ ...prev, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Location</Label>
                    <Select value={warehouseForm.location_id} onValueChange={(v) => setWarehouseForm(prev => ({ ...prev, location_id: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        {stockLocations.map(l => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={warehouseForm.is_active} onCheckedChange={(v) => setWarehouseForm(prev => ({ ...prev, is_active: v }))} />
                    <span className="text-sm text-muted-foreground">Active</span>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setWarehouseDialogOpen(false)}>Cancel</Button>
                  <Button onClick={saveWarehouse}>{editingWarehouse ? 'Update' : 'Create'}</Button>
                </DialogFooter>
              </DialogContent>
            </UIDialog>
          </TabsContent>

          {/* Accounting - Default Deposit Accounts */}
          <TabsContent value="accounting">
            <Card>
              <CardHeader>
                <CardTitle>Tax Settings</CardTitle>
                <CardDescription>Set your default sales tax rate</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="tax_rate_percent">Tax Rate (%)</Label>
                    <Input
                      id="tax_rate_percent"
                      type="number"
                      step="0.01"
                      min="0"
                      value={taxRatePercent}
                      onChange={(e) => setTaxRatePercent(e.target.value)}
                      placeholder="e.g. 8.5"
                    />
                    <p className="text-xs text-muted-foreground">This rate will be used across POS, Invoices and Purchases.</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveTaxRate}>Save</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Default Deposit Accounts</CardTitle>
                <CardDescription>Map payment methods to the accounts where funds are deposited</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(["cash", "mpesa", "card", "bank_transfer"] as const).map((methodKey) => (
                  <div key={methodKey} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="md:col-span-1">
                      <Label className="text-sm capitalize">{methodKey.replace("_", " ")}</Label>
                      <div className="text-xs text-muted-foreground">Select the default account to deposit {methodKey.replace("_", " ")} payments</div>
                    </div>
                    <div className="md:col-span-2">
                      <Select value={depositAccountMap[methodKey] === undefined || depositAccountMap[methodKey] === "" ? "__none__" : depositAccountMap[methodKey]} onValueChange={(v) => setDepositAccountMap(prev => ({ ...prev, [methodKey]: v === "__none__" ? "" : v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose account" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— None (fallback to Cash/Bank) —</SelectItem>
                          {depositAccounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.account_code} · {acc.account_name}{acc.account_subtype ? ` (${acc.account_subtype})` : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
                <div className="flex justify-end">
                  <Button onClick={handleSaveDepositAccounts}>Save</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

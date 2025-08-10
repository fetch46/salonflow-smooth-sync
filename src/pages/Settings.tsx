import { useEffect, useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { usePermissions } from "@/lib/saas/hooks";
import { toast } from "sonner";
import { useOrganization } from "@/lib/saas/hooks";
import { supabase } from "@/integrations/supabase/client";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("company");

  // Company Settings State
  const [companyData, setCompanyData] = useState({
    name: "SalonSync Demo",
    address: "123 Beauty Street",
    city: "New York",
        country: "US",
phone: "+1 (555) 123-4567",
    email: "info@salonsync.demo",
    website: "www.salonsync.demo",
    tax_id: "123-45-6789",
    logo_url: "",
    timezone: "America/New_York",
    currency: "USD",
    language: "en",
  });

  const { organization, updateOrganization } = useOrganization();
  const [currencies, setCurrencies] = useState<{ id: string; code: string; name: string; symbol: string; is_active: boolean; }[]>([]);
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string>("");
  const [countries, setCountries] = useState<{ id: string; code: string; name: string; is_active: boolean }[]>([])
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>("US")

  // New: Finance Settings - Tax Rate
  const [taxRatePercent, setTaxRatePercent] = useState<string>("");

  // Users & Roles State
  const [users] = useState([
    { id: "1", name: "Admin User", email: "admin@salon.com", role: "Administrator", status: "Active", last_login: "2024-01-15" },
    { id: "2", name: "Sarah Johnson", email: "sarah@salon.com", role: "Manager", status: "Active", last_login: "2024-01-14" },
    { id: "3", name: "Mike Davis", email: "mike@salon.com", role: "Staff", status: "Active", last_login: "2024-01-13" },
  ]);

  const [roles] = useState([
    { id: "1", name: "Administrator", description: "Full access to all features", permissions: ["all"], users_count: 1 },
    { id: "2", name: "Manager", description: "Manage operations and staff", permissions: ["manage_staff", "view_reports", "manage_inventory"], users_count: 1 },
    { id: "3", name: "Staff", description: "Basic staff access", permissions: ["manage_appointments", "view_clients"], users_count: 3 },
    { id: "4", name: "Receptionist", description: "Front desk operations", permissions: ["manage_appointments", "manage_clients"], users_count: 2 },
  ]);

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
    email_signature: "Best regards,\nSalonSync Team",
    sms_provider: "twilio",
    smtp_server: "smtp.gmail.com",
    smtp_port: "587",
    smtp_username: "",
    smtp_password: "",
  });

  // Locations State
  const { hasMinimumRole } = usePermissions();
  const [locations, setLocations] = useState<Array<{ id: string; name: string; address?: string | null; phone?: string | null; manager_id?: string | null; is_active: boolean }>>([]);
  const [locDialogOpen, setLocDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<{ id?: string; name: string; address?: string | null; phone?: string | null; manager_id?: string | null; is_active: boolean }>({ name: "", address: "", phone: "", manager_id: null, is_active: true });

  const loadLocations = async () => {
    if (!organization) return;
    const { data, error } = await supabase
      .from('business_locations')
      .select('id, name, address, phone, manager_id, is_active')
      .eq('organization_id', organization.id)
      .order('name');
    if (error) {
      console.error(error);
      toast.error('Failed to load locations');
      return;
    }
    setLocations(data || []);
  };

  useEffect(() => { loadLocations(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  const openAddLocation = () => {
    setEditingLocation({ name: "", address: "", phone: "", manager_id: null, is_active: true });
    setLocDialogOpen(true);
  };
  const openEditLocation = (loc: any) => {
    setEditingLocation({ id: loc.id, name: loc.name, address: loc.address, phone: loc.phone, manager_id: loc.manager_id, is_active: !!loc.is_active });
    setLocDialogOpen(true);
  };
  const saveLocation = async () => {
    if (!organization) return toast.error('No organization');
    if (!editingLocation.name.trim()) return toast.error('Location name required');
    try {
      if (editingLocation.id) {
        const { error } = await supabase
          .from('business_locations')
          .update({
            name: editingLocation.name,
            address: editingLocation.address,
            phone: editingLocation.phone,
            manager_id: editingLocation.manager_id || null,
            is_active: editingLocation.is_active,
          })
          .eq('id', editingLocation.id);
        if (error) throw error;
        toast.success('Location updated');
      } else {
        const { error } = await supabase
          .from('business_locations')
          .insert({
            organization_id: organization.id,
            name: editingLocation.name,
            address: editingLocation.address,
            phone: editingLocation.phone,
            manager_id: editingLocation.manager_id || null,
            is_active: editingLocation.is_active,
          });
        if (error) throw error;
        toast.success('Location added');
      }
      setLocDialogOpen(false);
      await loadLocations();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save location');
    }
  };
  const deleteLocation = async (id: string) => {
    try {
      // Soft delete -> set inactive to keep historical links
      const { error } = await supabase
        .from('business_locations')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
      toast.success('Location deactivated');
      await loadLocations();
    } catch (e) {
      console.error(e);
      toast.error('Failed to deactivate location');
    }
  };

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
    })()
  }, [])

  useEffect(() => {
    if (organization) {
      const s = (organization.settings as any) || {}
      setCompanyData(prev => ({
        ...prev,
        name: organization.name || prev.name,
        address: s.address || prev.address,
        city: s.city || prev.city,
        country: s.country || prev.country,
        phone: s.phone || prev.phone,
        email: s.email || prev.email,
        website: s.website || prev.website,
        timezone: s.timezone || prev.timezone,
      }))
      setSelectedCurrencyId((organization as any).currency_id || "")
      setSelectedCountryCode(s.country || "US")
      // Initialize tax rate percent from org settings
      const tax = s.tax_rate_percent
      const parsed = typeof tax === 'number' ? tax : typeof tax === 'string' ? parseFloat(tax) : 0
      setTaxRatePercent(Number.isFinite(parsed) ? String(parsed) : "")
    }
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
          tax_rate_percent: taxRatePercent === '' ? null : parseFloat(taxRatePercent),
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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="company" className="flex items-center gap-2">
            <Building className="w-4 h-4" />
            Company
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Users & Roles
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Subscription
          </TabsTrigger>
          <TabsTrigger value="communications" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Communications
          </TabsTrigger>
          <TabsTrigger value="locations" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Locations
          </TabsTrigger>
        </TabsList>

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

                {/* Finance Settings: Tax Rate */}
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
                    <p className="text-xs text-muted-foreground">This rate will be used across POS, Invoices, Receipts and Purchases.</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit">Save Changes</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users & Roles */}
        <TabsContent value="users" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Users */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-pink-600" />
                    Users
                  </span>
                  <Button size="sm" className="bg-gradient-to-r from-pink-500 to-purple-600">
                    <Plus className="w-4 h-4 mr-1" />
                    Add User
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {getRoleIcon(user.role)}
                            <span className="text-sm">{user.role}</span>
                            {getStatusBadge(user.status)}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm">
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Roles */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-pink-600" />
                    Roles
                  </span>
                  <Button size="sm" className="bg-gradient-to-r from-pink-500 to-purple-600">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Role
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {roles.map((role) => (
                    <div key={role.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getRoleIcon(role.name)}
                          <span className="font-medium">{role.name}</span>
                          <Badge variant="outline">{role.users_count} users</Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm">
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{role.description}</p>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {role.permissions.map((permission, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {permission.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>

                      {/* Organization overrides editor */}
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Overrides for this organization</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addPermissionRow(role.name.toLowerCase())}
                          >
                            Add Permission
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {(roleOverrides[role.name.toLowerCase()] || []).map((row, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                              <div className="col-span-5">
                                <Select
                                  value={row.action}
                                  onValueChange={(v) => updatePermissionRow(role.name.toLowerCase(), idx, 'action', v)}
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
                                  onChange={(e) => updatePermissionRow(role.name.toLowerCase(), idx, 'resource', e.target.value)}
                                  placeholder="Resource e.g. appointments, job_cards"
                                />
                              </div>
                              <div className="col-span-1 flex justify-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removePermissionRow(role.name.toLowerCase(), idx)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-4">
                  <Button onClick={saveRoleOverrides}>Save Role Permissions</Button>
                </div>
              </CardContent>
            </Card>
          </div>
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
                {hasMinimumRole('owner') && (
                  <Button className="bg-gradient-to-r from-pink-500 to-purple-600" onClick={openAddLocation}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Location
                  </Button>
                )}
              </CardTitle>
              <CardDescription>
                Manage your business locations and branches
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.map((location) => (
                    <TableRow key={location.id}>
                      <TableCell className="font-medium">{location.name}</TableCell>
                      <TableCell>{location.address || ''}</TableCell>
                      <TableCell>{location.phone || ''}</TableCell>
                      <TableCell>{getStatusBadge(location.is_active ? 'Active' : 'Inactive')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {hasMinimumRole('owner') && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => openEditLocation(location)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteLocation(location.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Dialog open={locDialogOpen} onOpenChange={setLocDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingLocation.id ? 'Edit Location' : 'Add Location'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="loc_name">Name</Label>
                  <Input id="loc_name" value={editingLocation.name} onChange={(e) => setEditingLocation({ ...editingLocation, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loc_address">Address</Label>
                  <Input id="loc_address" value={editingLocation.address || ''} onChange={(e) => setEditingLocation({ ...editingLocation, address: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loc_phone">Phone</Label>
                  <Input id="loc_phone" value={editingLocation.phone || ''} onChange={(e) => setEditingLocation({ ...editingLocation, phone: e.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="loc_active" checked={editingLocation.is_active} onCheckedChange={(v) => setEditingLocation({ ...editingLocation, is_active: v })} />
                  <Label htmlFor="loc_active">Active</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLocDialogOpen(false)}>Cancel</Button>
                <Button onClick={saveLocation}>{editingLocation.id ? 'Save Changes' : 'Create Location'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
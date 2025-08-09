import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building, Plus, Edit, Trash2, Search, Users, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";

interface Organization {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  logo_url?: string;
  status: string;
  settings: any;
  metadata: any;
  created_at: string;
  updated_at: string;
  user_count?: number;
  subscription_status?: string;
  plan_name?: string;
}

interface NewOrganization {
  name: string;
  slug: string;
  domain?: string;
  logo_url?: string;
  status: string;
  settings: string;
  metadata: string;
  plan_id?: string;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  price_yearly: number;
}

const AdminOrganizations = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [newOrganization, setNewOrganization] = useState<NewOrganization>({
    name: "",
    slug: "",
    domain: "",
    logo_url: "",
    status: "active",
    settings: "{}",
    metadata: "{}",
    plan_id: ""
  });
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isManageSubDialogOpen, setIsManageSubDialogOpen] = useState(false);
  const [selectedOrgForSub, setSelectedOrgForSub] = useState<Organization | null>(null);
  const [subForm, setSubForm] = useState<{ sub_id?: string; plan_id: string; status: string; interval: string; exists: boolean }>({ plan_id: "", status: "trial", interval: "month", exists: false });

  useEffect(() => {
    fetchOrganizations();
    fetchPlans();
  }, []);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      
      // Get organizations with user count and subscription info
      const { data, error } = await supabase
        .from('organizations')
        .select(`
          *,
          organization_users(count),
          organization_subscriptions(
            status,
            subscription_plans(name)
          )
        `);

      if (error) throw error;

      // Transform data to include calculated fields
      const transformedData = data?.map(org => ({
        ...org,
        user_count: org.organization_users?.[0]?.count || 0,
        subscription_status: org.organization_subscriptions?.[0]?.status || 'none',
        plan_name: org.organization_subscriptions?.[0]?.subscription_plans?.name || 'No Plan'
      })) || [];

      setOrganizations(transformedData);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      toast.error('Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, slug, price_monthly, price_yearly')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to fetch subscription plans');
    }
  };

  const createOrganization = async () => {
    try {
      let settings, metadata;
      try {
        settings = JSON.parse(newOrganization.settings || '{}');
        metadata = JSON.parse(newOrganization.metadata || '{}');
      } catch (e) {
        toast.error('Invalid JSON in settings or metadata');
        return;
      }

      const slug = (newOrganization.slug || newOrganization.name)
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      // Use RPC to also add the current user as owner so the org is visible via RLS
      const { data: newOrgId, error } = await supabase.rpc('create_organization_with_user', {
        org_name: newOrganization.name,
        org_slug: slug,
        org_settings: settings,
        plan_id: newOrganization.plan_id || null,
      });

      if (error) throw error;

      // Note: Additional fields (domain, logo_url, status, metadata) may require elevated permissions to update.
      // We skip updating them here to avoid RLS failures.

      toast.success('Organization created successfully');
      setIsCreateDialogOpen(false);
      setNewOrganization({
        name: '',
        slug: '',
        domain: '',
        logo_url: '',
        status: 'active',
        settings: '{}',
        metadata: '{}',
        plan_id: '',
      });
      fetchOrganizations();
    } catch (error: any) {
      console.error('Error creating organization:', error);
      toast.error(error?.message || 'Failed to create organization');
    }
  };

  const updateOrganization = async () => {
    if (!selectedOrganization) return;

    try {
      let settings, metadata;
      try {
        settings = JSON.parse(newOrganization.settings);
        metadata = JSON.parse(newOrganization.metadata);
      } catch (e) {
        toast.error('Invalid JSON in settings or metadata');
        return;
      }

      const { error } = await supabase
        .from('organizations')
        .update({
          name: newOrganization.name,
          slug: newOrganization.slug,
          domain: newOrganization.domain || null,
          logo_url: newOrganization.logo_url || null,
          status: newOrganization.status,
          settings,
          metadata
        })
        .eq('id', selectedOrganization.id);

      if (error) throw error;

      toast.success('Organization updated successfully');
      setIsEditDialogOpen(false);
      setSelectedOrganization(null);
      fetchOrganizations();
    } catch (error) {
      console.error('Error updating organization:', error);
      toast.error('Failed to update organization');
    }
  };

  const deleteOrganization = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete organization "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Organization deleted successfully');
      fetchOrganizations();
    } catch (error) {
      console.error('Error deleting organization:', error);
      toast.error('Failed to delete organization');
    }
  };

  const openEditDialog = (organization: Organization) => {
    setSelectedOrganization(organization);
    setNewOrganization({
      name: organization.name,
      slug: organization.slug,
      domain: organization.domain || "",
      logo_url: organization.logo_url || "",
      status: organization.status,
      settings: JSON.stringify(organization.settings, null, 2),
      metadata: JSON.stringify(organization.metadata, null, 2)
    });
    setIsEditDialogOpen(true);
  };

  const openManageSubscriptionDialog = async (organization: Organization) => {
    setSelectedOrgForSub(organization);
    setIsManageSubDialogOpen(true);
    try {
      const { data, error } = await supabase
        .from('organization_subscriptions')
        .select('id, plan_id, status, interval')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSubForm({
          sub_id: data.id,
          plan_id: data.plan_id || '',
          status: (data as any).status || 'trial',
          interval: (data as any).interval || 'month',
          exists: true,
        });
      } else {
        setSubForm({ plan_id: '', status: 'trial', interval: 'month', exists: false });
      }
    } catch (err) {
      console.error('Error loading subscription:', err);
      setSubForm({ plan_id: '', status: 'trial', interval: 'month', exists: false });
    }
  };

  const saveOrganizationSubscription = async () => {
    if (!selectedOrgForSub) return;
    if (!subForm.plan_id) { toast.error('Please select a plan'); return; }
    try {
      if (subForm.exists && subForm.sub_id) {
        const { error } = await supabase
          .from('organization_subscriptions')
          .update({ plan_id: subForm.plan_id, status: subForm.status, interval: subForm.interval })
          .eq('id', subForm.sub_id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('organization_subscriptions')
          .insert([{ organization_id: selectedOrgForSub.id, plan_id: subForm.plan_id, status: subForm.status, interval: subForm.interval }]);
        if (error) throw error;
      }
      toast.success('Subscription saved');
      setIsManageSubDialogOpen(false);
      setSelectedOrgForSub(null);
      fetchOrganizations();
    } catch (err) {
      console.error('Error saving subscription:', err);
      toast.error('Failed to save subscription');
    }
  };

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.domain?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const statusColors = {
      active: "bg-green-100 text-green-800",
      suspended: "bg-yellow-100 text-yellow-800",
      deleted: "bg-red-100 text-red-800"
    };
    return statusColors[status as keyof typeof statusColors] || "bg-gray-100 text-gray-800";
  };

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Organizations</h1>
            <p className="text-gray-500 mt-1">Manage all organizations in the system</p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Organization
          </Button>
        </div>

        {/* Search and Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="md:col-span-2">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search organizations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Building className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{organizations.length}</p>
                  <p className="text-sm text-gray-500">Total Organizations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {organizations.reduce((sum, org) => sum + (org.user_count || 0), 0)}
                  </p>
                  <p className="text-sm text-gray-500">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Organizations Table */}
        <Card>
          <CardHeader>
            <CardTitle>Organizations</CardTitle>
            <CardDescription>
              A list of all organizations in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Subscription</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrganizations.map((organization) => (
                    <TableRow key={organization.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          {organization.logo_url && (
                            <img 
                              src={organization.logo_url} 
                              alt="" 
                              className="h-6 w-6 rounded"
                            />
                          )}
                          <span>{organization.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{organization.slug}</TableCell>
                      <TableCell>{organization.domain || '-'}</TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(organization.status)}>
                          {organization.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{organization.user_count || 0}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {organization.plan_name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(organization.created_at), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openManageSubscriptionDialog(organization)}
                            title="Manage subscription"
                          >
                            <CreditCard className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(organization)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteOrganization(organization.id, organization.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create Organization Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Organization</DialogTitle>
              <DialogDescription>
                Add a new organization to the system.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={newOrganization.name}
                    onChange={(e) => setNewOrganization({...newOrganization, name: e.target.value})}
                    placeholder="Organization name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={newOrganization.slug}
                    onChange={(e) => setNewOrganization({...newOrganization, slug: e.target.value})}
                    placeholder="organization-slug"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain (optional)</Label>
                  <Input
                    id="domain"
                    value={newOrganization.domain}
                    onChange={(e) => setNewOrganization({...newOrganization, domain: e.target.value})}
                    placeholder="example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={newOrganization.status} 
                    onValueChange={(value) => setNewOrganization({...newOrganization, status: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="deleted">Deleted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan">Subscription Plan (optional)</Label>
                <Select
                  value={newOrganization.plan_id || undefined}
                  onValueChange={(value) =>
                    setNewOrganization({
                      ...newOrganization,
                      plan_id: value === 'none' ? '' : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a plan (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No plan</SelectItem>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — ${Math.round(p.price_monthly / 100)}/mo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo_url">Logo URL (optional)</Label>
                <Input
                  id="logo_url"
                  value={newOrganization.logo_url}
                  onChange={(e) => setNewOrganization({...newOrganization, logo_url: e.target.value})}
                  placeholder="https://example.com/logo.png"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createOrganization}>
                Create Organization
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Organization Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Edit Organization</DialogTitle>
              <DialogDescription>
                Update organization details.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    value={newOrganization.name}
                    onChange={(e) => setNewOrganization({...newOrganization, name: e.target.value})}
                    placeholder="Organization name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-slug">Slug</Label>
                  <Input
                    id="edit-slug"
                    value={newOrganization.slug}
                    onChange={(e) => setNewOrganization({...newOrganization, slug: e.target.value})}
                    placeholder="organization-slug"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-domain">Domain (optional)</Label>
                  <Input
                    id="edit-domain"
                    value={newOrganization.domain}
                    onChange={(e) => setNewOrganization({...newOrganization, domain: e.target.value})}
                    placeholder="example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select 
                    value={newOrganization.status} 
                    onValueChange={(value) => setNewOrganization({...newOrganization, status: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="deleted">Deleted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-logo_url">Logo URL (optional)</Label>
                <Input
                  id="edit-logo_url"
                  value={newOrganization.logo_url}
                  onChange={(e) => setNewOrganization({...newOrganization, logo_url: e.target.value})}
                  placeholder="https://example.com/logo.png"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-settings">Settings (JSON)</Label>
                <Textarea
                  id="edit-settings"
                  value={newOrganization.settings}
                  onChange={(e) => setNewOrganization({...newOrganization, settings: e.target.value})}
                  placeholder="{}"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-metadata">Metadata (JSON)</Label>
                <Textarea
                  id="edit-metadata"
                  value={newOrganization.metadata}
                  onChange={(e) => setNewOrganization({...newOrganization, metadata: e.target.value})}
                  placeholder="{}"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={updateOrganization}>
                Update Organization
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Manage Subscription Dialog */}
        <Dialog open={isManageSubDialogOpen} onOpenChange={setIsManageSubDialogOpen}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Manage Subscription{selectedOrgForSub ? ` — ${selectedOrgForSub.name}` : ''}</DialogTitle>
              <DialogDescription>
                Assign or update the subscription plan for this organization.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="sub-plan">Plan</Label>
                <Select
                  value={subForm.plan_id}
                  onValueChange={(value) => setSubForm({ ...subForm, plan_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — ${Math.round(p.price_monthly / 100)}/mo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sub-status">Status</Label>
                  <Select
                    value={subForm.status}
                    onValueChange={(value) => setSubForm({ ...subForm, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="canceled">Canceled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sub-interval">Billing Interval</Label>
                  <Select
                    value={subForm.interval}
                    onValueChange={(value) => setSubForm({ ...subForm, interval: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Monthly</SelectItem>
                      <SelectItem value="year">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsManageSubDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveOrganizationSubscription}>
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SuperAdminLayout>
  );
};

export default AdminOrganizations;
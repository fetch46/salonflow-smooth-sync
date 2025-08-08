import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CreditCard, Plus, Edit, Trash2, Search, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";
import { FEATURE_CATEGORIES, FEATURE_LABELS } from "@/lib/features";

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price_monthly: number;
  price_yearly: number;
  max_users?: number;
  max_locations?: number;
  features: any;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  subscription_count?: number;
}

interface NewSubscriptionPlan {
  name: string;
  slug: string;
  description: string;
  price_monthly: string;
  price_yearly: string;
  max_users: string;
  max_locations: string;
  features: string;
  is_active: boolean;
  sort_order: string;
}

const AdminSubscriptionPlans = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [newPlan, setNewPlan] = useState<NewSubscriptionPlan>({
    name: "",
    slug: "",
    description: "",
    price_monthly: "",
    price_yearly: "",
    max_users: "",
    max_locations: "",
    features: "{}",
    is_active: true,
    sort_order: "0"
  });

  // Feature toggles helpers
  const allFeatureKeys = (Object.values(FEATURE_CATEGORIES) as any[]).flatMap((c: any) => c.features);
  const getFeaturesObj = () => {
    try {
      const parsed = JSON.parse(newPlan.features || '{}') || {};
      const obj: Record<string, boolean> = {};
      allFeatureKeys.forEach((k: string) => { obj[k] = Boolean((parsed as any)[k]); });
      return obj;
    } catch {
      const obj: Record<string, boolean> = {};
      allFeatureKeys.forEach((k: string) => { obj[k] = false; });
      return obj;
    }
  };
  const handleFeatureToggle = (key: string, checked: boolean) => {
    const current = getFeaturesObj();
    const next = { ...current, [key]: checked } as Record<string, boolean>;
    setNewPlan({ ...newPlan, features: JSON.stringify(next, null, 2) });
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      
      // Get subscription plans with subscription count
      const { data, error } = await supabase
        .from('subscription_plans')
        .select(`
          *,
          organization_subscriptions(count)
        `)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      // Transform data to include subscription count
      const transformedData = data?.map(plan => ({
        ...plan,
        subscription_count: plan.organization_subscriptions?.[0]?.count || 0
      })) || [];

      setPlans(transformedData);
    } catch (error) {
      console.error('Error fetching subscription plans:', error);
      toast.error('Failed to fetch subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const createPlan = async () => {
    try {
      let features;
      try {
        features = JSON.parse(newPlan.features);
      } catch (e) {
        toast.error('Invalid JSON in features');
        return;
      }

      const { error } = await supabase
        .from('subscription_plans')
        .insert([{
          name: newPlan.name,
          slug: newPlan.slug,
          description: newPlan.description || null,
          price_monthly: parseInt(newPlan.price_monthly),
          price_yearly: parseInt(newPlan.price_yearly),
          max_users: newPlan.max_users ? parseInt(newPlan.max_users) : null,
          max_locations: newPlan.max_locations ? parseInt(newPlan.max_locations) : null,
          features,
          is_active: newPlan.is_active,
          sort_order: parseInt(newPlan.sort_order)
        }]);

      if (error) throw error;

      toast.success('Subscription plan created successfully');
      setIsCreateDialogOpen(false);
      resetForm();
      fetchPlans();
    } catch (error) {
      console.error('Error creating subscription plan:', error);
      toast.error('Failed to create subscription plan');
    }
  };

  const updatePlan = async () => {
    if (!selectedPlan) return;

    try {
      let features;
      try {
        features = JSON.parse(newPlan.features);
      } catch (e) {
        toast.error('Invalid JSON in features');
        return;
      }

      const { error } = await supabase
        .from('subscription_plans')
        .update({
          name: newPlan.name,
          slug: newPlan.slug,
          description: newPlan.description || null,
          price_monthly: parseInt(newPlan.price_monthly),
          price_yearly: parseInt(newPlan.price_yearly),
          max_users: newPlan.max_users ? parseInt(newPlan.max_users) : null,
          max_locations: newPlan.max_locations ? parseInt(newPlan.max_locations) : null,
          features,
          is_active: newPlan.is_active,
          sort_order: parseInt(newPlan.sort_order)
        })
        .eq('id', selectedPlan.id);

      if (error) throw error;

      toast.success('Subscription plan updated successfully');
      setIsEditDialogOpen(false);
      setSelectedPlan(null);
      fetchPlans();
    } catch (error) {
      console.error('Error updating subscription plan:', error);
      toast.error('Failed to update subscription plan');
    }
  };

  const deletePlan = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete plan "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Subscription plan deleted successfully');
      fetchPlans();
    } catch (error) {
      console.error('Error deleting subscription plan:', error);
      toast.error('Failed to delete subscription plan');
    }
  };

  const openEditDialog = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setNewPlan({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || "",
      price_monthly: plan.price_monthly.toString(),
      price_yearly: plan.price_yearly.toString(),
      max_users: plan.max_users?.toString() || "",
      max_locations: plan.max_locations?.toString() || "",
      features: JSON.stringify(plan.features, null, 2),
      is_active: plan.is_active,
      sort_order: plan.sort_order.toString()
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setNewPlan({
      name: "",
      slug: "",
      description: "",
      price_monthly: "",
      price_yearly: "",
      max_users: "",
      max_locations: "",
      features: "{}",
      is_active: true,
      sort_order: "0"
    });
  };

  const filteredPlans = plans.filter(plan =>
    plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatPrice = (priceInCents: number) => {
    return `$${(priceInCents / 100).toFixed(2)}`;
  };

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Subscription Plans</h1>
            <p className="text-gray-500 mt-1">Manage subscription plans and pricing</p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Plan
          </Button>
        </div>

        {/* Search and Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="md:col-span-2">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search plans..."
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
                <CreditCard className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{plans.length}</p>
                  <p className="text-sm text-gray-500">Total Plans</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {plans.reduce((sum, plan) => sum + (plan.subscription_count || 0), 0)}
                  </p>
                  <p className="text-sm text-gray-500">Active Subscriptions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Plans Table */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Plans</CardTitle>
            <CardDescription>
              A list of all subscription plans in the system
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
                    <TableHead>Monthly Price</TableHead>
                    <TableHead>Yearly Price</TableHead>
                    <TableHead>Max Users</TableHead>
                    <TableHead>Max Locations</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Subscriptions</TableHead>
                    <TableHead>Sort Order</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-semibold">{plan.name}</div>
                          <div className="text-sm text-gray-500">{plan.slug}</div>
                        </div>
                      </TableCell>
                      <TableCell>{formatPrice(plan.price_monthly)}</TableCell>
                      <TableCell>{formatPrice(plan.price_yearly)}</TableCell>
                      <TableCell>{plan.max_users || 'Unlimited'}</TableCell>
                      <TableCell>{plan.max_locations || 'Unlimited'}</TableCell>
                      <TableCell>
                        <Badge 
                          className={plan.is_active 
                            ? "bg-green-100 text-green-800" 
                            : "bg-red-100 text-red-800"
                          }
                        >
                          {plan.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{plan.subscription_count || 0}</TableCell>
                      <TableCell>{plan.sort_order}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(plan)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deletePlan(plan.id, plan.name)}
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

        {/* Create Plan Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Subscription Plan</DialogTitle>
              <DialogDescription>
                Add a new subscription plan to the system.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Plan Name</Label>
                  <Input
                    id="name"
                    value={newPlan.name}
                    onChange={(e) => setNewPlan({...newPlan, name: e.target.value})}
                    placeholder="Professional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={newPlan.slug}
                    onChange={(e) => setNewPlan({...newPlan, slug: e.target.value})}
                    placeholder="professional"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newPlan.description}
                  onChange={(e) => setNewPlan({...newPlan, description: e.target.value})}
                  placeholder="For growing businesses with advanced needs"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price_monthly">Monthly Price (cents)</Label>
                  <Input
                    id="price_monthly"
                    type="number"
                    value={newPlan.price_monthly}
                    onChange={(e) => setNewPlan({...newPlan, price_monthly: e.target.value})}
                    placeholder="2900"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price_yearly">Yearly Price (cents)</Label>
                  <Input
                    id="price_yearly"
                    type="number"
                    value={newPlan.price_yearly}
                    onChange={(e) => setNewPlan({...newPlan, price_yearly: e.target.value})}
                    placeholder="29000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max_users">Max Users</Label>
                  <Input
                    id="max_users"
                    type="number"
                    value={newPlan.max_users}
                    onChange={(e) => setNewPlan({...newPlan, max_users: e.target.value})}
                    placeholder="25"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_locations">Max Locations</Label>
                  <Input
                    id="max_locations"
                    type="number"
                    value={newPlan.max_locations}
                    onChange={(e) => setNewPlan({...newPlan, max_locations: e.target.value})}
                    placeholder="3"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sort_order">Sort Order</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    value={newPlan.sort_order}
                    onChange={(e) => setNewPlan({...newPlan, sort_order: e.target.value})}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={newPlan.is_active}
                  onCheckedChange={(checked) => setNewPlan({...newPlan, is_active: checked})}
                />
                <Label htmlFor="is_active">Active Plan</Label>
              </div>
              <div className="space-y-2">
                <Label>Features</Label>
                {(() => {
                  const featuresObj = getFeaturesObj();
                  return (
                    <div className="space-y-4">
                      {Object.entries(FEATURE_CATEGORIES as any).map(([catKey, cat]: any) => (
                        <div key={catKey} className="border rounded-md p-3">
                          <div className="font-medium mb-2">{cat.label}</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {cat.features.map((feat: string) => (
                              <div key={feat} className="flex items-center justify-between">
                                <span className="text-sm">{FEATURE_LABELS[feat] || feat}</span>
                                <Switch
                                  checked={!!featuresObj[feat]}
                                  onCheckedChange={(val) => handleFeatureToggle(feat, !!val)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createPlan}>
                Create Plan
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Plan Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Subscription Plan</DialogTitle>
              <DialogDescription>
                Update subscription plan details.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Plan Name</Label>
                  <Input
                    id="edit-name"
                    value={newPlan.name}
                    onChange={(e) => setNewPlan({...newPlan, name: e.target.value})}
                    placeholder="Professional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-slug">Slug</Label>
                  <Input
                    id="edit-slug"
                    value={newPlan.slug}
                    onChange={(e) => setNewPlan({...newPlan, slug: e.target.value})}
                    placeholder="professional"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={newPlan.description}
                  onChange={(e) => setNewPlan({...newPlan, description: e.target.value})}
                  placeholder="For growing businesses with advanced needs"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-price_monthly">Monthly Price (cents)</Label>
                  <Input
                    id="edit-price_monthly"
                    type="number"
                    value={newPlan.price_monthly}
                    onChange={(e) => setNewPlan({...newPlan, price_monthly: e.target.value})}
                    placeholder="2900"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-price_yearly">Yearly Price (cents)</Label>
                  <Input
                    id="edit-price_yearly"
                    type="number"
                    value={newPlan.price_yearly}
                    onChange={(e) => setNewPlan({...newPlan, price_yearly: e.target.value})}
                    placeholder="29000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-max_users">Max Users</Label>
                  <Input
                    id="edit-max_users"
                    type="number"
                    value={newPlan.max_users}
                    onChange={(e) => setNewPlan({...newPlan, max_users: e.target.value})}
                    placeholder="25"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-max_locations">Max Locations</Label>
                  <Input
                    id="edit-max_locations"
                    type="number"
                    value={newPlan.max_locations}
                    onChange={(e) => setNewPlan({...newPlan, max_locations: e.target.value})}
                    placeholder="3"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-sort_order">Sort Order</Label>
                  <Input
                    id="edit-sort_order"
                    type="number"
                    value={newPlan.sort_order}
                    onChange={(e) => setNewPlan({...newPlan, sort_order: e.target.value})}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-is_active"
                  checked={newPlan.is_active}
                  onCheckedChange={(checked) => setNewPlan({...newPlan, is_active: checked})}
                />
                <Label htmlFor="edit-is_active">Active Plan</Label>
              </div>
              <div className="space-y-2">
                <Label>Features</Label>
                {(() => {
                  const featuresObj = getFeaturesObj();
                  return (
                    <div className="space-y-4">
                      {Object.entries(FEATURE_CATEGORIES as any).map(([catKey, cat]: any) => (
                        <div key={catKey} className="border rounded-md p-3">
                          <div className="font-medium mb-2">{cat.label}</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {cat.features.map((feat: string) => (
                              <div key={feat} className="flex items-center justify-between">
                                <span className="text-sm">{FEATURE_LABELS[feat] || feat}</span>
                                <Switch
                                  checked={!!featuresObj[feat]}
                                  onCheckedChange={(val) => handleFeatureToggle(feat, !!val)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={updatePlan}>
                Update Plan
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SuperAdminLayout>
  );
};

export default AdminSubscriptionPlans;
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Users, Building, CreditCard, UserPlus, UserX, Search, Eye, Plus, Settings, BarChart3, Activity } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Organization {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  user_count: number;
  subscription_status: string;
  plan_name: string;
  domain?: string;
  logo_url?: string;
}

interface SuperAdmin {
  id: string;
  user_id: string;
  granted_by: string | null;
  granted_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
}

interface NewOrganization {
  name: string;
  slug: string;
  domain: string;
  settings: any;
}

export default function SuperAdmin() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [superAdmins, setSuperAdmins] = useState<SuperAdmin[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [selectedUserEmail, setSelectedUserEmail] = useState("");
  const [newOrg, setNewOrg] = useState<NewOrganization>({
    name: "",
    slug: "",
    domain: "",
    settings: {}
  });
  const [stats, setStats] = useState({
    totalOrgs: 0,
    activeSubscriptions: 0,
    trialSubscriptions: 0,
    totalUsers: 0,
    recentOrgs: 0,
    activeSuperAdmins: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch organizations with subscription data
      const { data: orgsData } = await supabase
        .from('organizations')
        .select(`
          *,
          organization_subscriptions (
            status,
            subscription_plans (name)
          ),
          organization_users (
            id
          )
        `)
        .order('created_at', { ascending: false });

      // Fetch super admins
      const { data: superAdminData } = await supabase
        .from('super_admins')
        .select('*')
        .order('granted_at', { ascending: false });

      // Fetch user profiles for additional user info
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, email, full_name, created_at')
        .order('created_at', { ascending: false });

      if (orgsData) {
        const formattedOrgs = orgsData.map(org => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          status: org.status,
          created_at: org.created_at,
          domain: org.domain,
          logo_url: org.logo_url,
          user_count: Array.isArray(org.organization_users) ? org.organization_users.length : 0,
          subscription_status: Array.isArray(org.organization_subscriptions) 
            ? org.organization_subscriptions[0]?.status || 'none'
            : 'none',
          plan_name: Array.isArray(org.organization_subscriptions) 
            ? org.organization_subscriptions[0]?.subscription_plans?.name || 'No Plan'
            : 'No Plan'
        }));
        setOrganizations(formattedOrgs);

        // Calculate stats
        const activeSubscriptions = formattedOrgs.filter(org => org.subscription_status === 'active').length;
        const trialSubscriptions = formattedOrgs.filter(org => org.subscription_status === 'trial').length;
        const recentOrgs = formattedOrgs.filter(org => {
          const createdDate = new Date(org.created_at);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return createdDate > thirtyDaysAgo;
        }).length;
        
        setStats({
          totalOrgs: formattedOrgs.length,
          activeSubscriptions,
          trialSubscriptions,
          totalUsers: profilesData?.length || 0,
          recentOrgs,
          activeSuperAdmins: superAdminData?.filter(admin => admin.is_active).length || 0
        });
      }

      if (superAdminData) {
        setSuperAdmins(superAdminData);
      }

      if (profilesData) {
        const formattedUsers = profilesData.map(profile => ({
          id: profile.user_id,
          email: profile.email || 'No email',
          created_at: profile.created_at,
          last_sign_in_at: profile.created_at // Using created_at as placeholder
        }));
        setUsers(formattedUsers);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleGrantSuperAdmin = async () => {
    if (!selectedUserEmail) {
      toast.error('Please enter a user email');
      return;
    }

    try {
      // Find user by email in profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', selectedUserEmail)
        .single();

      if (!profile) {
        toast.error('User not found');
        return;
      }

      const { error } = await supabase.rpc('grant_super_admin', {
        target_user_id: profile.user_id
      });

      if (error) throw error;

      toast.success('Super admin privileges granted successfully');
      setIsGrantModalOpen(false);
      setSelectedUserEmail('');
      fetchData();
    } catch (error) {
      console.error('Error granting super admin:', error);
      toast.error('Failed to grant super admin privileges');
    }
  };

  const handleRevokeSuperAdmin = async (userId: string) => {
    if (!confirm('Are you sure you want to revoke super admin privileges?')) return;

    try {
      const { error } = await supabase.rpc('revoke_super_admin', {
        target_user_id: userId
      });

      if (error) throw error;

      toast.success('Super admin privileges revoked successfully');
      fetchData();
    } catch (error) {
      console.error('Error revoking super admin:', error);
      toast.error('Failed to revoke super admin privileges');
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleCreateOrganization = async () => {
    if (!newOrg.name) {
      toast.error('Organization name is required');
      return;
    }

    try {
      const slug = newOrg.slug || generateSlug(newOrg.name);
      
      const { data, error } = await supabase.rpc('create_organization_with_user', {
        org_name: newOrg.name,
        org_slug: slug,
        org_settings: {
          domain: newOrg.domain,
          ...newOrg.settings
        },
        plan_id: null
      });

      if (error) throw error;

      toast.success('Organization created successfully');
      setIsOrgModalOpen(false);
      setNewOrg({ name: "", slug: "", domain: "", settings: {} });
      fetchData();
    } catch (error) {
      console.error('Error creating organization:', error);
      toast.error('Failed to create organization');
    }
  };

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (org.domain && org.domain.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Super Admin
          </h1>
          <p className="text-muted-foreground text-lg">
            Comprehensive system administration and management
          </p>
        </div>
        <div className="flex gap-3">
          <Dialog open={isOrgModalOpen} onOpenChange={setIsOrgModalOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Organization
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Organization</DialogTitle>
                <DialogDescription>
                  Add a new organization to the system
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="orgName">Organization Name *</Label>
                  <Input
                    id="orgName"
                    value={newOrg.name}
                    onChange={(e) => setNewOrg(prev => ({ 
                      ...prev, 
                      name: e.target.value,
                      slug: prev.slug || generateSlug(e.target.value)
                    }))}
                    placeholder="Acme Corporation"
                  />
                </div>
                <div>
                  <Label htmlFor="orgSlug">Slug</Label>
                  <Input
                    id="orgSlug"
                    value={newOrg.slug}
                    onChange={(e) => setNewOrg(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="acme-corp"
                  />
                </div>
                <div>
                  <Label htmlFor="orgDomain">Domain (Optional)</Label>
                  <Input
                    id="orgDomain"
                    value={newOrg.domain}
                    onChange={(e) => setNewOrg(prev => ({ ...prev, domain: e.target.value }))}
                    placeholder="acme.com"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsOrgModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateOrganization}>
                    Create Organization
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isGrantModalOpen} onOpenChange={setIsGrantModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="lg">
                <UserPlus className="h-4 w-4 mr-2" />
                Grant Super Admin
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Grant Super Admin Privileges</DialogTitle>
                <DialogDescription>
                  Enter the email address of the user you want to grant super admin privileges to.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="userEmail">User Email</Label>
                  <Input
                    id="userEmail"
                    type="email"
                    value={selectedUserEmail}
                    onChange={(e) => setSelectedUserEmail(e.target.value)}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsGrantModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleGrantSuperAdmin}>
                    Grant Privileges
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Dashboard */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 dark:from-blue-950 dark:to-blue-900 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
            <Building className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.totalOrgs}</div>
            <p className="text-xs text-blue-600 dark:text-blue-400">Total registered</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 dark:from-green-950 dark:to-green-900 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
            <CreditCard className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.activeSubscriptions}</div>
            <p className="text-xs text-green-600 dark:text-green-400">Paying customers</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 dark:from-yellow-950 dark:to-yellow-900 dark:border-yellow-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trial Users</CardTitle>
            <Activity className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{stats.trialSubscriptions}</div>
            <p className="text-xs text-yellow-600 dark:text-yellow-400">In trial period</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 dark:from-purple-950 dark:to-purple-900 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{stats.totalUsers}</div>
            <p className="text-xs text-purple-600 dark:text-purple-400">Registered accounts</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 dark:from-orange-950 dark:to-orange-900 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Orgs</CardTitle>
            <BarChart3 className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{stats.recentOrgs}</div>
            <p className="text-xs text-orange-600 dark:text-orange-400">Last 30 days</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200 dark:from-red-950 dark:to-red-900 dark:border-red-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Super Admins</CardTitle>
            <Shield className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">{stats.activeSuperAdmins}</div>
            <p className="text-xs text-red-600 dark:text-red-400">Active admins</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="organizations" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="organizations" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Organizations
          </TabsTrigger>
          <TabsTrigger value="admins" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Super Admins
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            All Users
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organizations" className="space-y-6">
          {/* Organizations Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Organizations Management</CardTitle>
                  <CardDescription>
                    Manage all organizations in the system
                  </CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search organizations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-80"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Subscription</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrganizations.map((org) => (
                      <TableRow key={org.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {org.logo_url ? (
                              <img src={org.logo_url} alt={org.name} className="h-8 w-8 rounded-full object-cover" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                                {org.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-medium">{org.name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-sm bg-muted px-1.5 py-0.5 rounded">{org.slug}</code>
                        </TableCell>
                        <TableCell>
                          {org.domain ? (
                            <Badge variant="outline">{org.domain}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={org.status === 'active' ? 'default' : 'secondary'}>
                            {org.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            org.subscription_status === 'active' ? 'default' :
                            org.subscription_status === 'trial' ? 'secondary' : 'outline'
                          }>
                            {org.subscription_status}
                          </Badge>
                        </TableCell>
                        <TableCell>{org.plan_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{org.user_count}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(org.created_at), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Settings className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admins" className="space-y-6">
          {/* Super Admins Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Shield className="h-5 w-5" />
                Super Administrators
              </CardTitle>
              <CardDescription>
                Manage users with super admin privileges
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Granted At</TableHead>
                      <TableHead>Granted By</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {superAdmins.map((admin) => (
                      <TableRow key={admin.id} className="hover:bg-muted/50">
                        <TableCell>
                          <code className="text-sm bg-muted px-1.5 py-0.5 rounded">{admin.user_id}</code>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(admin.granted_at), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
                            {admin.granted_by || 'System'}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant={admin.is_active ? 'default' : 'secondary'}>
                            {admin.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {admin.is_active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevokeSuperAdmin(admin.user_id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          {/* Users Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">All Users</CardTitle>
                  <CardDescription>
                    View all registered users in the system
                  </CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-80"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Sign In</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.slice(0, 50).map((user) => (
                      <TableRow key={user.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>
                          <code className="text-sm bg-muted px-1.5 py-0.5 rounded">{user.id}</code>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(user.created_at), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.last_sign_in_at ? format(new Date(user.last_sign_in_at), 'MMM dd, yyyy') : 'Never'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filteredUsers.length > 50 && (
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  Showing first 50 users. Use search to find specific users.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
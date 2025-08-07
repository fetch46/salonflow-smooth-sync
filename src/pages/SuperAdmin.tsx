import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Shield, Users, Building, CreditCard, UserPlus, UserX, Search, Eye, Plus } from "lucide-react";
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

export default function SuperAdmin() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [superAdmins, setSuperAdmins] = useState<SuperAdmin[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [selectedUserEmail, setSelectedUserEmail] = useState("");
  const [stats, setStats] = useState({
    totalOrgs: 0,
    activeSubscriptions: 0,
    trialSubscriptions: 0,
    totalUsers: 0
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
          )
        `)
        .order('created_at', { ascending: false });

      // Fetch super admins
      const { data: superAdminData } = await supabase
        .from('super_admins')
        .select('*')
        .eq('is_active', true);

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
          user_count: 0, // Would need a separate query to count users per org
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
        
        setStats({
          totalOrgs: formattedOrgs.length,
          activeSubscriptions,
          trialSubscriptions,
          totalUsers: profilesData?.length || 0
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

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Super Admin</h1>
          <p className="text-muted-foreground">
            System administration and management
          </p>
        </div>
        <Dialog open={isGrantModalOpen} onOpenChange={setIsGrantModalOpen}>
          <DialogTrigger asChild>
            <Button>
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

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrgs}</div>
            <p className="text-xs text-muted-foreground">All organizations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">Paying customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trial Subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.trialSubscriptions}</div>
            <p className="text-xs text-muted-foreground">Trial users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>
      </div>

      {/* Organizations Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Organizations</CardTitle>
              <CardDescription>
                Manage all organizations in the system
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search organizations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrganizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell>{org.slug}</TableCell>
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
                    {format(new Date(org.created_at), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Super Admins Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Super Administrators
          </CardTitle>
          <CardDescription>
            Manage users with super admin privileges
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Granted At</TableHead>
                <TableHead>Granted By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {superAdmins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-mono text-sm">{admin.user_id}</TableCell>
                  <TableCell>
                    {format(new Date(admin.granted_at), 'MMM dd, yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{admin.granted_by || 'System'}</TableCell>
                  <TableCell>
                    <Badge variant={admin.is_active ? 'default' : 'secondary'}>
                      {admin.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {admin.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeSuperAdmin(admin.user_id)}
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            View all registered users in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Sign In</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.slice(0, 50).map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell className="font-mono text-sm">{user.id}</TableCell>
                  <TableCell>
                    {format(new Date(user.created_at), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    {user.last_sign_in_at ? format(new Date(user.last_sign_in_at), 'MMM dd, yyyy') : 'Never'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredUsers.length > 50 && (
            <p className="text-sm text-muted-foreground mt-2">
              Showing first 50 users. Use search to find specific users.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
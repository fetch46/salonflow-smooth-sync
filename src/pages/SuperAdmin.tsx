import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Shield, 
  Users, 
  Building2, 
  CreditCard, 
  BarChart3, 
  Settings, 
  UserPlus, 
  UserMinus,
  Crown,
  Activity,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Mail,
  Search,
  Plus,
  Trash2,
  Edit
} from 'lucide-react';
import { useSaas } from '@/contexts/SaasContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

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

interface SuperAdminUser {
  id: string;
  user_id: string;
  email: string;
  granted_by_email: string;
  granted_at: string;
  is_active: boolean;
}

export default function SuperAdmin() {
  const { isSuperAdmin, canManageSystem, user } = useSaas();
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [superAdmins, setSuperAdmins] = useState<SuperAdminUser[]>([]);
  const [stats, setStats] = useState({
    totalOrganizations: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
    totalUsers: 0
  });

  // Modals and forms
  const [isGrantAdminOpen, setIsGrantAdminOpen] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isSuperAdmin && canManageSystem) {
      fetchDashboardData();
    }
  }, [isSuperAdmin, canManageSystem]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch organizations with stats
      const { data: orgsData } = await supabase
        .from('organizations')
        .select(`
          *,
          organization_subscriptions!inner(
            status,
            subscription_plans(name)
          )
        `);

      // Fetch super admins
      const { data: superAdminData } = await supabase
        .from('super_admins')
        .select('*');

      if (orgsData) {
        const formattedOrgs = orgsData.map(org => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          status: org.status,
          created_at: org.created_at,
          user_count: 0, // Would need a separate query to count users per org
          subscription_status: org.organization_subscriptions?.status || 'none',
          plan_name: org.organization_subscriptions?.subscription_plans?.name || 'No Plan'
        }));
        setOrganizations(formattedOrgs);

        // Calculate stats
        setStats({
          totalOrganizations: orgsData.length,
          activeSubscriptions: orgsData.filter(org => 
            org.organization_subscriptions?.status === 'active' || 
            org.organization_subscriptions?.status === 'trial'
          ).length,
          totalRevenue: 0, // Would need billing data
          totalUsers: 0 // Would need to count across all orgs
        });
      }

      if (superAdminData) {
        const formattedAdmins = superAdminData.map((admin: any) => ({
          id: admin.id,
          user_id: admin.user_id,
          email: 'N/A', // Will need separate query to get email
          granted_by_email: 'N/A', // Will need separate query
          granted_at: admin.granted_at,
          is_active: admin.is_active
        }));
        setSuperAdmins(formattedAdmins);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleGrantSuperAdmin = async () => {
    try {
      // First find the user by email
      const { data: userData, error: userError } = await supabase
        .from('auth.users')
        .select('id')
        .eq('email', newAdminEmail)
        .single();

      if (userError || !userData) {
        toast.error('User not found with that email address');
        return;
      }

      // Grant super admin access
      const { error } = await supabase.rpc('grant_super_admin', {
        target_user_id: userData.id
      });

      if (error) {
        throw error;
      }

      toast.success(`Super admin access granted to ${newAdminEmail}`);
      setNewAdminEmail('');
      setIsGrantAdminOpen(false);
      fetchDashboardData();

    } catch (error) {
      console.error('Error granting super admin:', error);
      toast.error('Failed to grant super admin access');
    }
  };

  const handleRevokeSuperAdmin = async (userId: string, email: string) => {
    if (userId === user?.id) {
      toast.error('Cannot revoke your own super admin access');
      return;
    }

    try {
      const { error } = await supabase.rpc('revoke_super_admin', {
        target_user_id: userId
      });

      if (error) {
        throw error;
      }

      toast.success(`Super admin access revoked from ${email}`);
      fetchDashboardData();

    } catch (error) {
      console.error('Error revoking super admin:', error);
      toast.error('Failed to revoke super admin access');
    }
  };

  // Redirect if not super admin
  if (!isSuperAdmin || !canManageSystem) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <CardTitle className="text-xl text-red-600">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-slate-600 mb-4">
              You don't have super admin access to view this page.
            </p>
            <Button onClick={() => window.history.back()}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto"></div>
          <p className="text-slate-600 font-medium">Loading super admin dashboard...</p>
        </div>
      </div>
    );
  }

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl shadow-lg">
              <Crown className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Super Admin Dashboard</h1>
              <p className="text-slate-600">Manage the entire SAAS platform</p>
            </div>
          </div>
          
          <Badge variant="outline" className="bg-violet-50 border-violet-200 text-violet-700">
            <Crown className="w-3 h-3 mr-1" />
            Super Admin
          </Badge>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Organizations</CardTitle>
              <Building2 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stats.totalOrganizations}</div>
              <p className="text-xs text-slate-500">Active tenants</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Active Subscriptions</CardTitle>
              <CreditCard className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stats.activeSubscriptions}</div>
              <p className="text-xs text-slate-500">Paying customers</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">${stats.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-slate-500">Monthly recurring</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Platform Users</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stats.totalUsers}</div>
              <p className="text-xs text-slate-500">Across all orgs</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="organizations" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="organizations">Organizations</TabsTrigger>
            <TabsTrigger value="admins">Super Admins</TabsTrigger>
            <TabsTrigger value="system">System Settings</TabsTrigger>
          </TabsList>

          {/* Organizations Tab */}
          <TabsContent value="organizations" className="space-y-6">
            <Card className="shadow-lg border-slate-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Organizations Management
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                      <Input
                        placeholder="Search organizations..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Subscription</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrganizations.map((org) => (
                      <TableRow key={org.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{org.name}</div>
                            <div className="text-sm text-slate-500">{org.slug}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={org.status === 'active' ? 'default' : 'secondary'}
                            className={org.status === 'active' ? 'bg-green-100 text-green-800' : ''}
                          >
                            {org.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{org.plan_name}</div>
                            <Badge 
                              variant="outline" 
                              className={
                                org.subscription_status === 'active' ? 'border-green-300 text-green-700' :
                                org.subscription_status === 'trial' ? 'border-blue-300 text-blue-700' :
                                'border-slate-300 text-slate-700'
                              }
                            >
                              {org.subscription_status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(org.created_at), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm">
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Super Admins Tab */}
          <TabsContent value="admins" className="space-y-6">
            <Card className="shadow-lg border-slate-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Super Administrators
                  </CardTitle>
                  <Dialog open={isGrantAdminOpen} onOpenChange={setIsGrantAdminOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-violet-600 hover:bg-violet-700">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Grant Super Admin
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Grant Super Admin Access</DialogTitle>
                        <DialogDescription>
                          Enter the email address of the user you want to grant super admin access to.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="email">Email Address</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="user@example.com"
                            value={newAdminEmail}
                            onChange={(e) => setNewAdminEmail(e.target.value)}
                          />
                        </div>
                        <div className="flex justify-end gap-3">
                          <Button variant="outline" onClick={() => setIsGrantAdminOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleGrantSuperAdmin} disabled={!newAdminEmail}>
                            Grant Access
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Granted By</TableHead>
                      <TableHead>Granted Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {superAdmins.map((admin) => (
                      <TableRow key={admin.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center">
                              <Crown className="w-4 h-4 text-violet-600" />
                            </div>
                            <div>
                              <div className="font-medium">{admin.email}</div>
                              <div className="text-sm text-slate-500">Super Administrator</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{admin.granted_by_email}</TableCell>
                        <TableCell>{format(new Date(admin.granted_at), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={admin.is_active ? 'default' : 'secondary'}
                            className={admin.is_active ? 'bg-green-100 text-green-800' : ''}
                          >
                            {admin.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {admin.user_id !== user?.id && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleRevokeSuperAdmin(admin.user_id, admin.email)}
                            >
                              <UserMinus className="w-3 h-3 mr-1" />
                              Revoke
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Settings Tab */}
          <TabsContent value="system" className="space-y-6">
            <Card className="shadow-lg border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  System Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Settings className="w-16 h-16 mx-auto text-slate-400 mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">System Settings</h3>
                  <p className="text-slate-600">
                    System-wide configuration options will be available here.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
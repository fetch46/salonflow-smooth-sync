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
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";

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

interface NewOrgUser {
  email: string;
  role: 'owner' | 'admin' | 'manager' | 'member';
  fullName?: string;
}

interface OrganizationUser {
  id: string;
  user_id: string;
  organization_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
  email?: string;
  full_name?: string;
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
  const [newOrgUsers, setNewOrgUsers] = useState<NewOrgUser[]>([{
    email: "",
    role: "owner",
    fullName: ""
  }]);
  const [selectedOrgForUsers, setSelectedOrgForUsers] = useState<string | null>(null);
  const [orgUsers, setOrgUsers] = useState<OrganizationUser[]>([]);
  // Super Admin — create staff user for selected organization
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<"owner" | "admin" | "manager" | "member" | "staff">("staff");
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [newStaffConfirm, setNewStaffConfirm] = useState(true);
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [isOrgUsersModalOpen, setIsOrgUsersModalOpen] = useState(false);
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
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', selectedUserEmail)
        .single();

      if (profileError) {
        console.error('Error finding user:', profileError);
        toast.error('User not found with that email address');
        return;
      }

      if (!profile) {
        toast.error('User not found with that email address');
        return;
      }

      // Check if user is already a super admin
      const { data: existingSuperAdmin } = await supabase
        .from('super_admins')
        .select('id, is_active')
        .eq('user_id', profile.user_id)
        .single();

      if (existingSuperAdmin && existingSuperAdmin.is_active) {
        toast.error('User is already a super admin');
        return;
      }

      // Try using the RPC function first
      const { error: rpcError } = await supabase.rpc('grant_super_admin', {
        target_user_id: profile.user_id
      });

      if (rpcError) {
        console.error('RPC error:', rpcError);
        // Fallback to direct table insertion if RPC fails
        const { error: insertError } = await supabase
          .from('super_admins')
          .upsert({
            user_id: profile.user_id,
            granted_by: (await supabase.auth.getUser()).data.user?.id,
            granted_at: new Date().toISOString(),
            is_active: true,
          });

        if (insertError) {
          console.error('Direct insert error:', insertError);
          throw insertError;
        }
      }

      toast.success('Super admin privileges granted successfully');
      setIsGrantModalOpen(false);
      setSelectedUserEmail('');
      fetchData();
    } catch (error) {
      console.error('Error granting super admin:', error);
      toast.error('Failed to grant super admin privileges. Check console for details.');
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

  const addOrgUser = () => {
    setNewOrgUsers(prev => [...prev, {
      email: "",
      role: "member",
      fullName: ""
    }]);
  };

  const removeOrgUser = (index: number) => {
    if (newOrgUsers.length > 1) {
      setNewOrgUsers(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateOrgUser = (index: number, field: keyof NewOrgUser, value: string) => {
    setNewOrgUsers(prev => prev.map((user, i) => 
      i === index ? { ...user, [field]: value } : user
    ));
  };

  const fetchOrganizationUsers = async (organizationId: string) => {
    try {
      const { data, error } = await supabase
        .from('organization_users')
        .select(`
          *,
          profiles (
            email,
            full_name
          )
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Relational fetch for super admin organization users failed; attempting fallback without join', error)
        const { data: memberships, error: membershipsError } = await supabase
          .from('organization_users')
          .select('id, organization_id, user_id, role, is_active, created_at, updated_at')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
        if (membershipsError) throw membershipsError

        const userIds = Array.from(new Set((memberships || []).map((m: any) => m.user_id).filter(Boolean)))
        let profilesByUserId: Record<string, any> = {}
        if (userIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, email, full_name')
            .in('user_id', userIds)
          if (profilesError) throw profilesError
          profilesByUserId = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]))
        }

        const formattedUsers = (memberships || []).map((user: any) => ({
          ...user,
          email: profilesByUserId[user.user_id]?.email || 'No email',
          full_name: profilesByUserId[user.user_id]?.full_name || ''
        }))

        setOrgUsers(formattedUsers)
        return
      }

      const formattedUsers = data?.map(user => ({
        ...user,
        email: (user as any).profiles?.email || 'No email',
        full_name: (user as any).profiles?.full_name || ''
      })) || [];

      setOrgUsers(formattedUsers);
    } catch (error) {
      console.error('Error fetching organization users:', error);
      toast.error('Failed to fetch organization users');
    }
  };

  const handleViewOrgUsers = async (organizationId: string) => {
    setSelectedOrgForUsers(organizationId);
    setIsOrgUsersModalOpen(true);
    await fetchOrganizationUsers(organizationId);
  };

  const handleRemoveOrgUser = async (userId: string, organizationId: string) => {
    if (!confirm('Are you sure you want to remove this user from the organization?')) return;

    try {
      const { error } = await supabase
        .from('organization_users')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('organization_id', organizationId);

      if (error) throw error;

      toast.success('User removed from organization successfully');
      await fetchOrganizationUsers(organizationId);
    } catch (error) {
      console.error('Error removing user from organization:', error);
      toast.error('Failed to remove user from organization');
    }
  };

  const handleChangeUserRole = async (userId: string, organizationId: string, newRole: string) => {
    try {
      const { error } = await supabase.functions.invoke('update-org-user-role', {
        body: { user_id: userId, organization_id: organizationId, role: newRole },
      });
      if (error) throw error;
      toast.success('User role updated successfully');
      await fetchOrganizationUsers(organizationId);
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Failed to update user role');
    }
  };

  const handleCreateOrganization = async () => {
    if (!newOrg.name) {
      toast.error('Organization name is required');
      return;
    }

    // Validate users
    const validUsers = newOrgUsers.filter(user => user.email);
    if (validUsers.length === 0) {
      toast.error('At least one user with email is required');
      return;
    }

    // Check if there's at least one owner
    const hasOwner = validUsers.some(user => user.role === 'owner');
    if (!hasOwner) {
      toast.error('At least one user must be assigned as owner');
      return;
    }

    try {
      const slug = newOrg.slug || generateSlug(newOrg.name);
      
      // First create the organization
      const { data: orgData, error: orgError } = await supabase.rpc('create_organization_with_user', {
        org_name: newOrg.name,
        org_slug: slug,
        org_settings: {
          domain: newOrg.domain,
          ...newOrg.settings
        },
        plan_id: null
      });

      if (orgError) throw orgError;

      // If there are additional users beyond the creator, add them
      if (validUsers.length > 1) {
        for (const user of validUsers.slice(1)) {
          // First check if user exists, if not create invite them to create account
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('email', user.email)
            .single();

          if (existingProfile) {
            // User exists, add them directly to organization
            const { error: userError } = await supabase
              .from('organization_users')
              .insert({
                organization_id: orgData,
                user_id: existingProfile.user_id,
                role: user.role,
                is_active: true
              });

            if (userError) {
              console.error('Error adding user to organization:', userError);
              toast.error(`Failed to add user ${user.email} to organization`);
            }
          } else {
            // User doesn't exist, we'll need to create an invitation
            // For now, just log this - in a real app you'd send an invitation email
            console.log(`Would send invitation to ${user.email} with role ${user.role}`);
          }
        }
      }

      toast.success('Organization created successfully');
      setIsOrgModalOpen(false);
      setNewOrg({ name: "", slug: "", domain: "", settings: {} });
      setNewOrgUsers([{ email: "", role: "owner", fullName: "" }]);
      fetchData();
    } catch (error) {
      console.error('Error creating organization:', error);
      toast.error('Failed to create organization');
    }
  };

  const handleCreateStaffUser = async () => {
    if (!selectedOrgForUsers) { toast.error('No organization selected'); return; }
    if (!newStaffEmail) { toast.error('Email is required'); return; }
    try {
      setCreatingStaff(true);
      const { error } = await supabase.functions.invoke('create-staff-user', {
        body: {
          email: newStaffEmail,
          password: newStaffPassword || undefined,
          full_name: newStaffName || undefined,
          organization_id: selectedOrgForUsers,
          role: newStaffRole,
          confirm: newStaffConfirm,
        },
      });
      if (error) throw error;
      toast.success('Staff user created');
      setNewStaffEmail("");
      setNewStaffName("");
      setNewStaffPassword("");
      setNewStaffRole("staff");
      setNewStaffConfirm(true);
      await fetchOrganizationUsers(selectedOrgForUsers);
    } catch (e: any) {
      console.error('Create staff user error', e);
      toast.error(e?.message || 'Failed to create staff user');
    } finally {
      setCreatingStaff(false);
    }
  };

  const handleSetUserPassword = async (userId: string) => {
    try {
      const orgId = selectedOrgForUsers;
      const newPass = prompt('Enter new password (min 8 chars)');
      if (!newPass || newPass.length < 8) return;
      const { error } = await supabase.functions.invoke('set-user-password', {
        body: { user_id: userId, new_password: newPass, organization_id: orgId || undefined },
      });
      if (error) throw error;
      toast.success('Password updated');
    } catch (e) {
      console.error('Set password error', e);
      toast.error('Failed to set password');
    }
  };

  const handleConfirmUserEmail = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke('confirm-user', { body: { user_id: userId } });
      if (error) throw error;
      toast.success('User email confirmed');
    } catch (e) {
      console.error('Confirm email error', e);
      toast.error('Failed to confirm email');
    }
  };

  const handleEditStaffMinimal = async (email: string) => {
    try {
      if (!selectedOrgForUsers) return;
      const name = prompt('Enter full name for staff');
      if (!name) return;
      const { error } = await supabase.functions.invoke('upsert-staff', {
        body: {
          organization_id: selectedOrgForUsers,
          email,
          full_name: name,
          is_active: true,
        },
      });
      if (error) throw error;
      toast.success('Staff details saved');
    } catch (e) {
      console.error('Edit staff error', e);
      toast.error('Failed to save staff details');
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
    <SuperAdminLayout>
      <div className="p-6 space-y-8 w-full">
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
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Organization</DialogTitle>
                <DialogDescription>
                  Add a new organization to the system and configure initial users
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                {/* Organization Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Organization Details</h3>
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
                </div>

                {/* Organization Users */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Organization Users</h3>
                    <Button type="button" variant="outline" size="sm" onClick={addOrgUser}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add User
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {newOrgUsers.map((user, index) => (
                      <div key={index} className="flex gap-3 items-end p-3 border rounded-lg">
                        <div className="flex-1 space-y-2">
                          <div>
                            <Label htmlFor={`userEmail${index}`}>Email *</Label>
                            <Input
                              id={`userEmail${index}`}
                              type="email"
                              value={user.email}
                              onChange={(e) => updateOrgUser(index, 'email', e.target.value)}
                              placeholder="user@example.com"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`userFullName${index}`}>Full Name</Label>
                            <Input
                              id={`userFullName${index}`}
                              value={user.fullName || ''}
                              onChange={(e) => updateOrgUser(index, 'fullName', e.target.value)}
                              placeholder="John Doe"
                            />
                          </div>
                        </div>
                        <div className="w-32">
                          <Label htmlFor={`userRole${index}`}>Role</Label>
                          <Select
                            value={user.role}
                            onValueChange={(value) => updateOrgUser(index, 'role', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">Owner</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {newOrgUsers.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeOrgUser(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    At least one user must be assigned as owner. Users without existing accounts will be sent invitations.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsOrgModalOpen(false);
                      setNewOrg({ name: "", slug: "", domain: "", settings: {} });
                      setNewOrgUsers([{ email: "", role: "owner", fullName: "" }]);
                    }}
                  >
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
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleViewOrgUsers(org.id)}
                              title="View organization users"
                            >
                              <Users className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" title="View details">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" title="Settings">
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
      
      {/* Organization Users Modal */}
      <Dialog open={isOrgUsersModalOpen} onOpenChange={setIsOrgUsersModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Organization Users</DialogTitle>
            <DialogDescription>
              Manage users for {organizations.find(org => org.id === selectedOrgForUsers)?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add Staff User</CardTitle>
                <CardDescription>Create a user account and add to this organization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="new-staff-email">Email</Label>
                    <Input id="new-staff-email" value={newStaffEmail} onChange={(e) => setNewStaffEmail(e.target.value)} placeholder="staff@example.com" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="new-staff-name">Full Name</Label>
                    <Input id="new-staff-name" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} placeholder="Jane Doe" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-staff-role">Role</Label>
                    <Select value={newStaffRole} onValueChange={(v) => setNewStaffRole(v as any)}>
                      <SelectTrigger id="new-staff-role"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="new-staff-password">Password (optional)</Label>
                    <Input id="new-staff-password" type="password" value={newStaffPassword} onChange={(e) => setNewStaffPassword(e.target.value)} placeholder="Min 8 characters" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="new-staff-confirm">Confirm Email</Label>
                    <div className="flex items-center gap-2">
                      <input id="new-staff-confirm" type="checkbox" checked={newStaffConfirm} onChange={(e) => setNewStaffConfirm(e.target.checked)} />
                      <span className="text-sm text-muted-foreground">Mark as confirmed</span>
                    </div>
                  </div>
                  <div className="md:col-span-1">
                    <Button onClick={handleCreateStaffUser} disabled={creatingStaff || !newStaffEmail} className="w-full">{creatingStaff ? 'Creating...' : 'Create'}</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                            {user.email?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="font-medium">{user.full_name || 'Unknown User'}</div>
                            <div className="text-sm text-muted-foreground">
                              {user.user_id.substring(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          onValueChange={(newRole) => handleChangeUserRole(user.user_id, user.organization_id, newRole)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? 'default' : 'secondary'}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(user.created_at), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleRemoveOrgUser(user.user_id, user.organization_id)}
                            className="text-red-600 hover:text-red-700"
                            disabled={!user.is_active}
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleSetUserPassword(user.user_id)} title="Set Password">
                            {/* key icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-key-round"><path d="M7.5 15a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Z"/><path d="M21 21l-4.3-4.3"/><path d="M15.5 15.5l-2-2"/><path d="M18 18l-2-2"/></svg>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleConfirmUserEmail(user.user_id)} title="Confirm Email">
                            {/* check-circle icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check-circle"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                          </Button>
                          {user.email && (
                            <Button variant="ghost" size="sm" onClick={() => handleEditStaffMinimal(user.email!)} title="Edit Staff">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-edit-2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {orgUsers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No users found for this organization
              </div>
            )}
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                onClick={() => setIsOrgUsersModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </SuperAdminLayout>
  );
}
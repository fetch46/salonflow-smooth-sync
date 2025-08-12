import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Plus, Edit, Trash2, Search, Building, Shield, KeyRound, Check, Mail } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
  organization_count?: number;
}

interface OrganizationUser {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  invited_by?: string;
  invited_at?: string;
  joined_at?: string;
  created_at: string;
  updated_at: string;
  user_email?: string;
  organization_name?: string;
  invited_by_email?: string;
}

interface NewOrganizationUser {
  organization_id: string;
  user_id: string;
  role: string;
  is_active: boolean;
}

const AdminUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [organizationUsers, setOrganizationUsers] = useState<OrganizationUser[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOrgUserDialogOpen, setIsCreateOrgUserDialogOpen] = useState(false);
  const [isEditOrgUserDialogOpen, setIsEditOrgUserDialogOpen] = useState(false);
  const [selectedOrgUser, setSelectedOrgUser] = useState<OrganizationUser | null>(null);
  const [newOrgUser, setNewOrgUser] = useState<NewOrganizationUser>({
    organization_id: "",
    user_id: "",
    role: "staff",
    is_active: true
  });
  const [isSetPasswordDialogOpen, setIsSetPasswordDialogOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<{ user_id: string; email?: string | null } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchUsers(),
        fetchOrganizationUsers(),
        fetchOrganizations()
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, email, created_at');

      if (error) throw error;

      const transformedData = (data || []).map((p: any) => ({
        id: p.user_id,
        email: p.email,
        created_at: p.created_at,
        organization_count: 0,
      }));

      setUsers(transformedData);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    }
  };

  const fetchOrganizationUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('organization_users')
        .select(`
          *,
          organizations(name)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Relational fetch for admin organization users failed; attempting fallback without join', error)
        const { data: memberships, error: membershipsError } = await supabase
          .from('organization_users')
          .select('id, organization_id, user_id, role, is_active, invited_by, invited_at, joined_at, created_at, updated_at')
          .order('created_at', { ascending: false })
        if (membershipsError) throw membershipsError

        const orgIds = Array.from(new Set((memberships || []).map((m: any) => m.organization_id)))
        const userIds = Array.from(new Set((memberships || []).map((m: any) => m.user_id).filter(Boolean)))

        let organizationsById: Record<string, any> = {}
        if (orgIds.length > 0) {
          const { data: orgs, error: orgsError } = await supabase
            .from('organizations')
            .select('id, name')
            .in('id', orgIds)
          if (orgsError) throw orgsError
          organizationsById = Object.fromEntries((orgs || []).map((o: any) => [o.id, o]))
        }

        let emailByUserId: Record<string, string> = {}
        if (userIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, email')
            .in('user_id', userIds)
          if (profilesError) throw profilesError
          emailByUserId = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p.email]))
        }

        const transformedData = (memberships || []).map((orgUser: any) => ({
          ...orgUser,
          organization_name: organizationsById[orgUser.organization_id]?.name,
          user_email: emailByUserId[orgUser.user_id] || null,
        }))
        setOrganizationUsers(transformedData)
        return
      }

      // Fetch user emails separately to avoid FK dependency
      const userIds = Array.from(new Set((data || []).map((u: any) => u.user_id).filter(Boolean)));
      let emailByUserId: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, email')
          .in('user_id', userIds);
        if (profilesError) throw profilesError;
        emailByUserId = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p.email]));
      }

      const transformedData = (data || []).map((orgUser: any) => ({
        ...orgUser,
        organization_name: (orgUser as any)?.organizations?.name,
        user_email: emailByUserId[orgUser.user_id] || null,
      }));

      setOrganizationUsers(transformedData);
    } catch (error) {
      console.error('Error fetching organization users:', error);
      toast.error('Failed to fetch organization users');
    }
  };

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error('Error fetching organizations:', error);
    }
  };

  const createOrganizationUser = async () => {
    try {
      const { error } = await supabase
        .from('organization_users')
        .insert([{
          organization_id: newOrgUser.organization_id,
          user_id: newOrgUser.user_id,
          role: newOrgUser.role,
          is_active: newOrgUser.is_active
        }]);

      if (error) throw error;

      toast.success('Organization user created successfully');
      setIsCreateOrgUserDialogOpen(false);
      resetOrgUserForm();
      fetchOrganizationUsers();
    } catch (error) {
      console.error('Error creating organization user:', error);
      toast.error('Failed to create organization user');
    }
  };

  const updateOrganizationUser = async () => {
    if (!selectedOrgUser) return;

    try {
      const { error } = await supabase
        .from('organization_users')
        .update({
          role: newOrgUser.role,
          is_active: newOrgUser.is_active
        })
        .eq('id', selectedOrgUser.id);

      if (error) throw error;

      toast.success('Organization user updated successfully');
      setIsEditOrgUserDialogOpen(false);
      setSelectedOrgUser(null);
      fetchOrganizationUsers();
    } catch (error) {
      console.error('Error updating organization user:', error);
      toast.error('Failed to update organization user');
    }
  };

  const deleteOrganizationUser = async (id: string, userEmail: string, orgName: string) => {
    if (!confirm(`Are you sure you want to remove ${userEmail} from ${orgName}? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('organization_users')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Organization user removed successfully');
      fetchOrganizationUsers();
    } catch (error) {
      console.error('Error deleting organization user:', error);
      toast.error('Failed to remove organization user');
    }
  };

  const sendPasswordReset = async (email?: string | null) => {
    if (!email) {
      toast.error('No email found for this user');
      return;
    }
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw error;
      toast.success('Password reset email sent');
    } catch (error) {
      console.error('Error sending password reset:', error);
      toast.error('Failed to send password reset');
    }
  };

  const confirmUser = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke('confirm-user', {
        body: { user_id: userId },
      });
      if (error) throw error;
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, email_confirmed_at: new Date().toISOString() } : u))
      );
      toast.success('User email confirmed');
    } catch (error) {
      console.error('Error confirming user:', error);
      toast.error('Failed to confirm user');
    }
  };

  const openSetPasswordDialog = (userId: string, email?: string | null) => {
    setPasswordTarget({ user_id: userId, email });
    setNewPassword("");
    setConfirmPassword("");
    setIsSetPasswordDialogOpen(true);
  };

  const handleSetPassword = async () => {
    if (!passwordTarget) return;
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      const { error } = await supabase.functions.invoke('set-user-password', {
        body: {
          user_id: passwordTarget.user_id,
          new_password: newPassword,
        },
      });
      if (error) throw error;
      toast.success('Password has been set');
      setIsSetPasswordDialogOpen(false);
      setPasswordTarget(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error('Error setting password:', error);
      toast.error('Failed to set password');
    }
  };

  const openEditOrgUserDialog = (orgUser: OrganizationUser) => {
    setSelectedOrgUser(orgUser);
    setNewOrgUser({
      organization_id: orgUser.organization_id,
      user_id: orgUser.user_id,
      role: orgUser.role,
      is_active: orgUser.is_active
    });
    setIsEditOrgUserDialogOpen(true);
  };

  const resetOrgUserForm = () => {
    setNewOrgUser({
      organization_id: "",
      user_id: "",
      role: "staff",
      is_active: true
    });
  };

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredOrgUsers = organizationUsers.filter(orgUser =>
    orgUser.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    orgUser.organization_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    orgUser.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role: string) => {
    const roleColors = {
      owner: "bg-purple-100 text-purple-800",
      admin: "bg-blue-100 text-blue-800",
      manager: "bg-green-100 text-green-800",
      staff: "bg-gray-100 text-gray-800",
      viewer: "bg-yellow-100 text-yellow-800"
    };
    return roleColors[role as keyof typeof roleColors] || "bg-gray-100 text-gray-800";
  };

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Users Management</h1>
            <p className="text-gray-500 mt-1">Manage all users and organization memberships</p>
          </div>
          <Button onClick={() => setIsCreateOrgUserDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add User to Organization
          </Button>
        </div>

        {/* Search and Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="md:col-span-2">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search users..."
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
                <Users className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{users.length}</p>
                  <p className="text-sm text-gray-500">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Building className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{organizationUsers.length}</p>
                  <p className="text-sm text-gray-500">Organization Memberships</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Users and Organization Users */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">All Users</TabsTrigger>
            <TabsTrigger value="org-users">Organization Users</TabsTrigger>
          </TabsList>

          {/* All Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>System Users</CardTitle>
                <CardDescription>
                  A list of all users in the system
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
                        <TableHead>Email</TableHead>
                        <TableHead>Organizations</TableHead>
                        <TableHead>Email Confirmed</TableHead>
                        <TableHead>Last Sign In</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.email}</TableCell>
                          <TableCell>{user.organization_count || 0}</TableCell>
                          <TableCell>
                            <Badge 
                              className={user.email_confirmed_at 
                                ? "bg-green-100 text-green-800" 
                                : "bg-red-100 text-red-800"
                              }
                            >
                              {user.email_confirmed_at ? 'Confirmed' : 'Pending'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.last_sign_in_at 
                              ? format(new Date(user.last_sign_in_at), 'MMM dd, yyyy HH:mm')
                              : 'Never'
                            }
                          </TableCell>
                          <TableCell>
                            {format(new Date(user.created_at), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => confirmUser(user.id)}
                                title="Confirm email"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => sendPasswordReset(user.email)}
                                title="Send password reset"
                              >
                                <Mail className="h-4 w-4" />
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
          </TabsContent>

          {/* Organization Users Tab */}
          <TabsContent value="org-users">
            <Card>
              <CardHeader>
                <CardTitle>Organization Users</CardTitle>
                <CardDescription>
                  Manage user memberships in organizations
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
                        <TableHead>User</TableHead>
                        <TableHead>Organization</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Invited By</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrgUsers.map((orgUser) => (
                        <TableRow key={orgUser.id}>
                          <TableCell className="font-medium">{orgUser.user_email}</TableCell>
                          <TableCell>{orgUser.organization_name}</TableCell>
                          <TableCell>
                            <Badge className={getRoleBadge(orgUser.role)}>
                              {orgUser.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              className={orgUser.is_active 
                                ? "bg-green-100 text-green-800" 
                                : "bg-red-100 text-red-800"
                              }
                            >
                              {orgUser.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {orgUser.created_at
                              ? format(new Date(orgUser.created_at), 'MMM dd, yyyy')
                              : '-'
                            }
                          </TableCell>
                          <TableCell>{orgUser.invited_by_email || '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => sendPasswordReset(orgUser.user_email)}
                                title="Send password reset"
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openSetPasswordDialog(orgUser.user_id, orgUser.user_email)}
                                title="Set new password"
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => confirmUser(orgUser.user_id)}
                                title="Confirm email"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditOrgUserDialog(orgUser)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteOrganizationUser(
                                  orgUser.id, 
                                  orgUser.user_email || '', 
                                  orgUser.organization_name || ''
                                )}
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
          </TabsContent>
        </Tabs>

        {/* Create Organization User Dialog */}
        <Dialog open={isCreateOrgUserDialogOpen} onOpenChange={setIsCreateOrgUserDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add User to Organization</DialogTitle>
              <DialogDescription>
                Add an existing user to an organization.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="organization">Organization</Label>
                <Select 
                  value={newOrgUser.organization_id} 
                  onValueChange={(value) => setNewOrgUser({...newOrgUser, organization_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user">User</Label>
                <Select 
                  value={newOrgUser.user_id} 
                  onValueChange={(value) => setNewOrgUser({...newOrgUser, user_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select 
                  value={newOrgUser.role} 
                  onValueChange={(value) => setNewOrgUser({...newOrgUser, role: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={newOrgUser.is_active}
                  onCheckedChange={(checked) => setNewOrgUser({...newOrgUser, is_active: checked})}
                />
                <Label htmlFor="is_active">Active User</Label>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsCreateOrgUserDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createOrganizationUser}>
                Add User
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Organization User Dialog */}
        <Dialog open={isEditOrgUserDialogOpen} onOpenChange={setIsEditOrgUserDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Organization User</DialogTitle>
              <DialogDescription>
                Update user role and status in organization.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select 
                  value={newOrgUser.role} 
                  onValueChange={(value) => setNewOrgUser({...newOrgUser, role: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-is_active"
                  checked={newOrgUser.is_active}
                  onCheckedChange={(checked) => setNewOrgUser({...newOrgUser, is_active: checked})}
                />
                <Label htmlFor="edit-is_active">Active User</Label>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEditOrgUserDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={updateOrganizationUser}>
                Update User
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Set Password Dialog */}
        <Dialog open={isSetPasswordDialogOpen} onOpenChange={setIsSetPasswordDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Set New Password</DialogTitle>
              <DialogDescription>
                {passwordTarget?.email ? `Set a new password for ${passwordTarget.email}.` : 'Set a new password for the selected user.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsSetPasswordDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSetPassword}>
                Set Password
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SuperAdminLayout>
  );
};

export default AdminUsers;
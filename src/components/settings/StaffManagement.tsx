import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, Plus, Edit, Trash2, MoreHorizontal, Mail, UserCheck, Shield, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrganization } from '@/lib/saas/hooks';

interface OrganizationUser {
  id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
    phone?: string;
  };
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

const ROLE_HIERARCHY = ['viewer', 'member', 'staff', 'accountant', 'manager', 'admin', 'owner'];

const PERMISSIONS_LIST: Permission[] = [
  { id: 'view_dashboard', name: 'View Dashboard', description: 'Access to main dashboard', category: 'Dashboard' },
  { id: 'manage_clients', name: 'Manage Clients', description: 'Create, edit, and delete clients', category: 'Clients' },
  { id: 'view_clients', name: 'View Clients', description: 'View client information', category: 'Clients' },
  { id: 'manage_appointments', name: 'Manage Appointments', description: 'Schedule and manage appointments', category: 'Appointments' },
  { id: 'view_appointments', name: 'View Appointments', description: 'View appointment schedules', category: 'Appointments' },
  { id: 'manage_inventory', name: 'Manage Inventory', description: 'Manage products and stock', category: 'Inventory' },
  { id: 'view_inventory', name: 'View Inventory', description: 'View inventory levels', category: 'Inventory' },
  { id: 'manage_reports', name: 'Generate Reports', description: 'Access to all reports', category: 'Reports' },
  { id: 'view_reports', name: 'View Reports', description: 'View basic reports', category: 'Reports' },
  { id: 'manage_settings', name: 'Manage Settings', description: 'Access to system settings', category: 'Settings' },
  { id: 'manage_staff', name: 'Manage Staff', description: 'Invite and manage staff members', category: 'Staff' },
  { id: 'manage_billing', name: 'Manage Billing', description: 'Access billing and subscription management', category: 'Billing' },
  { id: 'view_material_costs', name: 'View Material Costs', description: 'View material costs on job cards', category: 'Job Cards' },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  viewer: ['view_dashboard', 'view_clients', 'view_appointments', 'view_inventory', 'view_reports'],
  member: ['view_dashboard', 'view_clients', 'view_appointments', 'view_inventory', 'view_reports'],
  staff: ['view_dashboard', 'manage_clients', 'view_clients', 'manage_appointments', 'view_appointments', 'view_inventory', 'view_reports'],
  accountant: ['view_dashboard', 'view_clients', 'view_appointments', 'view_inventory', 'manage_reports', 'view_reports', 'view_material_costs'],
  manager: ['view_dashboard', 'manage_clients', 'manage_appointments', 'manage_inventory', 'manage_reports', 'view_reports', 'view_material_costs'],
  admin: ['view_dashboard', 'manage_clients', 'manage_appointments', 'manage_inventory', 'manage_reports', 'manage_settings', 'manage_staff', 'view_material_costs'],
  owner: ['view_dashboard', 'manage_clients', 'manage_appointments', 'manage_inventory', 'manage_reports', 'manage_settings', 'manage_staff', 'manage_billing', 'view_material_costs'],
};

export function StaffManagement() {
  const { organization } = useOrganization();
  const [staffMembers, setStaffMembers] = useState<OrganizationUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<OrganizationUser | null>(null);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'staff',
    send_email: true
  });

  useEffect(() => {
    if (organization?.id) {
      loadStaffMembers();
    }
  }, [organization?.id]);

  const loadStaffMembers = async () => {
    if (!organization?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('organization_users')
        .select(`
          *,
          profiles!inner(
            full_name,
            email,
            phone
          )
        `)
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStaffMembers(data || []);
    } catch (error) {
      console.error('Error loading staff members:', error);
      toast.error('Failed to load staff members');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteStaff = async () => {
    if (!organization?.id || !inviteForm.email.trim()) {
      toast.error('Email is required');
      return;
    }

    try {
      // Call edge function to invite user
      const { data, error } = await supabase.functions.invoke('add-org-user', {
        body: {
          organization_id: organization.id,
          email: inviteForm.email.trim(),
          role: inviteForm.role,
          send_email: inviteForm.send_email
        }
      });

      if (error) throw error;

      toast.success('Staff member invited successfully');
      setIsInviteDialogOpen(false);
      setInviteForm({ email: '', role: 'staff', send_email: true });
      loadStaffMembers();
    } catch (error: any) {
      console.error('Error inviting staff:', error);
      toast.error(error.message || 'Failed to invite staff member');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (!organization?.id) return;

    try {
      const { error } = await supabase.functions.invoke('update-org-user-role', {
        body: {
          organization_id: organization.id,
          user_id: userId,
          role: newRole
        }
      });

      if (error) throw error;

      toast.success('Role updated successfully');
      loadStaffMembers();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error(error.message || 'Failed to update role');
    }
  };

  const handleRemoveStaff = async (userId: string, userName: string) => {
    if (!organization?.id) return;
    if (!confirm(`Are you sure you want to remove ${userName} from the organization?`)) return;

    try {
      const { error } = await supabase
        .from('organization_users')
        .update({ is_active: false })
        .eq('organization_id', organization.id)
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Staff member removed successfully');
      loadStaffMembers();
    } catch (error) {
      console.error('Error removing staff:', error);
      toast.error('Failed to remove staff member');
    }
  };

  const filteredStaff = staffMembers.filter(member =>
    member.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      owner: 'bg-purple-100 text-purple-800',
      admin: 'bg-red-100 text-red-800',
      manager: 'bg-blue-100 text-blue-800',
      accountant: 'bg-green-100 text-green-800',
      staff: 'bg-yellow-100 text-yellow-800',
      member: 'bg-gray-100 text-gray-800',
      viewer: 'bg-slate-100 text-slate-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getPermissionsForRole = (role: string) => {
    return ROLE_PERMISSIONS[role] || [];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Staff Management</h2>
          <p className="text-muted-foreground">Manage your organization's staff and permissions</p>
        </div>
        <Button onClick={() => setIsInviteDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Invite Staff
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search staff members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Staff Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Staff Members ({filteredStaff.length})
          </CardTitle>
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
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.profiles?.full_name || 'Unknown'}
                    </TableCell>
                    <TableCell>{member.profiles?.email}</TableCell>
                    <TableCell>
                      <Badge className={getRoleColor(member.role)}>
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.is_active ? 'default' : 'secondary'}>
                        {member.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(member.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedMember(member);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Role
                          </DropdownMenuItem>
                          {member.role !== 'owner' && (
                            <DropdownMenuItem
                              onClick={() => handleRemoveStaff(member.user_id, member.profiles?.full_name || 'User')}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Role Permissions Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Role Permissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ROLE_HIERARCHY.slice().reverse().map((role) => (
              <div key={role} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className={getRoleColor(role)}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {getPermissionsForRole(role).map((permission) => {
                    const permData = PERMISSIONS_LIST.find(p => p.id === permission);
                    return (
                      <div key={permission} className="text-xs text-gray-600 flex items-center gap-1">
                        <UserCheck className="w-3 h-3" />
                        {permData?.name}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Staff Member</DialogTitle>
            <DialogDescription>
              Send an invitation to a new staff member to join your organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={inviteForm.role} onValueChange={(value) => setInviteForm({ ...inviteForm, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_HIERARCHY.filter(role => role !== 'owner').map((role) => (
                    <SelectItem key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="send_email"
                checked={inviteForm.send_email}
                onCheckedChange={(checked) => setInviteForm({ ...inviteForm, send_email: !!checked })}
              />
              <Label htmlFor="send_email">Send invitation email</Label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleInviteStaff}>
                <Mail className="w-4 h-4 mr-2" />
                Send Invitation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Staff Role</DialogTitle>
            <DialogDescription>
              Change the role for {selectedMember?.profiles?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-role">New Role</Label>
              <Select
                value={selectedMember?.role}
                onValueChange={(value) => {
                  if (selectedMember) {
                    handleUpdateRole(selectedMember.user_id, value);
                    setIsEditDialogOpen(false);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_HIERARCHY.filter(role => role !== 'owner').map((role) => (
                    <SelectItem key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
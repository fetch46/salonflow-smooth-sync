import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Plus, Trash2, Search, RefreshCw, Send } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";

interface UserInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at?: string;
  created_at: string;
  organization_name?: string;
  invited_by_email?: string;
}

interface NewInvitation {
  organization_id: string;
  email: string;
  role: string;
}

const AdminInvitations = () => {
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newInvitation, setNewInvitation] = useState<NewInvitation>({
    organization_id: "",
    email: "",
    role: "staff"
  });

  useEffect(() => {
    fetchInvitations();
    fetchOrganizations();
  }, []);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      
      const { data: rawInvites, error } = await supabase
        .from('user_invitations')
        .select(`
          *,
          organizations(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const inviterIds = Array.from(new Set((rawInvites || []).map((inv: any) => inv.invited_by).filter(Boolean))) as string[];

      let inviterMap: Record<string, string> = {};
      if (inviterIds.length > 0) {
        const { data: inviterProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id,email')
          .in('user_id', inviterIds);

        if (!profilesError && inviterProfiles) {
          inviterMap = inviterProfiles.reduce((acc: Record<string, string>, p: any) => {
            if (p.user_id) acc[p.user_id] = p.email || '';
            return acc;
          }, {});
        }
      }

      const transformedData = (rawInvites || []).map((invitation: any) => ({
        ...invitation,
        organization_name: invitation.organizations?.name,
        invited_by_email: invitation.invited_by ? inviterMap[invitation.invited_by] : undefined,
      }));

      setInvitations(transformedData);
    } catch (error) {
      console.error('Error fetching invitations:', error);
      toast.error('Failed to fetch invitations');
    } finally {
      setLoading(false);
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

  const createInvitation = async () => {
    try {
      // Generate a random token
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

      const { error } = await supabase
        .from('user_invitations')
        .insert([{
          organization_id: newInvitation.organization_id,
          email: newInvitation.email,
          role: newInvitation.role,
          invited_by: (await supabase.auth.getUser()).data.user?.id,
          token,
          expires_at: expiresAt.toISOString()
        }]);

      if (error) throw error;

      toast.success('Invitation created successfully');
      setIsCreateDialogOpen(false);
      resetForm();
      fetchInvitations();
    } catch (error) {
      console.error('Error creating invitation:', error);
      toast.error('Failed to create invitation');
    }
  };

  const resendInvitation = async (invitationId: string) => {
    try {
      // Update the expiration date
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7);

      const { error } = await supabase
        .from('user_invitations')
        .update({
          expires_at: newExpiresAt.toISOString()
        })
        .eq('id', invitationId);

      if (error) throw error;

      toast.success('Invitation resent successfully');
      fetchInvitations();
    } catch (error) {
      console.error('Error resending invitation:', error);
      toast.error('Failed to resend invitation');
    }
  };

  const deleteInvitation = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to delete the invitation for ${email}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('user_invitations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Invitation deleted successfully');
      fetchInvitations();
    } catch (error) {
      console.error('Error deleting invitation:', error);
      toast.error('Failed to delete invitation');
    }
  };

  const resetForm = () => {
    setNewInvitation({
      organization_id: "",
      email: "",
      role: "staff"
    });
  };

  const filteredInvitations = invitations.filter(invitation => {
    const matchesSearch = 
      invitation.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invitation.organization_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invitation.role.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "pending" && !invitation.accepted_at) ||
      (statusFilter === "accepted" && invitation.accepted_at) ||
      (statusFilter === "expired" && new Date(invitation.expires_at) < new Date() && !invitation.accepted_at);

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (invitation: UserInvitation) => {
    if (invitation.accepted_at) {
      return <Badge className="bg-green-100 text-green-800">Accepted</Badge>;
    }
    
    if (new Date(invitation.expires_at) < new Date()) {
      return <Badge className="bg-red-100 text-red-800">Expired</Badge>;
    }
    
    return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
  };

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

  const isPending = (invitation: UserInvitation) => {
    return !invitation.accepted_at && new Date(invitation.expires_at) > new Date();
  };

  const invitationStats = {
    total: invitations.length,
    pending: invitations.filter(inv => isPending(inv)).length,
    accepted: invitations.filter(inv => inv.accepted_at).length,
    expired: invitations.filter(inv => !inv.accepted_at && new Date(inv.expires_at) < new Date()).length
  };

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Invitations</h1>
            <p className="text-gray-500 mt-1">Manage user invitations across all organizations</p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Send Invitation
          </Button>
        </div>

        {/* Search and Stats */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <Card className="md:col-span-2">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search invitations..."
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
                <Mail className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{invitationStats.total}</p>
                  <p className="text-sm text-gray-500">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Mail className="h-8 w-8 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold">{invitationStats.pending}</p>
                  <p className="text-sm text-gray-500">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Mail className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{invitationStats.accepted}</p>
                  <p className="text-sm text-gray-500">Accepted</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Mail className="h-8 w-8 text-red-600" />
                <div>
                  <p className="text-2xl font-bold">{invitationStats.expired}</p>
                  <p className="text-sm text-gray-500">Expired</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <Label htmlFor="status-filter">Filter by Status:</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Invitations</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Invitations Table */}
        <Card>
          <CardHeader>
            <CardTitle>User Invitations</CardTitle>
            <CardDescription>
              A list of all user invitations in the system
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
                    <TableHead>Organization</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Invited By</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">{invitation.email}</TableCell>
                      <TableCell>{invitation.organization_name}</TableCell>
                      <TableCell>
                        <Badge className={getRoleBadge(invitation.role)}>
                          {invitation.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(invitation)}</TableCell>
                      <TableCell>{invitation.invited_by_email || '-'}</TableCell>
                      <TableCell>
                        {format(new Date(invitation.expires_at), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        {format(new Date(invitation.created_at), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {isPending(invitation) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resendInvitation(invitation.id)}
                              title="Resend invitation"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteInvitation(invitation.id, invitation.email)}
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

        {/* Create Invitation Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Send User Invitation</DialogTitle>
              <DialogDescription>
                Invite a user to join an organization with a specific role.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="organization">Organization</Label>
                <Select 
                  value={newInvitation.organization_id} 
                  onValueChange={(value) => setNewInvitation({...newInvitation, organization_id: value})}
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
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={newInvitation.email}
                  onChange={(e) => setNewInvitation({...newInvitation, email: e.target.value})}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select 
                  value={newInvitation.role} 
                  onValueChange={(value) => setNewInvitation({...newInvitation, role: value})}
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
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createInvitation}>
                <Send className="h-4 w-4 mr-2" />
                Send Invitation
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SuperAdminLayout>
  );
};

export default AdminInvitations;
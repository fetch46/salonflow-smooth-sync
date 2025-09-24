import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Phone, 
  Mail, 
  Star, 
  User, 
  Users,
  UserCheck,
  Clock,
  TrendingUp,
  Award,
  Calendar,
  MapPin,
  Filter,
  RefreshCw,
  MoreHorizontal,
  Eye,
  MessageSquare,
  Settings,
  Activity,
  Zap,
  Crown,
  CheckCircle,
  AlertTriangle,
  Camera,
  Shield,
  KeyRound,
  Send
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useFeatureGating } from "@/hooks/useFeatureGating";
import { CreateButtonGate, FeatureGate, UsageBadge } from "@/components/features/FeatureGate";
import { format, startOfDay, endOfDay } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useOrganizationCurrency, useOrganization } from "@/lib/saas/hooks";

interface Staff {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  profile_image?: string;
  specialties?: string[];
  is_active: boolean;
  commission_rate?: number;
  hire_date?: string;
  created_at: string;
  updated_at: string;
}

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

const SPECIALTY_OPTIONS = [
  "Hair Cutting",
  "Hair Coloring",
  "Hair Styling",
  "Perm & Relaxers",
  "Manicure",
  "Pedicure",
  "Nail Art",
  "Facial Treatments",
  "Eyebrow Threading",
  "Makeup",
  "Massage Therapy",
  "Waxing",
  "Brazilian Blowout",
  "Keratin Treatment",
  "Extensions",
  "Balayage",
  "Highlights",
  "Lowlights"
];

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

const STAFF_FILTERS = [
  { label: "All Staff", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "New Hires", value: "new" }
];

export default function Staff() {
  const { format: formatMoney } = useOrganizationCurrency();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("staff");
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const { toast } = useToast();
  const { hasFeature, getFeatureAccess, enforceLimit } = useFeatureGating();
  const navigate = useNavigate();
  const { organization } = useOrganization();

  // Organization Users (System Roles) State
  const [organizationUsers, setOrganizationUsers] = useState<OrganizationUser[]>([]);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false);
  const [selectedOrgUser, setSelectedOrgUser] = useState<OrganizationUser | null>(null);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'staff',
    send_email: true
  });

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    profile_image: "",
    specialties: [] as string[],
    commission_rate: 15,
    hire_date: "",
    is_active: true,
    default_location_id: "",
  });

  // Load data
  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("staff")
        .select("id, full_name, email, phone, specialties, is_active, commission_rate, created_at, updated_at");
      
      // Add organization filter for security
      if (organization?.id) {
        query = query.eq("organization_id", organization.id);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      setStaff(data || []);
    } catch (error) {
      console.error("Error fetching staff:", error);
      toast({
        title: "Error",
        description: "Failed to fetch staff",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadOrganizationUsers = useCallback(async () => {
    if (!organization?.id) return;

    try {
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
      setOrganizationUsers(data || []);
    } catch (error) {
      console.error('Error loading organization users:', error);
      toast({
        title: "Error",
        description: "Failed to load organization users",
        variant: "destructive",
      });
    }
  }, [organization?.id, toast]);

  useEffect(() => {
    fetchStaff();
    loadOrganizationUsers();
  }, [fetchStaff, loadOrganizationUsers]);

  // Role Management Functions
  const handleInviteUser = async () => {
    if (!organization?.id || !inviteForm.email.trim()) {
      toast({
        title: "Error",
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('add-org-user', {
        body: {
          organization_id: organization.id,
          email: inviteForm.email.trim(),
          role: inviteForm.role,
          send_email: inviteForm.send_email
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User invited successfully",
      });
      setIsInviteDialogOpen(false);
      setInviteForm({ email: '', role: 'staff', send_email: true });
      loadOrganizationUsers();
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to invite user",
        variant: "destructive",
      });
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
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

      toast({
        title: "Success",
        description: "Role updated successfully",
      });
      loadOrganizationUsers();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive",
      });
    }
  };

  const handleRemoveUser = async (userId: string, userName: string) => {
    if (!organization?.id) return;
    if (!confirm(`Are you sure you want to remove ${userName} from the organization?`)) return;

    try {
      const { error } = await supabase
        .from('organization_users')
        .update({ is_active: false })
        .eq('organization_id', organization.id)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User removed successfully",
      });
      loadOrganizationUsers();
    } catch (error) {
      console.error('Error removing user:', error);
      toast({
        title: "Error",
        description: "Failed to remove user",
        variant: "destructive",
      });
    }
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      accountant: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      staff: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      member: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
      viewer: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300',
    };
    return colors[role] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  };

  // Staff management functions
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.full_name.trim()) {
      toast({
        title: "Error",
        description: "Staff name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingStaff) {
        const { error } = await supabase
          .from("staff")
          .update(formData)
          .eq("id", editingStaff.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Staff member updated successfully",
        });
      } else {
        if (!organization?.id) {
          toast({
            title: "Error",
            description: "Organization not found",
            variant: "destructive",
          });
          return;
        }

        const { error } = await supabase
          .from("staff")
          .insert([{ ...formData, organization_id: organization.id }]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Staff member added successfully",
        });
      }

      setIsModalOpen(false);
      setEditingStaff(null);
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        profile_image: "",
        specialties: [],
        commission_rate: 15,
        hire_date: "",
        is_active: true,
        default_location_id: "",
      });
      fetchStaff();
    } catch (error) {
      console.error("Error saving staff:", error);
      toast({
        title: "Error",
        description: "Failed to save staff member",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (member: Staff) => {
    setEditingStaff(member);
    setFormData({
      full_name: member.full_name,
      email: member.email || "",
      phone: member.phone || "",
      profile_image: member.profile_image || "",
      specialties: member.specialties || [],
      commission_rate: member.commission_rate || 15,
      hire_date: member.hire_date || "",
      is_active: member.is_active,
      default_location_id: "",
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;

    try {
      const { error } = await supabase
        .from("staff")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Staff member deleted successfully",
      });
      fetchStaff();
    } catch (error) {
      console.error("Error deleting staff:", error);
      toast({
        title: "Error",
        description: "Failed to delete staff member",
        variant: "destructive",
      });
    }
  };

  // Filter staff based on search and filters
  const filteredStaff = useMemo(() => {
    return staff.filter(member => {
      const matchesSearch = member.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           member.phone?.includes(searchTerm);

      const matchesStatus = filterStatus === "all" || 
                           (filterStatus === "active" && member.is_active) ||
                           (filterStatus === "inactive" && !member.is_active) ||
                           (filterStatus === "new" && new Date(member.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

      const matchesSpecialty = specialtyFilter === "all" || 
                              member.specialties?.includes(specialtyFilter);

      return matchesSearch && matchesStatus && matchesSpecialty;
    });
  }, [staff, searchTerm, filterStatus, specialtyFilter]);

  // Dashboard stats
  const dashboardStats = useMemo(() => {
    return {
      totalStaff: staff.length,
      activeStaff: staff.filter(s => s.is_active).length,
      inactiveStaff: staff.filter(s => !s.is_active).length,
      newHires: staff.filter(s => new Date(s.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length,
    };
  }, [staff]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6 bg-slate-50/30 min-h-screen">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl shadow-lg">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Staff Management</h1>
              <p className="text-slate-600">Manage your team members and system roles</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button onClick={() => setIsModalOpen(true)} className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Staff Member
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Card className="shadow-sm border-slate-200">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <CardHeader className="pb-4 border-b border-slate-200">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <TabsList className="grid grid-cols-2 w-fit">
                <TabsTrigger value="staff" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Business Staff ({dashboardStats.totalStaff})
                </TabsTrigger>
                <TabsTrigger value="roles" className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  System Roles ({organizationUsers.length})
                </TabsTrigger>
              </TabsList>

            <div className="flex items-center gap-3">
              {activeTab === 'staff' && (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search staff..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_FILTERS.map((filter) => (
                        <SelectItem key={filter.value} value={filter.value}>
                          {filter.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Specialty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Specialties</SelectItem>
                      {SPECIALTY_OPTIONS.map((specialty) => (
                        <SelectItem key={specialty} value={specialty}>
                          {specialty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
              
              {activeTab === 'roles' && (
                <Button onClick={() => setIsInviteDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Invite User
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          <TabsContent value="staff" className="mt-0">
            {filteredStaff.length === 0 ? (
              <div className="text-center py-16 space-y-4">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                  <Users className="w-8 h-8 text-slate-400" />
                </div>
                <div className="space-y-2">
                  <p className="text-slate-600 font-medium">
                    {searchTerm || filterStatus !== "all" || specialtyFilter !== "all" 
                      ? "No staff members found" 
                      : "No staff members yet"}
                  </p>
                  <p className="text-slate-400 text-sm">
                    {searchTerm || filterStatus !== "all" || specialtyFilter !== "all"
                      ? "Try adjusting your filters"
                      : "Add your first team member to get started"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStaff.map((member) => (
                  <Card key={member.id} className="border-slate-200 hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-full flex items-center justify-center">
                            <User className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900">{member.full_name}</h3>
                            <p className="text-sm text-slate-500">{member.email}</p>
                          </div>
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/staff/${member.id}`)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(member)}>
                              <Edit2 className="w-4 h-4 mr-2" />
                              Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDelete(member.id, member.full_name)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">Status</span>
                          <Badge variant={member.is_active ? "default" : "secondary"}>
                            {member.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        
                        {member.commission_rate && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600">Commission</span>
                            <span className="text-sm font-medium">{member.commission_rate}%</span>
                          </div>
                        )}

                        {member.specialties && member.specialties.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Star className="w-4 h-4 text-amber-500" />
                              <span className="text-sm font-medium text-slate-700">Specialties</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {member.specialties.slice(0, 3).map((specialty) => (
                                <Badge key={specialty} variant="outline" className="text-xs">
                                  {specialty}
                                </Badge>
                              ))}
                              {member.specialties.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{member.specialties.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="roles" className="mt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizationUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.profiles?.full_name || 'Unknown'}
                    </TableCell>
                    <TableCell>{user.profiles?.email}</TableCell>
                    <TableCell>
                      <Badge className={getRoleColor(user.role)}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? 'default' : 'secondary'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
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
                              setSelectedOrgUser(user);
                              setIsEditRoleDialogOpen(true);
                            }}
                          >
                            <Edit2 className="w-4 h-4 mr-2" />
                            Edit Role
                          </DropdownMenuItem>
                          {user.role !== 'owner' && (
                            <DropdownMenuItem
                              onClick={() => handleRemoveUser(user.user_id, user.profiles?.full_name || 'User')}
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
          </TabsContent>
        </CardContent>
        </Tabs>
      </Card>

      {/* Staff Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingStaff ? "Edit Staff Member" : "Add New Staff Member"}
            </DialogTitle>
            <DialogDescription>
              {editingStaff 
                ? "Update the staff member's information below."
                : "Fill in the details to add a new staff member to your team."
              }
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Enter full name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <Label htmlFor="commission_rate">Commission Rate (%)</Label>
                <Input
                  id="commission_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.commission_rate}
                  onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) || 0 })}
                  placeholder="15"
                />
              </div>
            </div>

            <div>
              <Label>Specialties</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {SPECIALTY_OPTIONS.map((specialty) => (
                  <div key={specialty} className="flex items-center space-x-2">
                    <Checkbox
                      id={specialty}
                      checked={formData.specialties.includes(specialty)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({
                            ...formData,
                            specialties: [...formData.specialties, specialty]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            specialties: formData.specialties.filter(s => s !== specialty)
                          });
                        }
                      }}
                    />
                    <Label htmlFor={specialty} className="text-xs">
                      {specialty}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingStaff ? "Update Staff" : "Add Staff"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invite User Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Send an invitation to a new user to join your organization.
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
              <Button onClick={handleInviteUser}>
                <Mail className="w-4 h-4 mr-2" />
                Send Invitation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={isEditRoleDialogOpen} onOpenChange={setIsEditRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
            <DialogDescription>
              Change the role for {selectedOrgUser?.profiles?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-role">New Role</Label>
              <Select
                value={selectedOrgUser?.role}
                onValueChange={(value) => {
                  if (selectedOrgUser) {
                    handleUpdateUserRole(selectedOrgUser.user_id, value);
                    setIsEditRoleDialogOpen(false);
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
              <Button variant="outline" onClick={() => setIsEditRoleDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
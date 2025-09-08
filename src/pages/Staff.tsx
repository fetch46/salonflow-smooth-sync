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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { useOrganizationCurrency, useOrganization } from "@/lib/saas/hooks";
import { SelectContent as _SC } from "@/components/ui/select";

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
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  viewer: ['view_dashboard', 'view_clients', 'view_appointments', 'view_inventory', 'view_reports'],
  member: ['view_dashboard', 'view_clients', 'view_appointments', 'view_inventory', 'view_reports'],
  staff: ['view_dashboard', 'manage_clients', 'view_clients', 'manage_appointments', 'view_appointments', 'view_inventory', 'view_reports'],
  accountant: ['view_dashboard', 'view_clients', 'view_appointments', 'view_inventory', 'manage_reports', 'view_reports'],
  manager: ['view_dashboard', 'manage_clients', 'manage_appointments', 'manage_inventory', 'manage_reports', 'view_reports'],
  admin: ['view_dashboard', 'manage_clients', 'manage_appointments', 'manage_inventory', 'manage_reports', 'manage_settings', 'manage_staff'],
  owner: ['view_dashboard', 'manage_clients', 'manage_appointments', 'manage_inventory', 'manage_reports', 'manage_settings', 'manage_staff', 'manage_billing'],
};

const STAFF_FILTERS = [
  { label: "All Staff", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "New Hires", value: "new" }
];

// Removed mock performance. Real performance derived from appointments and receipts.

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
  const [todayAppts, setTodayAppts] = useState<{ staff_id: string | null; status: string }[]>([]);
  const [staffRevenueMap, setStaffRevenueMap] = useState<Record<string, number>>({});
  const [staffCommissionMap, setStaffCommissionMap] = useState<Record<string, number>>({});

  const ROLE_OPTIONS = ["owner","admin","manager","staff","viewer"] as const;

  const [rolesByStaffId, setRolesByStaffId] = useState<Record<string, string>>({});
  const [assignRoleOpen, setAssignRoleOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("staff");

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

  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [defaultLocationByStaffId, setDefaultLocationByStaffId] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        if (!organization?.id) { setLocations([]); return; }
        const { data } = await supabase
          .from('business_locations')
          .select('id, name')
          .eq('organization_id', organization.id)
          .eq('is_active', true)
          .order('name');
        setLocations(data || []);
      } catch {
        setLocations([]);
      }
    })();
  }, [organization?.id]);

  const loadDefaultLocations = useCallback(async () => {
    try {
      const { data } = await supabase.from('staff_default_locations').select('staff_id, location_id');
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { if (r.staff_id && r.location_id) map[r.staff_id] = r.location_id; });
      setDefaultLocationByStaffId(map);
    } catch {}
  }, []);

  useEffect(() => { loadDefaultLocations(); }, [loadDefaultLocations]);

  const saveDefaultLocation = async (staffId: string, locationId: string) => {
    try {
      // upsert
      const { error } = await supabase
        .from('staff_default_locations')
        .upsert({ staff_id: staffId, location_id: locationId }, { onConflict: 'staff_id' });
      if (error) throw error;
      setDefaultLocationByStaffId((prev) => ({ ...prev, [staffId]: locationId }));
      toast({ title: 'Default location updated' });
    } catch (e: any) {
      toast({ title: 'Failed to update default location', description: e?.message || 'Unexpected error', variant: 'destructive' });
    }
  };
 
  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .order("created_at", { ascending: false });

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

  // Load today's appointments and revenue per staff for dashboard cards
  useEffect(() => {
    const loadStaffMetrics = async () => {
      try {
        const today = new Date();
        const todayStr = format(today, 'yyyy-MM-dd');
        const [{ data: appts }, { data: items }, { data: jcs } ] = await Promise.all([
          supabase
            .from('appointments')
            .select('staff_id, status, appointment_date')
            .eq('appointment_date', todayStr),
          supabase
            .from('invoice_items')
            .select('staff_id, total_price, created_at')
            .not('staff_id', 'is', null)
            .gte('created_at', startOfDay(today).toISOString())
            .lte('created_at', endOfDay(today).toISOString()),
          supabase
            .from('job_card_services')
            .select('staff_id, quantity, unit_price, commission_percentage, services:service_id ( commission_percentage ), created_at')
            .gte('created_at', startOfDay(today).toISOString())
            .lte('created_at', endOfDay(today).toISOString()),
        ]);
        setTodayAppts((appts || []).map((a: any) => ({ staff_id: a.staff_id, status: a.status || '' })));
        const revMap: Record<string, number> = {};
        (items || []).forEach((it: any) => {
          const id = String(it.staff_id);
          revMap[id] = (revMap[id] || 0) + (Number(it.total_price) || 0);
        });
        setStaffRevenueMap(revMap);
        const commMap: Record<string, number> = {};
        (jcs || []).forEach((row: any) => {
          const sid = row.staff_id ? String(row.staff_id) : null;
          if (!sid) return;
          const qty = Number(row.quantity || 1);
          const unit = Number(row.unit_price || 0);
          const gross = qty * unit;
          const rate = typeof row.commission_percentage === 'number' && !isNaN(row.commission_percentage)
            ? Number(row.commission_percentage)
            : (typeof row.services?.commission_percentage === 'number' && !isNaN(row.services?.commission_percentage)
              ? Number(row.services?.commission_percentage)
              : 0);
          const commission = (gross * (rate || 0)) / 100;
          commMap[sid] = (commMap[sid] || 0) + commission;
        });
        setStaffCommissionMap(commMap);
      } catch (e) {
        // silent fail; cards will show zeros
      }
    };
    loadStaffMetrics();
  }, []);

  const fetchStaffRoles = useCallback(async () => {
    if (!organization) return;
    try {
      const staffWithEmail = staff.filter(s => !!s.email);
      if (staffWithEmail.length === 0) {
        setRolesByStaffId({});
        return;
      }
      const emails = Array.from(new Set(staffWithEmail.map(s => s.email as string)));
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, email")
        .in("email", emails);
      if (profilesError) throw profilesError;
      const emailToUserId: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { if (p.email) emailToUserId[p.email] = p.user_id });
      const userIds = Object.values(emailToUserId);
      if (userIds.length === 0) {
        setRolesByStaffId({});
        return;
      }
      const { data: orgUsers, error: orgUsersError } = await supabase
        .from("organization_users")
        .select("user_id, role")
        .eq("organization_id", organization.id)
        .in("user_id", userIds);
      if (orgUsersError) throw orgUsersError;
      const userIdToRole: Record<string, string> = {};
      (orgUsers || []).forEach((ou: any) => { userIdToRole[ou.user_id] = ou.role });
      const map: Record<string, string> = {};
      staffWithEmail.forEach(s => {
        const uid = emailToUserId[s.email as string];
        if (uid && userIdToRole[uid]) {
          map[s.id] = userIdToRole[uid];
        }
      });
      setRolesByStaffId(map);
    } catch (error) {
      console.error("Error fetching staff roles:", error);
    }
  }, [organization, staff]);

  useEffect(() => {
    fetchStaffRoles();
  }, [fetchStaffRoles]);

  const refreshData = async () => {
    try {
      setRefreshing(true);
      await fetchStaff();
      toast({
        title: "Success",
        description: "Staff data refreshed successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh data",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

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

  const getPermissionsForRole = (role: string) => {
    return ROLE_PERMISSIONS[role] || [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.full_name.trim()) {
      toast({
        title: "Error",
        description: "Full name is required",
        variant: "destructive",
      });
      return;
    }
    
    // Only send columns that exist in current DB schema
    const payload = {
      full_name: formData.full_name,
      email: formData.email || null,
      phone: formData.phone || null,
      specialties: formData.specialties || [],
      is_active: formData.is_active,
      commission_rate: formData.commission_rate || 15,
      organization_id: organization?.id || null,
    };
    
    try {
      if (editingStaff) {
        const { error } = await supabase
          .from("staff")
          .update(payload)
          .eq("id", editingStaff.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Staff member updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("staff")
          .insert([payload]);

        if (error) throw error;

        // If default location chosen on create, persist it
        if (formData.default_location_id) {
          try {
            const { data: created } = await supabase
              .from('staff')
              .select('id')
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            const newId = (created as any)?.id;
            if (newId) {
              await supabase.from('staff_default_locations').upsert({ staff_id: newId, location_id: formData.default_location_id }, { onConflict: 'staff_id' });
            }
          } catch {}
        }

        toast({
          title: "Success",
          description: "Staff member created successfully",
        });
      }

      fetchStaff();
      resetForm();
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving staff:", error);
      toast({
        title: "Error",
        description: "Failed to save staff member",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
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
    setEditingStaff(null);
  };

  const handleEdit = (staffMember: Staff) => {
    setFormData({
      full_name: staffMember.full_name,
      email: staffMember.email || "",
      phone: staffMember.phone || "",
      profile_image: staffMember.profile_image || "",
      specialties: staffMember.specialties || [],
      commission_rate: staffMember.commission_rate || 15,
      hire_date: staffMember.hire_date || "",
      is_active: staffMember.is_active,
      default_location_id: defaultLocationByStaffId[staffMember.id] || "",
    });
    setEditingStaff(staffMember);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this staff member?")) {
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
    }
  };

  const handleSpecialtyChange = (specialty: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      specialties: checked
        ? [...prev.specialties, specialty]
        : prev.specialties.filter(s => s !== specialty)
    }));
  };

  const filteredStaff = useMemo(() => {
    return staff.filter(member => {
      const matchesSearch = 
        member.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.phone?.includes(searchTerm) ||
        member.specialties?.some(specialty => 
          specialty.toLowerCase().includes(searchTerm.toLowerCase())
        );

      const matchesStatus = 
        filterStatus === "all" ||
        (filterStatus === "active" && member.is_active) ||
        (filterStatus === "inactive" && !member.is_active) ||
        (filterStatus === "new" && member.hire_date && 
          new Date(member.hire_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

      const matchesSpecialty = 
        specialtyFilter === "all" ||
        member.specialties?.includes(specialtyFilter);

      return matchesSearch && matchesStatus && matchesSpecialty;
    });
  }, [staff, searchTerm, filterStatus, specialtyFilter]);

  // Dashboard statistics
  const dashboardStats = useMemo(() => {
    const totalStaff = staff.length;
    const activeStaff = staff.filter(s => s.is_active).length;
    const inactiveStaff = totalStaff - activeStaff;
    const newHires = staff.filter(s => 
      s.hire_date && new Date(s.hire_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length;
    
    const avgCommissionRate = staff.length > 0 
      ? staff.reduce((sum, s) => sum + (s.commission_rate || 0), 0) / staff.length 
      : 0;

    const specialtyDistribution = staff.reduce((acc, member) => {
      member.specialties?.forEach(specialty => {
        acc[specialty] = (acc[specialty] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    const topSpecialties = Object.entries(specialtyDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    return {
      totalStaff,
      activeStaff,
      inactiveStaff,
      newHires,
      avgCommissionRate,
      topSpecialties
    };
  }, [staff]);

  const staffUtilization = useMemo(() => {
    const activeCount = staff.filter(s => s.is_active).length;
    const utilizedCount = new Set(todayAppts.map(a => a.staff_id).filter(Boolean)).size;
    return activeCount > 0 ? Math.round((utilizedCount / activeCount) * 100) : 0;
  }, [staff, todayAppts]);

  const getTabStaff = (tab: string) => {
    switch (tab) {
      case "active":
        return filteredStaff.filter(s => s.is_active);
      case "inactive":
        return filteredStaff.filter(s => !s.is_active);
      case "new":
        return filteredStaff.filter(s => 
          s.hire_date && new Date(s.hire_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        );
      default:
        return filteredStaff;
    }
  };

  const currentStaff = getTabStaff(activeTab);

  const getPerformanceData = (staffId: string) => {
    // Compute performance from today's appointments and receipts
    const appts = todayAppts.filter(a => a.staff_id === staffId);
    const appointments = appts.length;
    const completed = appts.filter(a => (a.status || '').toLowerCase() === 'completed').length;
    const completionRate = appointments > 0 ? Math.round((completed / appointments) * 100) : 0;
    const revenue = staffRevenueMap[staffId] || 0;
    const rating = 0;
    return { appointments, revenue, rating, completionRate };
  };

  const openAssignRole = (member: Staff) => {
    setSelectedStaff(member);
    const current = rolesByStaffId[member.id] || "staff";
    setSelectedRole(current);
    setAssignRoleOpen(true);
  };

  const assignRoleToStaff = async () => {
    if (!organization) {
      toast({ title: "Error", description: "No organization selected", variant: "destructive" });
      return;
    }
    if (!selectedStaff) return;
    if (!selectedStaff.email) {
      toast({ title: "Email required", description: "Staff must have an email to assign a role.", variant: "destructive" });
      return;
    }
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", selectedStaff.email)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) {
        toast({ title: "User not found", description: "No user account matches this staff email.", variant: "destructive" });
        return;
      }
      const { error: upsertError } = await supabase
        .from("organization_users")
        .upsert([
          {
            organization_id: organization.id,
            user_id: profile.user_id,
            role: selectedRole,
            is_active: true,
          }
        ], { onConflict: "organization_id,user_id" });
      if (upsertError) throw upsertError;
      toast({ title: "Role assigned", description: `${selectedStaff.full_name} is now ${selectedRole}.` });
      setAssignRoleOpen(false);
      setSelectedStaff(null);
      fetchStaffRoles();
    } catch (error) {
      console.error("Error assigning role:", error);
      toast({ title: "Error", description: "Failed to assign role", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex-1 space-y-6 p-6 bg-slate-50/30 min-h-screen">
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-slate-600">Loading staff...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6 bg-slate-50/30 min-h-screen">
      {/* Modern Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl shadow-lg">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Staff Management</h1>
              <p className="text-slate-600">Manage your team members and track performance</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2">
            <Button variant={viewMode === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('table')}>
              Table
            </Button>
            <Button variant={viewMode === 'cards' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('cards')}>
              Cards
            </Button>
          </div>
          <Button 
            variant="outline" 
            onClick={refreshData}
            disabled={refreshing}
            className="border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <CreateButtonGate
            feature="staff"
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
          >
            <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg">
              <Plus className="w-4 h-4 mr-2" />
              Add Staff Member
            </Button>
          </CreateButtonGate>

          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <div style={{ display: 'none' }} />
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
              <DialogHeader className="pb-4 border-b">
                <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  {editingStaff ? "Edit Staff Member" : "Add New Staff Member"}
                </DialogTitle>
                <DialogDescription className="text-slate-600">
                  {editingStaff ? "Update staff member information and specialties" : "Add a new team member to your salon"}
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    Personal Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Full Name *</Label>
                      <Input
                        id="full_name"
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        placeholder="Enter full name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="staff@example.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hire_date">Hire Date</Label>
                      <Input
                        id="hire_date"
                        type="date"
                        value={formData.hire_date}
                        onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Professional Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-600" />
                    Professional Details
                  </h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="commission_rate">Commission Rate (%)</Label>
                    <Input
                      id="commission_rate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={formData.commission_rate}
                      onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) || 0 })}
                      placeholder="15"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="profile_image">Profile Image URL</Label>
                    <Input
                      id="profile_image"
                      placeholder="https://example.com/profile.jpg"
                      value={formData.profile_image}
                      onChange={(e) => setFormData({ ...formData, profile_image: e.target.value })}
                    />
                    <p className="text-xs text-slate-500">
                      Enter a URL to an image or upload to a service like Imgur, Cloudinary, etc.
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Specialties */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-600" />
                    Specialties
                  </h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {SPECIALTY_OPTIONS.map((specialty) => (
                      <div key={specialty} className="flex items-center space-x-2">
                        <Checkbox
                          id={specialty}
                          checked={formData.specialties.includes(specialty)}
                          onCheckedChange={(checked) => 
                            handleSpecialtyChange(specialty, checked as boolean)
                          }
                        />
                        <Label htmlFor={specialty} className="text-sm">
                          {specialty}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  >
                    {editingStaff ? "Update Staff Member" : "Add Staff Member"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Dashboard Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
              Total Staff
              <UsageBadge feature="staff" className="bg-card/20 text-card-foreground border-border/30" />
            </CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{dashboardStats.totalStaff}</div>
            <p className="text-xs text-blue-600">
              {dashboardStats.activeStaff} active, {dashboardStats.inactiveStaff} inactive
              {(() => {
                const access = getFeatureAccess('staff');
                if (access.limit && access.usage !== undefined) {
                  return ` • ${access.limit - access.usage} slots remaining`;
                }
                return '';
              })()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Active Staff</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{dashboardStats.activeStaff}</div>
            <p className="text-xs text-green-600">
              {((dashboardStats.activeStaff / dashboardStats.totalStaff) * 100).toFixed(1)}% of total team
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">Staff Utilization</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{staffUtilization}%</div>
            <p className="text-xs text-orange-600">
              Active staff utilized today
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-amber-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-700">Avg Commission</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">{dashboardStats.avgCommissionRate.toFixed(1)}%</div>
            <p className="text-xs text-amber-600">
              Average team rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Specialties */}
      {dashboardStats.topSpecialties.length > 0 && (
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Top Specialties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {dashboardStats.topSpecialties.map(([specialty, count], index) => (
                <div key={specialty} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      index === 0 ? 'bg-amber-500' : 
                      index === 1 ? 'bg-slate-400' : 'bg-orange-500'
                    }`} />
                    <span className="font-medium text-sm">{specialty}</span>
                  </div>
                  <Badge variant="secondary">{count} staff</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters & Search */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-4 border-b border-slate-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-fit">
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
            </Tabs>

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
          <TabsContent value="staff" className="mt-0">{/* Staff content goes here */}
          {currentStaff.length === 0 ? (
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
              {!searchTerm && filterStatus === "all" && specialtyFilter === "all" && (
                <Button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Staff Member
                </Button>
              )}
            </div>
          ) : (
            <FeatureGate feature="staff">
              {viewMode === 'table' ? (
                <div className="overflow-x-auto">
                  <Table className="min-w-[900px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Commission %</TableHead>
                        <TableHead>Today Comm.</TableHead>
                        <TableHead>Hire Date</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Default Location</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentStaff.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.full_name}</TableCell>
                          <TableCell>{member.email || '—'}</TableCell>
                          <TableCell>{member.phone || '—'}</TableCell>
                          <TableCell>{member.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                          <TableCell>{typeof member.commission_rate === 'number' ? `${member.commission_rate}%` : '—'}</TableCell>
                          <TableCell>{(staffCommissionMap[member.id] || 0).toFixed(2)}</TableCell>
                          <TableCell>{member.hire_date || '—'}</TableCell>
                          <TableCell>
                            {rolesByStaffId[member.id] ? (
                              <Badge variant="outline" className="capitalize flex items-center gap-1">
                                <Shield className="w-3 h-3" /> {rolesByStaffId[member.id]}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select value={defaultLocationByStaffId[member.id] || ''} onValueChange={(val) => saveDefaultLocation(member.id, val)}>
                              <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {locations.map((loc) => (
                                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem onClick={() => navigate(`/staff/${member.id}`)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(member)}>
                                  <Edit2 className="w-4 h-4 mr-2" />
                                  Edit Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openAssignRole(member)}>
                                  <Shield className="w-4 h-4 mr-2" />
                                  Assign Role
                                </DropdownMenuItem>
                                {member.email && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={async () => {
                                        try {
                                          // If the staff user does not yet exist, send invitation
                                          const { data: profile } = await supabase.from('profiles').select('user_id').eq('email', member.email).maybeSingle();
                                          if (profile?.user_id) {
                                            toast({ title: 'User already exists', description: 'This email already has an account.' });
                                            return;
                                          }
                                          const { data: me } = await supabase.auth.getUser();
                                          const activeOrgId = localStorage.getItem('activeOrganizationId');
                                          if (!activeOrgId) {
                                            toast({ title: 'No active organization', variant: 'destructive' });
                                            return;
                                          }
                                          const token = crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
                                          const expiresAt = new Date();
                                          expiresAt.setDate(expiresAt.getDate() + 7);
                                          const { error } = await supabase.from('user_invitations').insert({
                                            organization_id: activeOrgId,
                                            email: member.email,
                                            role: 'staff',
                                            invited_by: me?.user?.id || null,
                                            token,
                                            expires_at: expiresAt.toISOString(),
                                          });
                                          if (error) throw error;
                                          toast({ title: 'Invitation sent' });
                                        } catch (e) {
                                          console.error('Invite error', e);
                                          toast({ title: 'Failed to send invitation', variant: 'destructive' });
                                        }
                                      }}
                                    >
                                      <Send className="w-4 h-4 mr-2" />
                                      Send Login Invitation
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={async () => {
                                        if (!member.email) {
                                          toast({ title: "Email required", description: "Staff must have an email to create user account.", variant: "destructive" });
                                          return;
                                        }
                                        const password = prompt('Set initial password for ' + member.full_name + ' (minimum 8 characters)');
                                        if (!password || password.length < 8) {
                                          toast({ title: "Invalid password", description: "Password must be at least 8 characters long.", variant: "destructive" });
                                          return;
                                        }

                                        try {
                                          // Create user account
                                          const { data: authData, error: authError } = await supabase.auth.signUp({
                                            email: member.email,
                                            password,
                                            options: {
                                              emailRedirectTo: `${window.location.origin}/`,
                                              data: {
                                                full_name: member.full_name,
                                                role: 'staff',
                                              }
                                            }
                                          });

                                          if (authError) throw authError;

                                          if (authData.user && organization?.id) {
                                            // Add user to organization
                                            const { error: orgError } = await supabase
                                              .from("organization_users")
                                              .insert({
                                                organization_id: organization.id,
                                                user_id: authData.user.id,
                                                role: 'staff',
                                                is_active: true,
                                              });

                                            if (orgError) throw orgError;

                                            toast({ 
                                              title: "User account created", 
                                              description: `${member.full_name} can now log in with their email and password.` 
                                            });
                                            fetchStaffRoles();
                                          }
                                        } catch (error: any) {
                                          console.error("Error creating user:", error);
                                          if (error.message?.includes('User already registered')) {
                                            toast({ title: "User exists", description: "A user with this email already exists.", variant: "destructive" });
                                          } else {
                                            toast({ title: "Error", description: "Failed to create user account", variant: "destructive" });
                                          }
                                        }
                                      }}
                                    >
                                      <KeyRound className="w-4 h-4 mr-2" />
                                      Create User Account
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={async () => {
                                        try {
                                          const redirectTo = `${window.location.origin}/reset-password`;
                                          const { error } = await supabase.auth.resetPasswordForEmail(member.email as string, { redirectTo } as any);
                                          if (error) throw error;
                                          toast({ title: 'Password reset email sent' });
                                        } catch (e) {
                                          console.error('Reset email error', e);
                                          toast({ title: 'Failed to send reset email', variant: 'destructive' });
                                        }
                                      }}
                                    >
                                      <Mail className="w-4 h-4 mr-2" />
                                      Send Reset Email
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={async () => {
                                        try {
                                          // lookup profile for user_id
                                          const { data: profile } = await supabase.from('profiles').select('user_id').eq('email', member.email).maybeSingle();
                                          if (!profile?.user_id) {
                                            toast({ title: 'No user account', description: 'Invite the staff to create an account first.', variant: 'destructive' });
                                            return;
                                          }
                                          const activeOrgId = localStorage.getItem('activeOrganizationId');
                                          const newPass = prompt('Enter new password (min 8 chars)');
                                          if (!newPass || newPass.length < 8) return;
                                          const { error } = await supabase.functions.invoke('set-user-password', {
                                            body: { user_id: profile.user_id, new_password: newPass, organization_id: activeOrgId || undefined }
                                          });
                                          if (error) throw error;
                                          toast({ title: 'Password updated' });
                                        } catch (e) {
                                          console.error('Set password error', e);
                                          toast({ title: 'Failed to set password', variant: 'destructive' });
                                        }
                                      }}
                                    >
                                      <KeyRound className="w-4 h-4 mr-2" />
                                      Set Password
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDelete(member.id)} className="text-red-600 focus:text-red-600">
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {currentStaff.map((member) => {
                  const performance = getPerformanceData(member.id);
                  return (
                    <Card key={member.id} className="hover:shadow-lg transition-all duration-300 border-slate-200 relative overflow-hidden">
                      {/* Performance Indicator */}
                      <div className={`absolute top-0 left-0 w-full h-1 ${
                        performance.rating >= 4.8 ? 'bg-gradient-to-r from-emerald-500 to-green-500' :
                        performance.rating >= 4.5 ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
                        performance.rating >= 4.0 ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                        'bg-gradient-to-r from-slate-400 to-slate-500'
                      }`} />
                      
                      <CardHeader className="pb-4">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            {/* Enhanced Profile Avatar */}
                            <div className="relative">
                              <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center border-2 border-white shadow-lg">
                                {member.profile_image ? (
                                  <img
                                    src={member.profile_image}
                                    alt={member.full_name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.currentTarget as HTMLImageElement;
                                      target.style.display = 'none';
                                      const sibling = target.nextElementSibling as HTMLElement;
                                      if (sibling) sibling.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div 
                                  className={`w-full h-full flex items-center justify-center text-white font-bold text-lg ${member.profile_image ? 'hidden' : 'flex'}`}
                                  style={{ display: member.profile_image ? 'none' : 'flex' }}
                                >
                                  {member.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                              </div>
                              {performance.rating >= 4.8 && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                                  <Crown className="w-3 h-3 text-white" />
                                </div>
                              )}
                            </div>
                            
                            <div>
                              <CardTitle className="text-lg font-bold text-slate-900">{member.full_name}</CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant={member.is_active ? "default" : "secondary"} className="text-xs">
                                  {member.is_active ? "Active" : "Inactive"}
                                </Badge>
                                {member.commission_rate && (
                                  <Badge variant="outline" className="text-xs">
                                    {member.commission_rate}% comm.
                                  </Badge>
                                )}
                                <Badge variant="secondary" className="text-xs">
                                  Today: {(staffCommissionMap[member.id] || 0).toFixed(2)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => handleEdit(member)}>
                                <Edit2 className="w-4 h-4 mr-2" />
                                Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/staff/${member.id}`)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openAssignRole(member)}>
                                <Shield className="w-4 h-4 mr-2" />
                                Assign Role
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Calendar className="w-4 h-4 mr-2" />
                                View Schedule
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <MessageSquare className="w-4 h-4 mr-2" />
                                Send Message
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDelete(member.id)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        {/* Contact Information */}
                        <div className="space-y-2">
                          {member.email && (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Mail className="w-4 h-4 text-slate-400" />
                              <span className="truncate">{member.email}</span>
                            </div>
                          )}
                          {member.phone && (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Phone className="w-4 h-4 text-slate-400" />
                              <span>{member.phone}</span>
                            </div>
                          )}
                          {member.hire_date && (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Calendar className="w-4 h-4 text-slate-400" />
                              <span>Hired {format(new Date(member.hire_date), "MMM dd, yyyy")}</span>
                            </div>
                          )}
                        </div>

                        {/* Performance Metrics */}
                        {performance.appointments > 0 && (
                          <div className="pt-3 border-t border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-slate-700">This Month</span>
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                <span className="text-sm font-medium">{performance.rating}</span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="text-slate-500">Appointments</p>
                                <p className="font-semibold text-slate-900">{performance.appointments}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">Revenue</p>
                                <p className="font-semibold text-slate-900">{formatMoney(performance.revenue, { decimals: 0 })}</p>
                              </div>
                            </div>
                            <div className="mt-2">
                              <div className="flex justify-between items-center text-xs mb-1">
                                <span className="text-slate-500">Completion Rate</span>
                                <span className="font-medium">{performance.completionRate}%</span>
                              </div>
                              <Progress value={performance.completionRate} className="h-1.5" />
                            </div>
                          </div>
                        )}

                        {/* Specialties */}
                        {member.specialties && member.specialties.length > 0 && (
                          <div className="pt-3 border-t border-slate-100">
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
                      </CardContent>
                    </Card>
                  );
                })}
                </div>
              )}
            </FeatureGate>
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
                    <TableCell>{user.profiles?.full_name || 'Unknown'}</TableCell>
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
                          <DropdownMenuItem onClick={() => {
                            setSelectedOrgUser(user);
                            setIsEditRoleDialogOpen(true);
                          }}>
                            <Edit2 className="w-4 h-4 mr-2" />Edit Role
                          </DropdownMenuItem>
                          {user.role !== 'owner' && (
                            <DropdownMenuItem onClick={() => handleRemoveUser(user.user_id, user.profiles?.full_name || 'User')} className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" />Remove
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
      </Card>

      {/* Role Management Dialogs */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>Send an invitation to join your organization.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email Address</Label>
              <Input value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="user@example.com" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={inviteForm.role} onValueChange={(value) => setInviteForm({ ...inviteForm, role: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_HIERARCHY.filter(role => role !== 'owner').map((role) => (
                    <SelectItem key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleInviteUser}>Send Invitation</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditRoleDialogOpen} onOpenChange={setIsEditRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
            <DialogDescription>Change the role for {selectedOrgUser?.profiles?.full_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedOrgUser?.role} onValueChange={(value) => {
              if (selectedOrgUser) {
                handleUpdateUserRole(selectedOrgUser.user_id, value);
                setIsEditRoleDialogOpen(false);
              }
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_HIERARCHY.filter(role => role !== 'owner').map((role) => (
                  <SelectItem key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>
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
      </Card>

      {/* Invite Dialog */}
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
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleInviteUser}>
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
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={assignRoleOpen} onOpenChange={setAssignRoleOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" /> Assign Role
            </DialogTitle>
            <DialogDescription>
              {selectedStaff ? `Assign an organization role to ${selectedStaff.full_name}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Staff</Label>
              <div className="text-sm text-slate-700">
                {selectedStaff ? `${selectedStaff.full_name} (${selectedStaff.email || 'no email'})` : '-'}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAssignRoleOpen(false)}>Cancel</Button>
            <Button onClick={assignRoleToStaff}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

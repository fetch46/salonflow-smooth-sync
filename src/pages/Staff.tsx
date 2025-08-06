import React, { useState, useEffect, useCallback } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Phone, 
  Mail, 
  Star,
  Users,
  UserPlus,
  UserMinus,
  MoreHorizontal,
  X,
  Check,
  AlertTriangle
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogTrigger 
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/utils";

// Types
interface Staff {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  specialties?: string[];
  is_active: boolean;
  role?: string;
  hourly_rate?: number;
  created_at: string;
  updated_at: string;
}

// Constants
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
  "Lash Extensions",
  "Bridal Services",
  "Kids Haircut",
  "Men's Grooming"
] as const;

const ROLE_OPTIONS = [
  "Stylist",
  "Colorist",
  "Barber",
  "Nail Technician",
  "Esthetician",
  "Massage Therapist",
  "Manager",
  "Owner"
] as const;

type RoleType = typeof ROLE_OPTIONS[number];

// Status configuration for consistency
const STATUS_CONFIG = {
  active: { label: "Active", color: "bg-green-100 text-green-800" },
  inactive: { label: "Inactive", color: "bg-red-100 text-red-800" }
} as const;

type StatusType = keyof typeof STATUS_CONFIG;

export default function Staff() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<Staff[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    specialties: [] as string[],
    role: "" as RoleType | "",
    hourly_rate: undefined as number | undefined,
    is_active: true,
  });

  // Fetch staff with error handling
  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      setStaff(data || []);
      setFilteredStaff(data || []);
    } catch (error: any) {
      console.error("Error fetching staff:", error);
      toast.error("Failed to fetch staff. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Subscribe to real-time changes
  useEffect(() => {
    const channel = supabase
      .channel('staff-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'staff' },
        () => fetchStaff()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'staff' },
        () => fetchStaff()
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'staff' },
        () => fetchStaff()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStaff]);

  // Initial data fetch
  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // Apply filters whenever search or filter values change
  useEffect(() => {
    let filtered = [...staff];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(member => 
        member.full_name.toLowerCase().includes(term) ||
        (member.email && member.email.toLowerCase().includes(term)) ||
        (member.phone && member.phone.includes(term)) ||
        (member.specialties && member.specialties.some(specialty => 
          specialty.toLowerCase().includes(term)
        )) ||
        (member.role && member.role.toLowerCase().includes(term))
      );
    }

    // Apply status filter
    if (statusFilter === "active") {
      filtered = filtered.filter(member => member.is_active);
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter(member => !member.is_active);
    }

    // Apply specialty filter
    if (specialtyFilter !== "all") {
      filtered = filtered.filter(member => 
        member.specialties?.includes(specialtyFilter)
      );
    }

    setFilteredStaff(filtered);
  }, [staff, searchTerm, statusFilter, specialtyFilter]);

  // Form handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Handle different input types
    if (name === "hourly_rate") {
      setFormData(prev => ({ 
        ...prev, 
        [name]: value === "" ? undefined : parseFloat(value) 
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Specialty change handler
  const handleSpecialtyChange = (specialty: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      specialties: checked
        ? [...prev.specialties, specialty]
        : prev.specialties.filter(s => s !== specialty)
    }));
  };

  // Validation function
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.full_name.trim()) {
      newErrors.full_name = "Full name is required";
    }
    
    if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    
    if (formData.phone && !/^\+?[\d\s\-\(\)]+$/.test(formData.phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }
    
    if (formData.hourly_rate !== undefined && formData.hourly_rate < 0) {
      newErrors.hourly_rate = "Hourly rate cannot be negative";
    }
    
    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingStaff) {
        const { error } = await supabase
          .from("staff")
          .update(formData)
          .eq("id", editingStaff.id);
          
        if (error) throw error;
        
        toast.success("Staff member updated successfully!");
      } else {
        const { error } = await supabase
          .from("staff")
          .insert([formData]);
          
        if (error) throw error;
        
        toast.success("Staff member created successfully!");
      }
      
      fetchStaff();
      resetForm();
      setIsModalOpen(false);
    } catch (error: any) {
      toast.error(editingStaff ? "Error updating staff member" : "Error creating staff member");
      console.error("Error saving staff:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      email: "",
      phone: "",
      specialties: [],
      role: "",
      hourly_rate: undefined,
      is_active: true,
    });
    setEditingStaff(null);
    setFormErrors({});
  };

  const handleEdit = (staffMember: Staff) => {
    setFormData({
      full_name: staffMember.full_name,
      email: staffMember.email || "",
      phone: staffMember.phone || "",
      specialties: staffMember.specialties || [],
      role: (staffMember.role as RoleType) || "",
      hourly_rate: staffMember.hourly_rate,
      is_active: staffMember.is_active,
    });
    setEditingStaff(staffMember);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const staffMember = staff.find(s => s.id === id);
    if (!staffMember) return;
    
    const result = confirm(`Are you sure you want to delete ${staffMember.full_name}? This action cannot be undone.`);
    
    if (!result) return;
    
    try {
      const { error } = await supabase
        .from("staff")
        .delete()
        .eq("id", id);
        
      if (error) throw error;
      
      toast.success("Staff member deleted successfully!");
      fetchStaff();
    } catch (error: any) {
      toast.error("Error deleting staff member");
      console.error("Error deleting staff:", error);
    }
  };

  // Helper functions
  const getStatusBadge = (isActive: boolean) => {
    const config = isActive 
      ? STATUS_CONFIG.active 
      : STATUS_CONFIG.inactive;
    
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setSpecialtyFilter("all");
  };

  // Stats calculations
  const totalStaff = staff.length;
  const activeStaff = staff.filter(s => s.is_active).length;
  const inactiveStaff = totalStaff - activeStaff;

  // Get unique specialties for filtering
  const uniqueSpecialties = Array.from(
    new Set(staff.flatMap(s => s.specialties || []))
  ).sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading staff members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Staff Management</h1>
          <p className="text-muted-foreground">Manage your salon team members</p>
        </div>
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="flex items-center gap-2 self-start md:self-auto">
              <Plus className="w-4 h-4" />
              Add Staff Member
            </Button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingStaff ? "Edit Staff Member" : "Add New Staff Member"}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name *</Label>
                  <div className="relative">
                    <UserPlus className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      name="full_name"
                      required
                      className={`pl-10 ${formErrors.full_name ? "border-red-500" : ""}`}
                    />
                  </div>
                  {formErrors.full_name && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.full_name}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      name="email"
                      className={`pl-10 ${formErrors.email ? "border-red-500" : ""}`}
                    />
                  </div>
                  {formErrors.email && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.email}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      name="phone"
                      placeholder="(555) 123-4567"
                      className={`pl-10 ${formErrors.phone ? "border-red-500" : ""}`}
                    />
                  </div>
                  {formErrors.phone && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.phone}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select 
                    value={formData.role} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, role: value as RoleType }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="hourly_rate">Hourly Rate</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="hourly_rate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.hourly_rate ?? ""}
                      onChange={handleInputChange}
                      name="hourly_rate"
                      placeholder="0.00"
                      className={`pl-6 ${formErrors.hourly_rate ? "border-red-500" : ""}`}
                    />
                  </div>
                  {formErrors.hourly_rate && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.hourly_rate}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center space-x-2">
                    <Check className={`h-5 w-5 ${formData.is_active ? "text-green-500" : "text-gray-300"}`} />
                    <Label htmlFor="is_active" className="flex-1 cursor-pointer">
                      Staff member is active
                    </Label>
                    <div 
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        formData.is_active ? "bg-green-500" : "bg-gray-300"
                      }`}
                      onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                    >
                      <div 
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.is_active ? "translate-x-6" : "translate-x-1"
                        }`} 
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Specialties</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
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
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {editingStaff ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    editingStaff ? "Update Staff" : "Create Staff"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search staff by name, email, phone, role, or specialty..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Specialties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Specialties</SelectItem>
              {uniqueSpecialties.map((specialty) => (
                <SelectItem key={specialty} value={specialty}>
                  {specialty}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {(searchTerm || statusFilter !== "all" || specialtyFilter !== "all") && (
            <Button
              variant="outline"
              size="icon"
              onClick={clearFilters}
              title="Clear all filters"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
            <Users className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStaff}</div>
            <CardDescription className="text-xs mt-1">
              {filteredStaff.length} shown
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
            <UserPlus className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeStaff}</div>
            <CardDescription className="text-xs mt-1">
              {Math.round((activeStaff / Math.max(totalStaff, 1)) * 100)}% of total
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Staff</CardTitle>
            <UserMinus className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inactiveStaff}</div>
            <CardDescription className="text-xs mt-1">
              {Math.round((inactiveStaff / Math.max(totalStaff, 1)) * 100)}% of total
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Staff Grid */}
      {filteredStaff.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No staff members found</h3>
          <p className="text-muted-foreground mb-4">
            {staff.length === 0 
              ? "You don't have any staff members yet."
              : "No staff members match your current filters."
            }
          </p>
          <Button 
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add your first staff member
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredStaff.map((member) => (
            <Card 
              key={member.id} 
              className="hover:shadow-md transition-shadow group"
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center text-primary-foreground font-semibold text-lg">
                      {getInitials(member.full_name)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{member.full_name}</CardTitle>
                      {member.role && (
                        <CardDescription className="text-sm mt-1">
                          {member.role}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem 
                          onClick={() => handleEdit(member)}
                          className="cursor-pointer"
                        >
                          <Edit2 className="mr-2 h-4 w-4" />
                          <span>Edit Staff</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(member.id)}
                          className="text-red-600 cursor-pointer"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Delete Staff</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  {getStatusBadge(member.is_active)}
                  {member.hourly_rate !== undefined && (
                    <Badge variant="secondary" className="text-xs">
                      ${member.hourly_rate.toFixed(2)}/hr
                    </Badge>
                  )}
                </div>
                
                <div className="space-y-2">
                  {member.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span className="truncate max-w-xs" title={member.email}>
                        {member.email}
                      </span>
                    </div>
                  )}
                  {member.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span>{formatPhoneNumber(member.phone)}</span>
                    </div>
                  )}
                </div>
                
                {member.specialties && member.specialties.length > 0 && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Specialties</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {member.specialties.map((specialty) => (
                        <Badge key={specialty} variant="outline" className="text-xs">
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground mt-2">
                  Joined {new Date(member.created_at).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

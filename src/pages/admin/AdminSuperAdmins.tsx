import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { Shield, UserPlus, UserX, Search } from "lucide-react";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";

interface SuperAdminRecord {
  id: string;
  user_id: string;
  granted_by: string | null;
  granted_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ProfileRecord {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
}

export default function AdminSuperAdmins() {
  const [superAdmins, setSuperAdmins] = useState<SuperAdminRecord[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRecord>>({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [grantEmail, setGrantEmail] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [{ data: superAdminData, error: saError }, { data: profilesData, error: pError }] = await Promise.all([
        supabase.from("super_admins").select("*").order("granted_at", { ascending: false }),
        supabase.from("profiles").select("user_id, email, full_name, created_at"),
      ]);

      if (saError) throw saError;
      if (pError) throw pError;

      setSuperAdmins(superAdminData || []);
      const byId: Record<string, ProfileRecord> = {};
      (profilesData || []).forEach((p) => {
        byId[p.user_id] = p as ProfileRecord;
      });
      setProfiles(byId);
    } catch (error) {
      console.error("Error fetching super admins:", error);
      toast.error("Failed to fetch super admins");
    } finally {
      setLoading(false);
    }
  };

  const handleGrant = async () => {
    if (!grantEmail) {
      toast.error("Please enter a user email");
      return;
    }

    try {
      // Find user by email in profiles
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", grantEmail)
        .single();

      if (profileError || !profile) {
        toast.error("User not found with that email address");
        return;
      }

      // Check if already active super admin
      const { data: existing } = await supabase
        .from("super_admins")
        .select("id, is_active")
        .eq("user_id", profile.user_id)
        .single();

      if (existing && existing.is_active) {
        toast.error("User is already a super admin");
        return;
      }

      // Try RPC first
      const { error: rpcError } = await supabase.rpc("grant_super_admin", {
        target_user_id: profile.user_id,
      });

      if (rpcError) {
        console.warn("grant_super_admin RPC failed, falling back to direct upsert", rpcError);
        const currentUser = (await supabase.auth.getUser()).data.user;
        const { error: insertError } = await supabase.from("super_admins").upsert({
          user_id: profile.user_id,
          granted_by: currentUser?.id ?? null,
          granted_at: new Date().toISOString(),
          is_active: true,
        });
        if (insertError) throw insertError;
      }

      toast.success("Super admin granted");
      setIsGrantModalOpen(false);
      setGrantEmail("");
      fetchData();
    } catch (error) {
      console.error("Error granting super admin:", error);
      toast.error("Failed to grant super admin");
    }
  };

  const handleRevoke = async (userId: string) => {
    if (!confirm("Revoke super admin privileges for this user?")) return;
    try {
      const { error } = await supabase.rpc("revoke_super_admin", { target_user_id: userId });
      if (error) throw error;
      toast.success("Super admin revoked");
      fetchData();
    } catch (error) {
      console.error("Error revoking super admin:", error);
      toast.error("Failed to revoke super admin");
    }
  };

  const filtered = superAdmins.filter((sa) => {
    const p = profiles[sa.user_id];
    const hay = `${sa.user_id} ${p?.email ?? ""} ${p?.full_name ?? ""}`.toLowerCase();
    return hay.includes(searchTerm.toLowerCase());
  });

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Super Administrators</h1>
            <p className="text-gray-500 mt-1">Manage users with super admin privileges</p>
          </div>

          <div className="flex gap-3 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by email or user id..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-72"
              />
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
                  <DialogTitle>Grant Super Admin</DialogTitle>
                  <DialogDescription>Enter the email of the user to grant super admin access.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="grantEmail">User Email</Label>
                    <Input
                      id="grantEmail"
                      type="email"
                      value={grantEmail}
                      onChange={(e) => setGrantEmail(e.target.value)}
                      placeholder="user@example.com"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsGrantModalOpen(false)}>Cancel</Button>
                    <Button onClick={handleGrant}>Grant</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Super Admins
            </CardTitle>
            <CardDescription>Active and historical super admin assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Granted At</TableHead>
                    <TableHead>Granted By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((admin) => {
                    const p = profiles[admin.user_id];
                    return (
                      <TableRow key={admin.id} className="hover:bg-muted/50">
                        <TableCell>
                          <code className="text-sm bg-muted px-1.5 py-0.5 rounded">{admin.user_id}</code>
                        </TableCell>
                        <TableCell className="font-medium">{p?.email ?? "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{format(new Date(admin.granted_at), "MMM dd, yyyy HH:mm")}</TableCell>
                        <TableCell>
                          <code className="text-sm bg-muted px-1.5 py-0.5 rounded">{admin.granted_by ?? "System"}</code>
                        </TableCell>
                        <TableCell>
                          <Badge variant={admin.is_active ? "default" : "secondary"}>{admin.is_active ? "Active" : "Inactive"}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {admin.is_active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevoke(admin.user_id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {!loading && filtered.length === 0 && (
              <div className="text-center py-8 text-gray-500">No super admins found</div>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
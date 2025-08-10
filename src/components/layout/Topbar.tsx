import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Building2, ChevronDown, CreditCard, Crown, LogOut, Search, Settings, Shield, User } from "lucide-react";
import { useSaas } from "@/lib/saas/context";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

function useSignOut() {
  const navigate = useNavigate();
  const handleSignOut = async () => {
    try {
      const { cleanupAuthState } = await import("@/utils/authUtils");
      cleanupAuthState();
      try {
        await supabase.auth.signOut({ scope: "global" } as any);
      } catch (_) { /* ignore sign-out errors */ }
    } finally {
      window.location.href = "/login";
    }
  };
  return { handleSignOut, navigate };
}

function RoleBadge({ role }: { role?: string | null }) {
  if (!role) return null;
  const roleColor =
    role === "owner" ? "text-amber-600" : role === "admin" ? "text-purple-600" : role === "manager" ? "text-blue-600" : "text-slate-600";
  return (
    <div className={`text-xs flex items-center gap-1 ${roleColor}`}>
      {role === "owner" ? <Crown className="w-3 h-3" /> : null}
      {role}
    </div>
  );
}

export function AppTopbar() {
  const { user, organization, organizations, organizationRole, subscriptionPlan, isTrialing, daysLeftInTrial, switchOrganization } = useSaas();
  const { handleSignOut, navigate } = useSignOut();

  const [notifications, setNotifications] = useState<any[]>([])
  const [notifLoading, setNotifLoading] = useState(false)

  useEffect(() => {
    (async () => {
      if (!user) return
      try {
        setNotifLoading(true)
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10)
        setNotifications(data || [])
      } finally {
        setNotifLoading(false)
      }
    })()
  }, [user])

  const markAllRead = async () => {
    try {
      await supabase.rpc('mark_all_notifications_read', { org_id: organization?.id || null })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (error) {
      console.debug('Failed to mark notifications read', error)
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <header className="sticky top-0 z-40 h-16 border-b bg-card/60 backdrop-blur-xl supports-[backdrop-filter]:bg-card/50">
      <div className="absolute inset-0 bg-gradient-to-r from-purple-50/60 to-violet-50/60 pointer-events-none" />
      <div className="flex h-full items-center justify-between px-2 sm:px-3 md:px-6">
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0">
          <SidebarTrigger className="md:hidden" />

          <Button size="sm" className="inline-flex bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700" onClick={() => navigate('/pos')}>
            POS
          </Button>

          {organizations.length > 1 && (
            <Select value={organization?.id || ""} onValueChange={switchOrganization}>
              <SelectTrigger className="w-44 md:w-56 bg-muted/50">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  <SelectValue placeholder="Select organization" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{org.name}</span>
                      {org.id === organization?.id && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

                     <div className="relative hidden sm:block w-[220px] md:w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input placeholder="Search clients, appointments..." className="pl-10 bg-muted/40" />
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {isTrialing && daysLeftInTrial !== null && daysLeftInTrial <= 3 && (
            <Button variant="outline" size="sm" className="hidden sm:inline-flex border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => navigate("/settings")}> 
              <CreditCard className="w-4 h-4 mr-2" />
              {daysLeftInTrial} days left
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 w-5 h-5 text-[10px] leading-none">{unreadCount}</Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="flex items-center justify-between px-2 py-1">
                <button className="text-xs text-muted-foreground hover:underline" onClick={(e) => { e.preventDefault(); markAllRead(); }}>
                  Mark all as read
                </button>
              </div>
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.map((n) => (
                <DropdownMenuItem key={n.id} className="flex flex-col items-start p-4">
                  <div className="font-medium">{n.title}</div>
                  {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
                  <div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
                </DropdownMenuItem>
              ))}
              {notifications.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">No notifications</div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {(user as any)?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium leading-tight">{(user as any)?.user_metadata?.full_name || user?.email}</div>
                  <RoleBadge role={organizationRole} />
                </div>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <div className="font-medium">{(user as any)?.user_metadata?.full_name || user?.email}</div>
                  {organization && (
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">{organization.name}</div>
                      {subscriptionPlan && (
                        <Badge variant="outline" className="text-xs">{subscriptionPlan.name}</Badge>
                      )}
                    </div>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              {isTrialing && (
                <DropdownMenuItem onClick={() => navigate("/upgrade-plan")}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Upgrade Plan
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export function SuperAdminTopbar() {
  const { user } = useSaas();
  const { handleSignOut, navigate } = useSignOut();

  const [notifications, setNotifications] = useState<any[]>([])
  const [notifLoading, setNotifLoading] = useState(false)

  useEffect(() => {
    (async () => {
      if (!user) return
      try {
        setNotifLoading(true)
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10)
        setNotifications(data || [])
      } finally {
        setNotifLoading(false)
      }
    })()
  }, [user])

  const markAllRead = async () => {
    try {
      await supabase.rpc('mark_all_notifications_read', { org_id: null })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (error) {
      console.debug('Failed to mark notifications read (super admin)', error)
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <header className="sticky top-0 z-40 h-16 border-b bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-sm">
      <div className="flex h-full items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3 md:gap-4">
          <SidebarTrigger className="md:hidden text-white" />
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6" />
            <h1 className="text-base md:text-lg font-semibold">Super Admin</h1>
            <Badge className="bg-white/20 text-white border-white/30">System</Badge>
          </div>
          <div className="relative hidden sm:block w-[220px] md:w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70 w-4 h-4" />
            <Input placeholder="Search organizations, users..." className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/70 focus:bg-white/20" />
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="border-white/30 text-white hover:bg-white/10">
            Back to App
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/10">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 w-5 h-5 text-[10px] leading-none">{unreadCount}</Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="flex items-center justify-between px-2 py-1">
                <button className="text-xs text-muted-foreground hover:underline" onClick={(e) => { e.preventDefault(); markAllRead(); }}>
                  Mark all as read
                </button>
              </div>
              <DropdownMenuLabel>System Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.map((n) => (
                <DropdownMenuItem key={n.id} className="flex flex-col items-start p-4">
                  <div className="font-medium">{n.title}</div>
                  {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
                  <div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
                </DropdownMenuItem>
              ))}
              {notifications.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">No notifications</div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-2 text-white hover:bg-white/10">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {(user as any)?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium leading-tight">{(user as any)?.user_metadata?.full_name || user?.email}</div>
                  <div className="text-xs text-white/80 flex items-center gap-1">
                    <Crown className="w-3 h-3" /> Super Admin
                  </div>
                </div>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <div className="font-medium">{(user as any)?.user_metadata?.full_name || user?.email}</div>
                  <div className="flex items-center gap-1 text-sm text-purple-600">
                    <Crown className="w-3 h-3" /> Super Administrator
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/super-admin/settings")}>
                <Settings className="w-4 h-4 mr-2" /> System Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                <User className="w-4 h-4 mr-2" /> Back to Dashboard
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                <LogOut className="w-4 h-4 mr-2" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
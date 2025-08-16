
import { Bell, Search, Settings, User, LogOut, Building2, ChevronDown, ArrowLeft, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSaas } from "@/lib/saas";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";
import { cleanupAuthState } from "@/utils/authUtils";
import { useMemo, useState } from "react";
import { useNotifications } from "@/hooks/useNotifications";

export function AppTopbar() {
  const navigate = useNavigate();
  const { 
    user, 
    organization, 
    organizations, 
    organizationRole,
    subscription,
    subscriptionPlan,
    isTrialing,
    daysLeftInTrial,
    switchOrganization 
  } = useSaas();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      navigate('/login');
    }
  };

  const { unreadNotifications, unreadCount, markAllAsRead } = useNotifications();

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'text-amber-600';
      case 'admin': return 'text-purple-600';
      case 'manager': return 'text-blue-600';
      default: return 'text-slate-600';
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 text-foreground backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-3 sm:px-4 lg:px-6 w-full">
        {/* Search - hidden on small screens to keep bar compact */}
        <div className="hidden md:flex items-center space-x-4 flex-1 max-w-xl">
          <div className="relative w-full">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-8"
              aria-label="Search"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Current user full name (desktop) */}
          {user?.user_metadata?.full_name && (
            <div className="hidden md:block text-sm text-muted-foreground mr-1">
              {user.user_metadata.full_name}
            </div>
          )}
          {/* POS Button */}
          <Button
            onClick={() => navigate('/pos')}
            aria-label="Open POS"
            className="bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 shadow-sm h-9 px-3 sm:px-4"
          >
            <CreditCard className="h-4 w-4 mr-0 sm:mr-2" />
            <span className="hidden sm:inline">POS</span>
          </Button>

          {/* Organization Selector (hide on small screens) */}
          {organizations && organizations.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="hidden md:inline-flex items-center space-x-2" aria-label="Select organization">
                  <Building2 className="h-4 w-4" />
                  <span className="max-w-32 truncate">
                    {organization?.name || 'Select Organization'}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Switch Organization</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {organizations.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => switchOrganization(org.id)}
                    className={organization?.id === org.id ? 'bg-accent' : ''}
                  >
                    <div className="flex flex-col">
                      <span>{org.organizations?.name || 'Unknown'}</span>
                      <span className={`text-xs ${getRoleColor(org.role)}`}>
                        {org.role}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Dark mode toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0" aria-label="Notifications">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full p-0 text-[10px] leading-5 text-center">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              <div className="p-3 border-b flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Notifications</div>
                  <div className="text-xs text-muted-foreground">{unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}</div>
                </div>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={markAllAsRead} aria-label="Mark all as read">
                    Mark all as read
                  </Button>
                )}
              </div>
              {unreadCount === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">No new notifications</div>
              ) : (
                <div className="max-h-80 overflow-auto py-1">
                  {unreadNotifications.map((n) => (
                    <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 py-2 px-3">
                      <div className="text-sm font-medium">{n.title}</div>
                      {n.description && (
                        <div className="text-xs text-muted-foreground">{n.description}</div>
                      )}
                    </DropdownMenuItem>
                  ))}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full" aria-label="User menu">
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.user_metadata?.full_name || user?.email}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                  {organization && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {organization.name}
                      </p>
                      <span className={`text-xs ${getRoleColor(organizationRole || '')}`}>
                        {organizationRole}
                      </span>
                    </div>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export function SuperAdminTopbar() {
  const navigate = useNavigate();
  const { user } = useSaas();

  const handleSignOut = async () => {
    try {
      cleanupAuthState();
      try {
        await supabase.auth.signOut({ scope: 'global' } as any);
      } catch (err) { /* ignore sign-out errors */ }
    } finally {
      const rawBase = (import.meta.env.BASE_URL as string) || '/';
      let basePath = rawBase;
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rawBase)) {
        try { basePath = new URL(rawBase).pathname || '/'; } catch { basePath = '/'; }
      }
      const prefix = basePath.replace(/\/+$/, '') || '/';
      window.location.href = `${prefix}/login`;
    }
  };

  const handleBackToApp = () => {
    navigate('/dashboard');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 text-foreground backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-3 sm:px-4 lg:px-6 w-full">
        {/* Left side - Back to App */}
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={handleBackToApp} className="flex items-center space-x-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to App</span>
          </Button>
          <div>
            <h2 className="text-lg font-semibold">Super Admin Panel</h2>
          </div>
        </div>

        {/* Right side - User menu */}
        <div className="flex items-center space-x-4">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.user_metadata?.full_name || user?.email}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                  <span className="text-xs text-red-600 font-medium">
                    Super Admin
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleBackToApp}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span>Back to App</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

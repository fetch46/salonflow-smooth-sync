
import { Bell, Search, Settings, User, LogOut, Building2, ChevronDown, ArrowLeft } from "lucide-react";
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

  const getSubscriptionBadge = () => {
    if (isTrialing && daysLeftInTrial !== null) {
      return (
        <Badge variant="outline" className="text-xs">
          Trial: {daysLeftInTrial} days left
        </Badge>
      );
    }
    
    if (subscriptionPlan) {
      return (
        <Badge variant="outline" className="text-xs">
          {subscriptionPlan.name}
        </Badge>
      );
    }
    
    return null;
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'text-amber-600';
      case 'admin': return 'text-purple-600';
      case 'manager': return 'text-blue-600';
      default: return 'text-slate-600';
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4">
        {/* Search */}
        <div className="flex items-center space-x-4 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-8"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* Organization Selector */}
          {organizations && organizations.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center space-x-2">
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

          {/* Subscription Status */}
          {getSubscriptionBadge()}

          {/* Notifications */}
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-4 w-4" />
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs">
              3
            </Badge>
          </Button>

          {/* User Menu */}
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
      const { cleanupAuthState } = await import('@/utils/authUtils');
      cleanupAuthState();
      try {
        await supabase.auth.signOut({ scope: 'global' } as any);
      } catch (err) { /* ignore sign-out errors */ }
    } finally {
      window.location.href = '/login';
    }
  };

  const handleBackToApp = () => {
    navigate('/dashboard');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4">
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

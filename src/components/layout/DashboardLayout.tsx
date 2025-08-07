import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Bell, Search, User, Building2, Crown, ChevronDown, Settings, LogOut, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSaas } from "@/contexts/SaasContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface DashboardLayoutProps {
  children?: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps = {}) {
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
    await supabase.auth.signOut();
    navigate('/login');
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

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="w-3 h-3" />;
      default: return null;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Top Header */}
          <header className="h-16 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
            <div className="flex items-center justify-between h-full px-6">
              <div className="flex items-center space-x-4">
                <SidebarTrigger className="lg:hidden" />
                
                {/* Organization Selector */}
                {organizations.length > 1 && (
                  <Select
                    value={organization?.id || ''}
                    onValueChange={switchOrganization}
                  >
                    <SelectTrigger className="w-48 bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        <SelectValue />
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

                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search clients, appointments..."
                    className="pl-10 bg-muted/50"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {/* Trial/Subscription Status */}
                {isTrialing && daysLeftInTrial !== null && daysLeftInTrial <= 3 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-200 text-amber-700 hover:bg-amber-50"
                    onClick={() => navigate('/settings')}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    {daysLeftInTrial} days left in trial
                  </Button>
                )}

                {/* Notifications */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="relative">
                      <Bell className="w-5 h-5" />
                      <Badge variant="destructive" className="absolute -top-1 -right-1 w-5 h-5 text-xs">
                        3
                      </Badge>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="flex flex-col items-start p-4">
                      <div className="font-medium">New appointment booked</div>
                      <div className="text-sm text-muted-foreground">Sarah Johnson booked a hair appointment for tomorrow</div>
                      <div className="text-xs text-muted-foreground mt-1">2 minutes ago</div>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="flex flex-col items-start p-4">
                      <div className="font-medium">Low inventory alert</div>
                      <div className="text-sm text-muted-foreground">Hair color kit is running low</div>
                      <div className="text-xs text-muted-foreground mt-1">1 hour ago</div>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="flex flex-col items-start p-4">
                      <div className="font-medium">Payment received</div>
                      <div className="text-sm text-muted-foreground">$150 payment from client #1234</div>
                      <div className="text-xs text-muted-foreground mt-1">3 hours ago</div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                {/* User Profile Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {user?.email?.[0].toUpperCase()}
                      </div>
                      <div className="hidden md:block text-left">
                        <div className="text-sm font-medium">{user?.email}</div>
                        {organization && (
                          <div className={`text-xs flex items-center gap-1 ${getRoleColor(organizationRole || '')}`}>
                            {getRoleIcon(organizationRole || '')}
                            {organizationRole}
                          </div>
                        )}
                      </div>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <div className="font-medium">{user?.email}</div>
                        {organization && (
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">{organization.name}</div>
                            {getSubscriptionBadge()}
                          </div>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem onClick={() => navigate('/settings')}>
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    
                    {isTrialing && (
                      <DropdownMenuItem onClick={() => navigate('/settings')}>
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

          {/* Main Content */}
          <main className="flex-1">
            {children || <Outlet />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
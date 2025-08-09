import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SuperAdminSidebar } from "./SuperAdminSidebar";
import { Bell, Search, User, Crown, ChevronDown, Settings, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSaas } from "@/lib/saas/context";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface SuperAdminLayoutProps {
  children?: React.ReactNode;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps = {}) {
  const navigate = useNavigate();
  const { user } = useSaas();

  const handleSignOut = async () => {
    try {
      const { cleanupAuthState } = await import('@/utils/authUtils');
      cleanupAuthState();
      try {
        await supabase.auth.signOut({ scope: 'global' } as any);
      } catch (err) {}
    } finally {
      window.location.href = '/login';
    }
  };

  const handleBackToApp = () => {
    navigate('/dashboard');
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <SuperAdminSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Top Header */}
          <header className="h-16 border-b bg-gradient-to-r from-purple-600 to-violet-600 sticky top-0 z-40">
            <div className="flex items-center justify-between h-full px-6">
              <div className="flex items-center space-x-4">
                <SidebarTrigger className="lg:hidden text-white" />
                
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-white" />
                  <h1 className="text-xl font-bold text-white">Super Admin Dashboard</h1>
                  <Badge className="bg-white/20 text-white border-white/30">
                    System Administration
                  </Badge>
                </div>

                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 w-4 h-4" />
                  <Input
                    placeholder="Search organizations, users..."
                    className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:bg-white/20"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {/* Back to App Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBackToApp}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  Back to App
                </Button>

                {/* Notifications */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="relative text-white hover:bg-white/10">
                      <Bell className="w-5 h-5" />
                      <Badge variant="destructive" className="absolute -top-1 -right-1 w-5 h-5 text-xs">
                        2
                      </Badge>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <DropdownMenuLabel>System Notifications</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="flex flex-col items-start p-4">
                      <div className="font-medium">New organization created</div>
                      <div className="text-sm text-muted-foreground">Acme Corp was created by user@example.com</div>
                      <div className="text-xs text-muted-foreground mt-1">5 minutes ago</div>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="flex flex-col items-start p-4">
                      <div className="font-medium">Subscription upgraded</div>
                      <div className="text-sm text-muted-foreground">TechStart Inc upgraded to Enterprise plan</div>
                      <div className="text-xs text-muted-foreground mt-1">1 hour ago</div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                {/* User Profile Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-2 text-white hover:bg-white/10">
                      <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {user?.email?.[0].toUpperCase()}
                      </div>
                      <div className="hidden md:block text-left">
                        <div className="text-sm font-medium">{user?.email}</div>
                        <div className="text-xs text-white/80 flex items-center gap-1">
                          <Crown className="w-3 h-3" />
                          Super Admin
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <div className="font-medium">{user?.email}</div>
                        <div className="flex items-center gap-1 text-sm text-purple-600">
                          <Crown className="w-3 h-3" />
                          Super Administrator
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem onClick={() => navigate('/super-admin/settings')}>
                      <Settings className="w-4 h-4 mr-2" />
                      System Settings
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem onClick={handleBackToApp}>
                      <User className="w-4 h-4 mr-2" />
                      Back to Dashboard
                    </DropdownMenuItem>
                    
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
          <main className="flex-1 bg-slate-50">
            {children || <Outlet />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
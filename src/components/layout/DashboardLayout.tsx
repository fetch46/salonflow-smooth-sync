import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./Topbar";
import { useSaas } from "@/lib/saas";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Crown } from "lucide-react";
import React from "react";

interface DashboardLayoutProps {
  children?: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps = {}) {
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
      // Clean up auth state to avoid limbo
      const { cleanupAuthState } = await import('@/utils/authUtils');
      cleanupAuthState();
      try {
        await supabase.auth.signOut({ scope: 'global' } as any);
      } catch (err) {
        // ignore
      }
    } finally {
      // Force full reload to ensure clean state
      window.location.href = '/login';
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

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="w-3 h-3" />;
      default: return null;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background overflow-x-hidden">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          <AppTopbar />

          {/* Main Content */}
          <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8 pb-footer">
            {children || <Outlet />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
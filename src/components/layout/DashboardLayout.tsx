import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./Topbar";
import { useSaas } from "@/lib/saas";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Crown } from "lucide-react";
import React from "react";
import { cleanupAuthState } from "@/utils/authUtils";

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
      cleanupAuthState();
      try {
        await supabase.auth.signOut({ scope: 'global' } as any);
      } catch (err) {
        // ignore
      }
    } finally {
      // Force full reload to ensure clean state
      const rawBase = (import.meta.env.BASE_URL as string) || '/';
      let basePath = rawBase;
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rawBase)) {
        try { basePath = new URL(rawBase).pathname || '/'; } catch { basePath = '/'; }
      }
      const prefix = basePath.replace(/\/+$/, '') || '/';
      window.location.href = `${prefix}/login`;
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
       <div className="min-h-screen flex w-full bg-background overflow-x-hidden text-foreground">
         <AppSidebar />
         
         <div className="flex-1 flex flex-col min-w-0">
           {/* Skip link for keyboard users */}
           <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute left-2 top-2 z-[60] rounded bg-primary text-primary-foreground px-3 py-2">
             Skip to content
           </a>
           <AppTopbar />
 
           {/* Main Content */}
           <main id="main-content" className="flex-1 min-w-0 p-4 md:p-6 lg:p-8">
             <React.Suspense fallback={
               <div className="flex items-center justify-center min-h-[400px]" role="status" aria-live="polite" aria-busy="true">
                 <div className="text-center space-y-4">
                   <div className="motion-safe:animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                   <p className="text-sm text-muted-foreground">Loading...</p>
                 </div>
               </div>
             }>
               {children || <Outlet />}
             </React.Suspense>
           </main>
         </div>
       </div>
     </SidebarProvider>
   );
}

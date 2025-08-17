import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SuperAdminSidebar } from "./SuperAdminSidebar";
import { SuperAdminTopbar } from "./Topbar";
import { useSaas } from "@/lib/saas";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cleanupAuthState } from "@/utils/authUtils";

interface SuperAdminLayoutProps {
  children?: React.ReactNode;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps = {}) {
  const navigate = useNavigate();
  const { user } = useSaas();

  const handleSignOut = async () => {
    try {
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
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background overflow-x-hidden">
        <SuperAdminSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* Skip link for keyboard users */}
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute left-2 top-2 z-[60] rounded bg-primary text-primary-foreground px-3 py-2">
            Skip to content
          </a>
          <SuperAdminTopbar />

          {/* Main Content */}
          <main id="main-content" className="flex-1 bg-slate-50 min-w-0 px-1 md:px-1.5 lg:px-2 pb-1 md:pb-1.5 lg:pb-2 pt-0.5 md:pt-[3px] lg:pt-1">
            {children || <Outlet />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
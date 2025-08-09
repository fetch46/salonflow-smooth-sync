import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SuperAdminSidebar } from "./SuperAdminSidebar";
import { SuperAdminTopbar } from "./Topbar";
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
          <SuperAdminTopbar />

          {/* Main Content */}
          <main className="flex-1 bg-slate-50">
            {children || <Outlet />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
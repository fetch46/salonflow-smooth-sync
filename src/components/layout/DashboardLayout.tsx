
import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { Topbar } from './Topbar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useSaas } from '@/lib/saas';
import { Toaster } from '@/components/ui/sonner';

export function DashboardLayout() {
  const { loading, systemSettings, refreshSystemSettings } = useSaas();

  useEffect(() => {
    // Only refresh system settings if we're not already loading
    if (!loading) {
      refreshSystemSettings().catch(error => {
        console.warn('Failed to refresh system settings in dashboard:', error);
        // Don't show error to user, just log it
      });
    }
  }, [loading, refreshSystemSettings]);

  // Show loading state while initial data is being fetched
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Check for maintenance mode
  if (systemSettings?.maintenance_mode) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Maintenance Mode</h1>
          <p className="text-muted-foreground">
            The application is currently under maintenance. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
      <Toaster />
    </SidebarProvider>
  );
}

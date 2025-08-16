
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useSaas } from "@/lib/saas";
import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import AppFooter from "@/components/layout/AppFooter";

// Layouts
import DashboardLayout from "@/components/layout/DashboardLayout";

// Auth Pages
import Login from "@/pages/Login";
import Register from "@/pages/Register";

// Use the simple dashboard component directly
import SimpleDashboard from "@/components/dashboard/SimpleDashboard";

// Main Pages - only load essential ones for now
const Appointments = lazy(() => import("@/pages/Appointments"));
const AppointmentForm = lazy(() => import("@/pages/AppointmentForm"));
const Clients = lazy(() => import("@/pages/Clients"));
const ClientProfile = lazy(() => import("@/pages/ClientProfile"));
const Staff = lazy(() => import("@/pages/Staff"));
const Services = lazy(() => import("@/pages/Services"));
const Inventory = lazy(() => import("@/pages/Inventory"));
const StaffProfile = lazy(() => import("@/pages/StaffProfile"));
const Settings = lazy(() => import("@/pages/Settings"));
const Profile = lazy(() => import("@/pages/Profile"));
const Help = lazy(() => import("@/pages/Help"));

const NotFound = lazy(() => import("@/pages/NotFound"));
const Landing = lazy(() => import("@/pages/Landing"));
import { ErrorBoundary } from "@/components/ErrorBoundary";
import BusinessDirectory from "@/pages/BusinessDirectory";

// SAAS-specific wrapper component to handle routing logic
const AppRoutes = () => {
  const { user, loading, organization, organizations } = useSaas();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto"></div>
          <p className="text-slate-600 font-medium">Loading your workspace...</p>
          <div className="text-sm text-slate-500">
            <p>If this takes too long, try:</p>
            <div className="mt-2 space-y-1">
              <button 
                onClick={() => window.location.reload()} 
                className="text-violet-600 hover:underline block"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated - show auth pages
  if (!user) {
    return (
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/businesses" element={<BusinessDirectory />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/setup" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  // Authenticated with organization - show main app
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <Routes>
        {/* Redirect auth pages if already logged in */}
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/register" element={<Navigate to="/dashboard" replace />} />
        <Route path="/setup" element={<Navigate to="/dashboard" replace />} />

        {/* Main application routes */}
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<SimpleDashboard />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="appointments/new" element={<AppointmentForm />} />
          <Route path="appointments/:id/edit" element={<AppointmentForm />} />
          
          {/* Client Management */}
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientProfile />} />
          
          {/* Staff & Services */}
          <Route path="staff" element={<Staff />} />
          <Route path="staff/:id" element={<StaffProfile />} />
          <Route path="services" element={<Services />} />
          
          {/* Inventory Management */}
          <Route path="inventory" element={<Inventory />} />
          
          {/* Settings & Support */}
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<Profile />} />
          <Route path="help" element={<Help />} />
        </Route>

        {/* 404 Not Found */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <Router basename={import.meta.env.BASE_URL}>
        <AppRoutes />
        <Toaster />
        <AppFooter />
      </Router>
    </ErrorBoundary>
  );
}

export default App;

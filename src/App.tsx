
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

// Load essential pages
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const SimpleDashboard = lazy(() => import("@/components/dashboard/SimpleDashboard"));
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
const Reports = lazy(() => import("@/pages/Reports"));
const POS = lazy(() => import("@/pages/POS"));
const Invoices = lazy(() => import("@/pages/Invoices"));
const Expenses = lazy(() => import("@/pages/Expenses"));
const Payments = lazy(() => import("@/pages/Payments"));
const JobCards = lazy(() => import("@/pages/JobCards"));
const Suppliers = lazy(() => import("@/pages/Suppliers"));
const Banking = lazy(() => import("@/pages/Banking"));
const Accounts = lazy(() => import("@/pages/Accounts"));
const Journal = lazy(() => import("@/pages/Journal"));
const Purchases = lazy(() => import("@/pages/Purchases"));

const NotFound = lazy(() => import("@/pages/NotFound"));
const Landing = lazy(() => import("@/pages/Landing"));
import { ErrorBoundary } from "@/components/ErrorBoundary";
import BusinessDirectory from "@/pages/BusinessDirectory";

// Admin pages
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));

// Loading component
const LoadingFallback = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto"></div>
      <p className="text-slate-600 font-medium">Loading...</p>
    </div>
  </div>
);

// SAAS-specific wrapper component to handle routing logic
const AppRoutes = () => {
  const { user, loading, organization, organizations, isSuperAdmin } = useSaas();

  if (loading) {
    return <LoadingFallback />;
  }

  // Not authenticated - show auth pages
  if (!user) {
    return (
      <Suspense fallback={<LoadingFallback />}>
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

  // Super admin routes
  if (isSuperAdmin && window.location.pathname.startsWith('/admin')) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Suspense>
    );
  }

  // Authenticated with organization - show main app
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Redirect auth pages if already logged in */}
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/register" element={<Navigate to="/dashboard" replace />} />
        <Route path="/setup" element={<Navigate to="/dashboard" replace />} />

        {/* Main application routes */}
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="simple-dashboard" element={<SimpleDashboard />} />
          
          {/* Appointments */}
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
          
          {/* Business Operations */}
          <Route path="pos" element={<POS />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="payments" element={<Payments />} />
          <Route path="job-cards" element={<JobCards />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="purchases" element={<Purchases />} />
          
          {/* Financial */}
          <Route path="banking" element={<Banking />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="journal" element={<Journal />} />
          <Route path="reports" element={<Reports />} />
          
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

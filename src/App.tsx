import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { SaasProvider, useSaas } from "@/contexts/SaasContext";
import { Toaster } from "@/components/ui/sonner";

// Layouts
import DashboardLayout from "@/components/layout/DashboardLayout";

// Auth Pages
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import OrganizationSetup from "@/pages/OrganizationSetup";

// Main Pages
import Dashboard from "@/pages/Dashboard";
import Appointments from "@/pages/Appointments";
import Clients from "@/pages/Clients";
import ClientProfile from "@/pages/ClientProfile";
import Staff from "@/pages/Staff";
import Services from "@/pages/Services";
import Inventory from "@/pages/Inventory";
import Expenses from "@/pages/Expenses";
import Purchases from "@/pages/Purchases";
import Suppliers from "@/pages/Suppliers";
import Accounts from "@/pages/Accounts";
import POS from "@/pages/POS";
import InventoryAdjustments from "@/pages/InventoryAdjustments";
import Settings from "@/pages/Settings";
import JobCards from "@/pages/JobCards";
import CreateJobCard from "@/pages/CreateJobCard";
import SuperAdmin from "@/pages/SuperAdmin";
import TestPlans from "@/pages/TestPlans";
import TestDashboard from "@/pages/TestDashboard";
import ServiceView from "@/pages/ServiceView";
import Booking from "@/pages/Booking";
import Invoices from "@/pages/Invoices";
import NotFound from "@/pages/NotFound";
import Landing from "@/pages/Landing";
import Reports from "@/pages/Reports";
import Profile from "@/pages/Profile";
import Help from "@/pages/Help";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Authenticated but no organization - show setup
  if (!organization && organizations.length === 0) {
    return (
      <Routes>
        <Route path="/super-admin" element={<SuperAdmin />} />
        <Route path="/test/plans" element={<TestPlans />} />
        <Route path="/test/dashboard" element={<TestDashboard />} />
        <Route path="/setup" element={<OrganizationSetup />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  // Authenticated with organization - show main app
  return (
    <Routes>
      {/* System-wide routes available to authenticated users */}
      <Route path="/super-admin" element={<SuperAdmin />} />
      <Route path="/test/plans" element={<TestPlans />} />
      <Route path="/test/dashboard" element={<TestDashboard />} />
      
      {/* Redirect auth pages if already logged in */}
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route path="/register" element={<Navigate to="/dashboard" replace />} />
      <Route path="/setup" element={<Navigate to="/dashboard" replace />} />

      {/* Main application routes */}
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="appointments" element={<Appointments />} />
        
        {/* Client Management */}
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:id" element={<ClientProfile />} />
        
        {/* Staff & Services */}
        <Route path="staff" element={<Staff />} />
        <Route path="services" element={<Services />} />
        <Route path="services/:id" element={<ServiceView />} />
        
        {/* Inventory Management */}
        <Route path="inventory" element={<Inventory />} />
        <Route path="inventory-adjustments" element={<InventoryAdjustments />} />
        
        {/* Financial Management */}
        <Route path="expenses" element={<Expenses />} />
        <Route path="purchases" element={<Purchases />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="accounts" element={<Accounts />} />
        
        {/* Operations */}
        <Route path="job-cards" element={<JobCards />} />
        <Route path="job-cards/new" element={<CreateJobCard />} />
        <Route path="pos" element={<POS />} />
        <Route path="booking" element={<Booking />} />
        <Route path="invoices" element={<Invoices />} />
        
        {/* Settings & Support */}
        <Route path="settings" element={<Settings />} />
        <Route path="profile" element={<Profile />} />
        <Route path="reports" element={<Reports />} />
        <Route path="help" element={<Help />} />
      </Route>

      {/* 404 Not Found */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <SaasProvider>
        <Router>
          <AppRoutes />
          <Toaster />
        </Router>
      </SaasProvider>
    </ErrorBoundary>
  );
}

export default App;

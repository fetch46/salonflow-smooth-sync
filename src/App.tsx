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
import PlansDebug from "@/components/debug/PlansDebug";

// SAAS-specific wrapper component to handle routing logic
const AppRoutes = () => {
  const { user, loading, organization, organizations } = useSaas();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto"></div>
          <p className="text-slate-600 font-medium">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show auth pages
  if (!user) {
    return (
      <Routes>
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
        <Route path="/debug/plans" element={<PlansDebug />} />
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
      <Route path="/debug/plans" element={<PlansDebug />} />
      
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
        
        {/* Settings */}
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Catch all - redirect to dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <SaasProvider>
      <Router>
        <AppRoutes />
        <Toaster />
      </Router>
    </SaasProvider>
  );
}

export default App;

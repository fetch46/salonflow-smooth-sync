
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useSaas } from "@/lib/saas";
import React, { Suspense, lazy, useEffect } from "react";
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
const ServiceForm = lazy(() => import("@/pages/ServiceForm"));
const ServiceView = lazy(() => import("@/pages/ServiceView"));
const Inventory = lazy(() => import("@/pages/Inventory"));
const ProductView = lazy(() => import("@/pages/ProductView"));
const ProductForm = lazy(() => import("@/pages/ProductForm"));
const GoodsReceived = lazy(() => import("@/pages/GoodsReceived"));
const GoodsReceivedForm = lazy(() => import("@/pages/GoodsReceivedForm"));
const InventoryAdjustments = lazy(() => import("@/pages/InventoryAdjustments"));
const InventoryAdjustmentForm = lazy(() => import("@/pages/InventoryAdjustmentForm"));
const PurchaseForm = lazy(() => import("@/pages/PurchaseForm"));
const PurchaseView = lazy(() => import("@/pages/PurchaseView"));
const ExpenseForm = lazy(() => import("@/pages/ExpenseForm"));
const StaffProfile = lazy(() => import("@/pages/StaffProfile"));
const Settings = lazy(() => import("@/pages/Settings"));
const Profile = lazy(() => import("@/pages/Profile"));
const Help = lazy(() => import("@/pages/Help"));
const Reports = lazy(() => import("@/pages/Reports"));
const POS = lazy(() => import("@/pages/POS"));
const Invoices = lazy(() => import("@/pages/Invoices"));
const InvoiceCreate = lazy(() => import("@/pages/InvoiceCreate"));
const InvoiceEdit = lazy(() => import("@/pages/InvoiceEdit"));
const Expenses = lazy(() => import("@/pages/Expenses"));
const Payments = lazy(() => import("@/pages/Payments"));
const PaymentReceivedNew = lazy(() => import("@/pages/PaymentReceivedNew"));
const JobCards = lazy(() => import("@/pages/JobCards"));
const CreateJobCard = lazy(() => import("@/pages/CreateJobCard"));
const EditJobCard = lazy(() => import("@/pages/EditJobCard"));
const JobCardView = lazy(() => import("@/pages/JobCardView"));
const Suppliers = lazy(() => import("@/pages/Suppliers"));
const SupplierProfile = lazy(() => import("@/pages/SupplierProfile"));
const Banking = lazy(() => import("@/pages/Banking"));
const Accounts = lazy(() => import("@/pages/Accounts"));
const AccountCreate = lazy(() => import("@/pages/AccountCreate"));
const AccountEdit = lazy(() => import("@/pages/AccountEdit"));
const AccountView = lazy(() => import("@/pages/AccountView"));
const Journal = lazy(() => import("@/pages/Journal"));
const Purchases = lazy(() => import("@/pages/Purchases"));
const StockTransfers = lazy(() => import("@/pages/StockTransfers"));
const Warehouses = lazy(() => import("@/pages/Warehouses"));

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

  // Prefetch some commonly used lazy routes soon after auth/org is ready
  useEffect(() => {
    if (user && organization?.id) {
      setTimeout(() => {
        void Promise.all([
          import('@/pages/Accounts').catch(() => {}),
          import('@/pages/Invoices').catch(() => {}),
          import('@/pages/Payments').catch(() => {}),
        ]);
      }, 0);
    }
  }, [user, organization?.id]);

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
          <Route path="services/new" element={<ServiceForm />} />
          <Route path="services/:id" element={<ServiceView />} />
          <Route path="services/:id/edit" element={<ServiceForm />} />
          
          {/* Inventory Management */}
          <Route path="inventory" element={<Inventory />} />
          <Route path="inventory/new" element={<ProductForm />} />
          <Route path="inventory/:id" element={<ProductView />} />
          <Route path="inventory-adjustments" element={<InventoryAdjustments />} />
          <Route path="inventory-adjustments/:id/edit" element={<InventoryAdjustmentForm />} />
          <Route path="inventory-transfers" element={<StockTransfers />} />
          <Route path="warehouses" element={<Warehouses />} />
          
          {/* Business Operations */}
          <Route path="pos" element={<POS />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="invoices/new" element={<InvoiceCreate />} />
          <Route path="invoices/:id/edit" element={<InvoiceEdit />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="expenses/new" element={<ExpenseForm />} />
          <Route path="expenses/:id/edit" element={<ExpenseForm />} />
          <Route path="payments" element={<Payments />} />
          <Route path="payments/received/new" element={<PaymentReceivedNew />} />
          <Route path="job-cards" element={<JobCards />} />
          <Route path="job-cards/new" element={<CreateJobCard />} />
          <Route path="job-cards/:id" element={<JobCardView />} />
          <Route path="job-cards/:id/edit" element={<EditJobCard />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="suppliers/:id" element={<SupplierProfile />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="purchases/new" element={<PurchaseForm />} />
          <Route path="purchases/:id" element={<PurchaseView />} />
          <Route path="purchases/:id/edit" element={<PurchaseForm />} />
          <Route path="goods-received" element={<GoodsReceived />} />
          <Route path="goods-received/new" element={<GoodsReceivedForm />} />
          <Route path="goods-received/:id/edit" element={<GoodsReceivedForm />} />
          
          {/* Financial */}
          <Route path="banking" element={<Banking />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="accounts/new" element={<AccountCreate />} />
          <Route path="accounts/:id" element={<AccountView />} />
          <Route path="accounts/:id/edit" element={<AccountEdit />} />
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
  // Derive Router basename from Vite's BASE_URL; if it's a full URL, use only the pathname.
  const rawBase = (import.meta.env.BASE_URL as string) || '/';
  let basePath = rawBase;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rawBase)) {
    try { basePath = new URL(rawBase).pathname || '/'; } catch { basePath = '/'; }
  }
  const basename = basePath.replace(/\/+$/, '') || '/';

  return (
    <ErrorBoundary>
      <Router basename={basename}>
        <AppRoutes />
        <Toaster />
        <AppFooter />
      </Router>
    </ErrorBoundary>
  );
}

export default App;

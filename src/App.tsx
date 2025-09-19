
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { SaasProvider, useSaas } from "./lib/saas";
import React, { Suspense, lazy, useEffect } from "react";
import { Toaster } from "./components/ui/sonner";
import AppFooter from "./components/layout/AppFooter";

// Layouts
import DashboardLayout from "./components/layout/DashboardLayout";

// Auth Pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { isChunkError, recoverFromChunkErrorOnce } from "./utils/chunkRecovery";

// Helper: lazy loader that retries by triggering cache bust/reload on chunk failures
const lazyWithRetry = <T extends {}>(loader: () => Promise<{ default: React.ComponentType<T> }>) =>
  lazy(async () => {
    try {
      return await loader();
    } catch (error) {
      if (isChunkError(error)) {
        await recoverFromChunkErrorOnce();
      }
      throw error as any;
    }
  });

// Load essential pages
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const SimpleDashboard = lazyWithRetry(() => import("./components/dashboard/SimpleDashboard"));
const Appointments = lazyWithRetry(() => import("./pages/Appointments"));
const AppointmentForm = lazyWithRetry(() => import("./pages/AppointmentForm"));
const Clients = lazyWithRetry(() => import("./pages/Clients"));
const ClientProfile = lazyWithRetry(() => import("./pages/ClientProfile"));
const Staff = lazyWithRetry(() => import("./pages/Staff"));
const Services = lazyWithRetry(() => import("./pages/Services"));
const ServiceForm = lazyWithRetry(() => import("./pages/ServiceForm"));
const ServiceView = lazyWithRetry(() => import("./pages/ServiceView"));
const Inventory = lazyWithRetry(() => import("./pages/Inventory"));
const ProductView = lazyWithRetry(() => import("./pages/ProductView"));
const ProductForm = lazyWithRetry(() => import("./pages/ProductForm"));
const GoodsReceived = lazyWithRetry(() => import("./pages/GoodsReceived"));
const GoodsReceivedForm = lazyWithRetry(() => import("./pages/GoodsReceivedForm"));
const InventoryAdjustments = lazyWithRetry(() => import("./pages/InventoryAdjustments"));
const InventoryAdjustmentForm = lazyWithRetry(() => import("./pages/InventoryAdjustmentForm"));
const PurchaseForm = lazyWithRetry(() => import("./pages/PurchaseForm"));
const PurchaseView = lazyWithRetry(() => import("./pages/PurchaseView"));
const ExpenseForm = lazyWithRetry(() => import("./pages/ExpenseForm"));
const StaffProfile = lazyWithRetry(() => import("./pages/StaffProfile"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const SettingsSubscription = lazyWithRetry(() => import("./pages/SettingsSubscription"));
const ModulesSettings = lazyWithRetry(() => import("./pages/ModulesSettings"));
const BrandingSettings = lazyWithRetry(() => import("./pages/BrandingSettings"));
const WhatsAppSettings = lazyWithRetry(() => import("./pages/WhatsAppSettings"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const Help = lazyWithRetry(() => import("./pages/Help"));
const Reports = lazyWithRetry(() => import("./pages/Reports"));
const SpecificReports = lazyWithRetry(() => import("./pages/SpecificReports"));
const POS = lazyWithRetry(() => import("./pages/POS"));
const Invoices = lazyWithRetry(() => import("./pages/Invoices"));
const InvoiceCreate = lazyWithRetry(() => import("./pages/InvoiceCreate"));
const InvoiceEdit = lazyWithRetry(() => import("./pages/InvoiceEdit"));
const Expenses = lazyWithRetry(() => import("./pages/Expenses"));
const Payments = lazyWithRetry(() => import("./pages/Payments"));
const PaymentsReceived = lazyWithRetry(() => import("./pages/PaymentsReceived"));
const PaymentsMade = lazyWithRetry(() => import("./pages/PaymentsMade"));
const PaymentReceivedNew = lazyWithRetry(() => import("./pages/PaymentReceivedNew"));
const JobCards = lazyWithRetry(() => import("./pages/JobCards"));
const CreateJobCard = lazyWithRetry(() => import("./pages/CreateJobCard"));
const EditJobCard = lazyWithRetry(() => import("./pages/EditJobCard"));
const JobCardView = lazyWithRetry(() => import("./pages/JobCardView"));
const Suppliers = lazyWithRetry(() => import("./pages/Suppliers"));
const SupplierProfile = lazyWithRetry(() => import("./pages/SupplierProfile"));
const Banking = lazyWithRetry(() => import("./pages/Banking"));
const Accounts = lazyWithRetry(() => import("./pages/Accounts"));
const AccountCreate = lazyWithRetry(() => import("./pages/AccountCreate"));
const AccountEdit = lazyWithRetry(() => import("./pages/AccountEdit"));
const AccountView = lazyWithRetry(() => import("./pages/AccountView"));
const Journal = lazyWithRetry(() => import("./pages/Journal"));
const Purchases = lazyWithRetry(() => import("./pages/Purchases"));
const StockTransfers = lazyWithRetry(() => import("./pages/StockTransfers"));

const ProductEdit = lazyWithRetry(() => import("./pages/ProductEdit"));

const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const Landing = lazyWithRetry(() => import("./pages/Landing"));
import { ErrorBoundary } from "./components/ErrorBoundary";
import BusinessDirectory from "./pages/BusinessDirectory";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RequirePermission from "./components/auth/RequirePermission";
import { ModuleGate } from "./components/modules/ModuleGate";

// Admin pages
const AdminDashboardPage = lazyWithRetry(() => import("./pages/admin/AdminDashboard"));
const AdminOrganizations = lazyWithRetry(() => import("./pages/admin/AdminOrganizations"));
const AdminSubscriptionPlans = lazyWithRetry(() => import("./pages/admin/AdminSubscriptionPlans"));
const AdminUsers = lazyWithRetry(() => import("./pages/admin/AdminUsers"));
const AdminInvitations = lazyWithRetry(() => import("./pages/admin/AdminInvitations"));
const AdminSuperAdmins = lazyWithRetry(() => import("./pages/admin/AdminSuperAdmins"));
const AdminActivity = lazyWithRetry(() => import("./pages/admin/AdminActivity"));
const AdminSystemSettings = lazyWithRetry(() => import("./pages/admin/AdminSystemSettings"));
const AdminBusinessData = lazyWithRetry(() => import("./pages/admin/AdminBusinessData"));
const AdminLandingCMS = lazyWithRetry(() => import("./pages/admin/AdminLandingCMS"));

// Loading component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.08),hsl(var(--background)))]">
    <div className="text-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      <p className="text-muted-foreground font-medium">Loading...</p>
    </div>
  </div>
);

// SAAS-specific wrapper component to handle routing logic
const AppRoutes = () => {
  const { user, loading, organization, organizations, isSuperAdmin } = useSaas();
  const location = useLocation();

  // Prefetch some commonly used lazy routes soon after auth/org is ready
  // This useEffect must be called before any conditional returns to follow Rules of Hooks
  useEffect(() => {
    if (user && organization?.id) {
      // Dynamic prefetch removed to avoid chunk fetch failures; rely on on-demand loading
    }
  }, [user, organization?.id]);

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

  // Redirect super admins to Admin dashboard on initial landings
  if (isSuperAdmin && (location.pathname === '/' || location.pathname === '/dashboard')) {
    return <Navigate to="/admin" replace />;
  }

  // Super admin routes - now with protected routes
  if (isSuperAdmin && (location.pathname.startsWith('/admin') || location.pathname.startsWith('/super-admin'))) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* canonical admin dashboard */}
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminDashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/dashboard" element={
            <ProtectedRoute>
              <AdminDashboardPage />
            </ProtectedRoute>
          } />
          {/* admin pages - now protected */}
          <Route path="/admin/organizations" element={
            <ProtectedRoute>
              <AdminOrganizations />
            </ProtectedRoute>
          } />
          <Route path="/admin/subscription-plans" element={
            <ProtectedRoute>
              <AdminSubscriptionPlans />
            </ProtectedRoute>
          } />
          <Route path="/admin/users" element={
            <ProtectedRoute>
              <AdminUsers />
            </ProtectedRoute>
          } />
          <Route path="/admin/invitations" element={
            <ProtectedRoute>
              <AdminInvitations />
            </ProtectedRoute>
          } />
          <Route path="/admin/super-admins" element={
            <ProtectedRoute>
              <AdminSuperAdmins />
            </ProtectedRoute>
          } />
          <Route path="/admin/activity" element={
            <ProtectedRoute>
              <AdminActivity />
            </ProtectedRoute>
          } />
          <Route path="/admin/system-settings" element={
            <ProtectedRoute>
              <AdminSystemSettings />
            </ProtectedRoute>
          } />
          <Route path="/admin/business-data" element={
            <ProtectedRoute>
              <AdminBusinessData />
            </ProtectedRoute>
          } />
          <Route path="/admin/cms" element={
            <ProtectedRoute>
              <AdminLandingCMS />
            </ProtectedRoute>
          } />
          {/* legacy path redirects */}
          <Route path="/super-admin" element={<Navigate to="/admin" replace />} />
          <Route path="/super-admin/*" element={<Navigate to="/admin" replace />} />
          {/* fallback */}
          <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
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
          
          {/* Appointments Module */}
          <Route path="appointments" element={<ModuleGate moduleId="appointments"><Appointments /></ModuleGate>} />
          <Route path="appointments/new" element={<ModuleGate moduleId="appointments"><AppointmentForm /></ModuleGate>} />
          <Route path="appointments/:id/edit" element={<ModuleGate moduleId="appointments"><AppointmentForm /></ModuleGate>} />
          
          {/* Sales Module */}
          <Route path="clients" element={<ModuleGate moduleId="sales"><Clients /></ModuleGate>} />
          <Route path="clients/:id" element={<ModuleGate moduleId="sales"><ClientProfile /></ModuleGate>} />
          <Route path="invoices" element={<ModuleGate moduleId="sales"><Invoices /></ModuleGate>} />
          <Route path="invoices/new" element={<ModuleGate moduleId="sales"><InvoiceCreate /></ModuleGate>} />
          <Route path="invoices/:id/edit" element={<ModuleGate moduleId="sales"><InvoiceEdit /></ModuleGate>} />
          <Route path="payments" element={<ModuleGate moduleId="sales"><Payments /></ModuleGate>} />
          <Route path="payments-received" element={<ModuleGate moduleId="sales"><PaymentsReceived /></ModuleGate>} />
          <Route path="payments/received/new" element={<ModuleGate moduleId="sales"><PaymentReceivedNew /></ModuleGate>} />
          
          {/* POS Module */}
          <Route path="pos" element={<ModuleGate moduleId="pos"><POS /></ModuleGate>} />
          
          {/* Job Cards Module */}
          <Route path="job-cards" element={<ModuleGate moduleId="job_cards"><JobCards /></ModuleGate>} />
          <Route path="job-cards/new" element={<ModuleGate moduleId="job_cards"><CreateJobCard /></ModuleGate>} />
          <Route path="job-cards/:id" element={<ModuleGate moduleId="job_cards"><JobCardView /></ModuleGate>} />
          <Route path="job-cards/:id/edit" element={<ModuleGate moduleId="job_cards"><EditJobCard /></ModuleGate>} />
          
          {/* Purchases Module */}
          <Route path="suppliers" element={<ModuleGate moduleId="purchases"><Suppliers /></ModuleGate>} />
          <Route path="suppliers/:id" element={<ModuleGate moduleId="purchases"><SupplierProfile /></ModuleGate>} />
          <Route path="purchases" element={<ModuleGate moduleId="purchases"><Purchases /></ModuleGate>} />
          <Route path="purchases/new" element={<ModuleGate moduleId="purchases"><PurchaseForm /></ModuleGate>} />
          <Route path="purchases/:id" element={<ModuleGate moduleId="purchases"><PurchaseView /></ModuleGate>} />
          <Route path="purchases/:id/edit" element={<ModuleGate moduleId="purchases"><PurchaseForm /></ModuleGate>} />
          <Route path="goods-received" element={<ModuleGate moduleId="purchases"><GoodsReceived /></ModuleGate>} />
          <Route path="goods-received/new" element={<ModuleGate moduleId="purchases"><GoodsReceivedForm /></ModuleGate>} />
          <Route path="goods-received/:id/edit" element={<ModuleGate moduleId="purchases"><GoodsReceivedForm /></ModuleGate>} />
          <Route path="expenses" element={<ModuleGate moduleId="purchases"><Expenses /></ModuleGate>} />
          <Route path="expenses/new" element={<ModuleGate moduleId="purchases"><ExpenseForm /></ModuleGate>} />
          <Route path="expenses/:id/edit" element={<ModuleGate moduleId="purchases"><ExpenseForm /></ModuleGate>} />
          <Route path="payments-made" element={<ModuleGate moduleId="purchases"><PaymentsMade /></ModuleGate>} />
          
          {/* Services Module */}
          <Route path="services" element={<ModuleGate moduleId="services"><Services /></ModuleGate>} />
          <Route path="services/new" element={<ModuleGate moduleId="services"><ServiceForm /></ModuleGate>} />
          <Route path="services/:id" element={<ModuleGate moduleId="services"><ServiceView /></ModuleGate>} />
          <Route path="services/:id/edit" element={<ModuleGate moduleId="services"><ServiceForm /></ModuleGate>} />
          
          {/* Inventory Module */}
          <Route path="inventory" element={<ModuleGate moduleId="inventory"><Inventory /></ModuleGate>} />
          <Route path="inventory/new" element={<ModuleGate moduleId="inventory"><ProductForm /></ModuleGate>} />
          <Route path="inventory/:id" element={<ModuleGate moduleId="inventory"><ProductView /></ModuleGate>} />
          <Route path="inventory/:id/edit" element={<ModuleGate moduleId="inventory"><ProductEdit /></ModuleGate>} />
          <Route path="inventory-adjustments" element={<ModuleGate moduleId="inventory"><InventoryAdjustments /></ModuleGate>} />
          <Route path="inventory-adjustments/:id/edit" element={<ModuleGate moduleId="inventory"><InventoryAdjustmentForm /></ModuleGate>} />
          <Route path="inventory-transfers" element={<ModuleGate moduleId="inventory"><StockTransfers /></ModuleGate>} />
          
          {/* Accountant Module */}
          <Route path="banking" element={<ModuleGate moduleId="accountant"><Banking /></ModuleGate>} />
          <Route path="accounts" element={<ModuleGate moduleId="accountant"><Accounts /></ModuleGate>} />
          <Route path="accounts/new" element={<ModuleGate moduleId="accountant"><AccountCreate /></ModuleGate>} />
          <Route path="accounts/:id" element={<ModuleGate moduleId="accountant"><AccountView /></ModuleGate>} />
          <Route path="accounts/:id/edit" element={<ModuleGate moduleId="accountant"><AccountEdit /></ModuleGate>} />
          <Route path="journal" element={<ModuleGate moduleId="accountant"><Journal /></ModuleGate>} />
          <Route path="reports" element={<ModuleGate moduleId="accountant"><Reports /></ModuleGate>} />
          <Route path="specific-reports" element={<ModuleGate moduleId="accountant"><SpecificReports /></ModuleGate>} />
          
          {/* Staff & General Settings (Always available) */}
          <Route path="staff" element={<Staff />} />
          <Route path="staff/:id" element={<StaffProfile />} />
          
          {/* Settings & Support */}
          <Route path="settings" element={<Settings />} />
          <Route path="settings/subscription" element={<SettingsSubscription />} />
          <Route path="settings/modules" element={<ModulesSettings />} />
          <Route path="settings/branding" element={<BrandingSettings />} />
          <Route path="settings/whatsapp" element={<WhatsAppSettings />} />
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
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error: any) => {
          // Retry small number of times for network hiccups only
          const msg = String(error?.message || '')
          if (/network|fetch|timeout|ECONNRESET|ETIMEDOUT/i.test(msg)) {
            return failureCount < 2
          }
          return false
        },
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  })

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SaasProvider>
          {(() => {
            const base = import.meta.env.BASE_URL;
            const basename = typeof base === 'string' && base.startsWith('/') ? base : undefined;
            return (
              <Router basename={basename}>
                <AppRoutes />
                <Toaster />
                <AppFooter />
              </Router>
            );
          })()}
        </SaasProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

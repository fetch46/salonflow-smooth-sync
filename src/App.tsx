
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
import { isChunkError, recoverFromChunkErrorOnce } from "@/utils/chunkRecovery";

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
const Dashboard = lazyWithRetry(() => import("@/pages/Dashboard"));
const SimpleDashboard = lazyWithRetry(() => import("@/components/dashboard/SimpleDashboard"));
const Appointments = lazyWithRetry(() => import("@/pages/Appointments"));
const AppointmentForm = lazyWithRetry(() => import("@/pages/AppointmentForm"));
const Clients = lazyWithRetry(() => import("@/pages/Clients"));
const ClientProfile = lazyWithRetry(() => import("@/pages/ClientProfile"));
const Staff = lazyWithRetry(() => import("@/pages/Staff"));
const Services = lazyWithRetry(() => import("@/pages/Services"));
const ServiceForm = lazyWithRetry(() => import("@/pages/ServiceForm"));
const ServiceView = lazyWithRetry(() => import("@/pages/ServiceView"));
const Inventory = lazyWithRetry(() => import("@/pages/Inventory"));
const ProductView = lazyWithRetry(() => import("@/pages/ProductView"));
const ProductForm = lazyWithRetry(() => import("@/pages/ProductForm"));
const GoodsReceived = lazyWithRetry(() => import("@/pages/GoodsReceived"));
const GoodsReceivedForm = lazyWithRetry(() => import("@/pages/GoodsReceivedForm"));
const InventoryAdjustments = lazyWithRetry(() => import("@/pages/InventoryAdjustments"));
const InventoryAdjustmentForm = lazyWithRetry(() => import("@/pages/InventoryAdjustmentForm"));
const PurchaseForm = lazyWithRetry(() => import("@/pages/PurchaseForm"));
const PurchaseView = lazyWithRetry(() => import("@/pages/PurchaseView"));
const ExpenseForm = lazyWithRetry(() => import("@/pages/ExpenseForm"));
const StaffProfile = lazyWithRetry(() => import("@/pages/StaffProfile"));
const Settings = lazyWithRetry(() => import("@/pages/Settings"));
const Profile = lazyWithRetry(() => import("@/pages/Profile"));
const Help = lazyWithRetry(() => import("@/pages/Help"));
const Reports = lazyWithRetry(() => import("@/pages/Reports"));
const POS = lazyWithRetry(() => import("@/pages/POS"));
const Invoices = lazyWithRetry(() => import("@/pages/Invoices"));
const InvoiceCreate = lazyWithRetry(() => import("@/pages/InvoiceCreate"));
const InvoiceEdit = lazyWithRetry(() => import("@/pages/InvoiceEdit"));
const Expenses = lazyWithRetry(() => import("@/pages/Expenses"));
const Payments = lazyWithRetry(() => import("@/pages/Payments"));
const PaymentReceivedNew = lazyWithRetry(() => import("@/pages/PaymentReceivedNew"));
const JobCards = lazyWithRetry(() => import("@/pages/JobCards"));
const CreateJobCard = lazyWithRetry(() => import("@/pages/CreateJobCard"));
const EditJobCard = lazyWithRetry(() => import("@/pages/EditJobCard"));
const JobCardView = lazyWithRetry(() => import("@/pages/JobCardView"));
const Suppliers = lazyWithRetry(() => import("@/pages/Suppliers"));
const SupplierProfile = lazyWithRetry(() => import("@/pages/SupplierProfile"));
const Banking = lazyWithRetry(() => import("@/pages/Banking"));
const Accounts = lazyWithRetry(() => import("@/pages/Accounts"));
const AccountCreate = lazyWithRetry(() => import("@/pages/AccountCreate"));
const AccountEdit = lazyWithRetry(() => import("@/pages/AccountEdit"));
const AccountView = lazyWithRetry(() => import("@/pages/AccountView"));
const Journal = lazyWithRetry(() => import("@/pages/Journal"));
const Purchases = lazyWithRetry(() => import("@/pages/Purchases"));
const StockTransfers = lazyWithRetry(() => import("@/pages/StockTransfers"));

const ProductEdit = lazyWithRetry(() => import("@/pages/ProductEdit"));


const NotFound = lazyWithRetry(() => import("@/pages/NotFound"));
const Landing = lazyWithRetry(() => import("@/pages/Landing"));
import { ErrorBoundary } from "@/components/ErrorBoundary";
import BusinessDirectory from "@/pages/BusinessDirectory";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Admin pages
const AdminDashboard = lazyWithRetry(() => import("@/pages/admin/AdminDashboard"));

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
          <Route path="inventory/:id/edit" element={<ProductEdit />} />
          <Route path="inventory-adjustments" element={<InventoryAdjustments />} />
          <Route path="inventory-adjustments/:id/edit" element={<InventoryAdjustmentForm />} />
          <Route path="inventory-transfers" element={<StockTransfers />} />
          
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
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { SaasProvider, useSaas } from "@/lib/saas";
import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";

// Layouts
import DashboardLayout from "@/components/layout/DashboardLayout";

// Auth Pages
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));


// Main Pages
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Appointments = lazy(() => import("@/pages/Appointments"));
const Clients = lazy(() => import("@/pages/Clients"));
const ClientProfile = lazy(() => import("@/pages/ClientProfile"));
const Staff = lazy(() => import("@/pages/Staff"));
const Services = lazy(() => import("@/pages/Services"));
const Inventory = lazy(() => import("@/pages/Inventory"));
const Receipts = lazy(() => import("@/pages/Receipts"));
const ReceiptView = lazy(() => import("@/pages/ReceiptView"));
const ReceiptForm = lazy(() => import("@/pages/ReceiptForm"));
const StaffProfile = lazy(() => import("@/pages/StaffProfile"));
const Expenses = lazy(() => import("@/pages/Expenses"));
const ExpenseForm = lazy(() => import("@/pages/ExpenseForm"));
const Purchases = lazy(() => import("@/pages/Purchases"));
const PurchaseForm = lazy(() => import("@/pages/PurchaseForm"));
const PurchaseView = lazy(() => import("@/pages/PurchaseView"));
const Suppliers = lazy(() => import("@/pages/Suppliers"));
const GoodsReceived = lazy(() => import("@/pages/GoodsReceived"));
const GoodsReceivedForm = lazy(() => import("@/pages/GoodsReceivedForm"));
const Accounts = lazy(() => import("@/pages/Accounts"));
const AccountCreate = lazy(() => import("@/pages/AccountCreate"));
const AccountEdit = lazy(() => import("@/pages/AccountEdit"));
const POS = lazy(() => import("@/pages/POS"));
const InventoryAdjustments = lazy(() => import("@/pages/InventoryAdjustments"));
const StockTransfers = lazy(() => import("@/pages/StockTransfers"));
const Settings = lazy(() => import("@/pages/Settings"));
const JobCards = lazy(() => import("@/pages/JobCards"));
const CreateJobCard = lazy(() => import("@/pages/CreateJobCard"));
const EditJobCard = lazy(() => import("@/pages/EditJobCard"));
const JobCardView = lazy(() => import("@/pages/JobCardView"));
const SuperAdmin = lazy(() => import("@/pages/SuperAdmin"));
const ServiceView = lazy(() => import("@/pages/ServiceView"));
const ServiceForm = lazy(() => import("@/pages/ServiceForm"));
const Booking = lazy(() => import("@/pages/Booking"));
const SupplierProfile = lazy(() => import("@/pages/SupplierProfile"));
const ProductView = lazy(() => import("@/pages/ProductView"));
const InventoryAdjustmentForm = lazy(() => import("@/pages/InventoryAdjustmentForm"));
const AccountView = lazy(() => import("@/pages/AccountView"));

const NotFound = lazy(() => import("@/pages/NotFound"));
const Landing = lazy(() => import("@/pages/Landing"));
const Reports = lazy(() => import("@/pages/Reports"));
const BillingHistory = lazy(() => import("@/pages/BillingHistory"));
const PaymentMethod = lazy(() => import("@/pages/PaymentMethod"));
const UpgradePlan = lazy(() => import("@/pages/UpgradePlan"));
const Profile = lazy(() => import("@/pages/Profile"));
const Help = lazy(() => import("@/pages/Help"));
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Payments from "@/pages/Payments";
import Banking from "@/pages/Banking";

// Super Admin Pages
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminOrganizations = lazy(() => import("@/pages/admin/AdminOrganizations"));
const AdminSubscriptionPlans = lazy(() => import("@/pages/admin/AdminSubscriptionPlans"));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminInvitations = lazy(() => import("@/pages/admin/AdminInvitations"));
import AdminBusinessData from "@/pages/admin/AdminBusinessData";
const AdminSuperAdmins = lazy(() => import("@/pages/admin/AdminSuperAdmins"));
const AdminActivity = lazy(() => import("@/pages/admin/AdminActivity"));
const AdminSystemSettings = lazy(() => import("@/pages/admin/AdminSystemSettings"));
const AdminLandingCMS = lazy(() => import("@/pages/admin/AdminLandingCMS"));
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
        {/* System-wide routes available to authenticated users */}
        <Route path="/super-admin" element={<SuperAdmin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/organizations" element={<AdminOrganizations />} />
        <Route path="/admin/subscription-plans" element={<AdminSubscriptionPlans />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/invitations" element={<AdminInvitations />} />
        <Route path="/admin/business-data" element={<AdminBusinessData />} />
        <Route path="/super-admin/super-admins" element={<AdminSuperAdmins />} />
        <Route path="/super-admin/activity" element={<AdminActivity />} />
        <Route path="/super-admin/settings" element={<AdminSystemSettings />} />
        <Route path="/super-admin/cms" element={<AdminLandingCMS />} />
        
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
          <Route path="staff/:id" element={<StaffProfile />} />
          <Route path="services" element={<Services />} />
          <Route path="services/new" element={<ServiceForm />} />
          <Route path="services/:id" element={<ServiceView />} />
          <Route path="services/:id/edit" element={<ServiceForm />} />
          
          {/* Inventory Management */}
          <Route path="inventory" element={<Inventory />} />
          <Route path="inventory/:id" element={<ProductView />} />
          <Route path="inventory-adjustments" element={<InventoryAdjustments />} />
          <Route path="inventory-adjustments/new" element={<InventoryAdjustmentForm />} />
          <Route path="inventory-adjustments/:id/edit" element={<InventoryAdjustmentForm />} />
          <Route path="inventory-transfers" element={<StockTransfers />} />
          
          {/* Financial Management */}
          <Route path="expenses" element={<Expenses />} />
          <Route path="expenses/new" element={<ExpenseForm />} />
          <Route path="expenses/:id/edit" element={<ExpenseForm />} />
          <Route path="receipts" element={<Receipts />} />
          <Route path="receipts/new" element={<ReceiptForm />} />
          <Route path="receipts/:id" element={<ReceiptView />} />
          <Route path="receipts/:id/edit" element={<ReceiptForm />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="purchases/new" element={<PurchaseForm />} />
          <Route path="purchases/:id" element={<PurchaseView />} />
          <Route path="purchases/:id/edit" element={<PurchaseForm />} />
          <Route path="goods-received" element={<GoodsReceived />} />
          <Route path="goods-received/new" element={<GoodsReceivedForm />} />
          <Route path="goods-received/:id/edit" element={<GoodsReceivedForm />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="suppliers/:id" element={<SupplierProfile />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="accounts/new" element={<AccountCreate />} />
          <Route path="accounts/:id" element={<AccountView />} />
          <Route path="accounts/:id/edit" element={<AccountEdit />} />
          <Route path="payments" element={<Payments />} />
          <Route path="banking" element={<Banking />} />
          
          {/* Operations */}
          <Route path="job-cards" element={<JobCards />} />
          <Route path="job-cards/new" element={<CreateJobCard />} />
          <Route path="job-cards/:id" element={<JobCardView />} />
          <Route path="job-cards/:id/edit" element={<EditJobCard />} />
          <Route path="pos" element={<POS />} />
          <Route path="booking" element={<Booking />} />
          
          {/* Settings & Support */}
          <Route path="settings" element={<Settings />} />
          <Route path="billing-history" element={<BillingHistory />} />
          <Route path="payment-method" element={<PaymentMethod />} />
          <Route path="upgrade-plan" element={<UpgradePlan />} />
          <Route path="profile" element={<Profile />} />
          <Route path="reports" element={<Reports />} />
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

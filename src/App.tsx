import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Booking from "@/pages/Booking";
import Appointments from "@/pages/Appointments";
import Clients from "@/pages/Clients";
import Invoices from "@/pages/Invoices";
import Staff from "@/pages/Staff";
import Services from "@/pages/Services";
import Inventory from "@/pages/Inventory";
import NotFound from "@/pages/NotFound";
import JobCards from "@/pages/JobCards";
import CreateJobCard from "@/pages/CreateJobCard";
import Expenses from "@/pages/Expenses";
import Purchases from "@/pages/Purchases";
import Suppliers from "@/pages/Suppliers";
import Accounts from "@/pages/Accounts";
import POS from "@/pages/POS";
import InventoryAdjustments from "@/pages/InventoryAdjustments";
import ClientProfile from "@/pages/ClientProfile";
import ServiceView from "@/pages/ServiceView";
import { Toaster } from "@/components/ui/sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

function App() {
  return (
    <Router>
      <Routes>
        {/* Landing page */}
        <Route path="/" element={<Landing />} />
        
        {/* Authentication routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Dashboard routes with layout */}
        <Route 
          path="/dashboard" 
          element={
            <DashboardLayout>
              <Dashboard />
            </DashboardLayout>
          } 
        />
        
        {/* Appointments page with layout */}
        <Route 
          path="/appointments" 
          element={
            <DashboardLayout>
              <Appointments />
            </DashboardLayout>
          } 
        />
        
        {/* Clients page with layout */}
        <Route 
          path="/clients" 
          element={
            <DashboardLayout>
              <Clients />
            </DashboardLayout>
          } 
        />
        
        {/* Staff page with layout */}
        <Route 
          path="/staff" 
          element={
            <DashboardLayout>
              <Staff />
            </DashboardLayout>
          } 
        />
        
        {/* Services page with layout */}
        <Route 
          path="/services" 
          element={
            <DashboardLayout>
              <Services />
            </DashboardLayout>
          } 
        />
        
        {/* Inventory page with layout */}
        <Route 
          path="/inventory" 
          element={
            <DashboardLayout>
              <Inventory />
            </DashboardLayout>
          } 
        />

        {/* Job Cards page with layout */}
        <Route 
          path="/job-cards" 
          element={
            <DashboardLayout>
              <JobCards />
            </DashboardLayout>
          } 
        />

        {/* Create Job Card page with layout */}
        <Route 
          path="/job-cards/new" 
          element={
            <DashboardLayout>
              <CreateJobCard />
            </DashboardLayout>
          } 
        />

        {/* Invoices page with layout */}
        <Route 
          path="/invoices" 
          element={
            <DashboardLayout>
              <Invoices />
            </DashboardLayout>
          } 
        />

        {/* Expenses page with layout */}
        <Route 
          path="/expenses" 
          element={
            <DashboardLayout>
              <Expenses />
            </DashboardLayout>
          } 
        />

        {/* Purchases page with layout */}
        <Route 
          path="/purchases" 
          element={
            <DashboardLayout>
              <Purchases />
            </DashboardLayout>
          } 
        />

        {/* Suppliers page with layout */}
        <Route 
          path="/suppliers" 
          element={
            <DashboardLayout>
              <Suppliers />
            </DashboardLayout>
          } 
        />

        {/* Accounts page with layout */}
        <Route 
          path="/accounts" 
          element={
            <DashboardLayout>
              <Accounts />
            </DashboardLayout>
          } 
        />

        {/* POS page with layout */}
        <Route 
          path="/pos" 
          element={
            <DashboardLayout>
              <POS />
            </DashboardLayout>
          } 
        />

        {/* Inventory Adjustments page with layout */}
        <Route 
          path="/inventory-adjustments" 
          element={
            <DashboardLayout>
              <InventoryAdjustments />
            </DashboardLayout>
          } 
        />

        {/* Client Profile page with layout */}
        <Route 
          path="/clients/:id" 
          element={
            <DashboardLayout>
              <ClientProfile />
            </DashboardLayout>
          } 
        />

        {/* Service View page with layout */}
        <Route 
          path="/services/:id" 
          element={
            <DashboardLayout>
              <ServiceView />
            </DashboardLayout>
          } 
        />
        
        {/* Booking page */}
        <Route path="/booking" element={<Booking />} />

        {/* 404 fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* Global toast notifications */}
      <Toaster richColors />
    </Router>
  );
}

export default App;

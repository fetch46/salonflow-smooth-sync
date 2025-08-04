import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Booking from "@/pages/Booking";
import Appointments from "@/pages/Appointments";
import Clients from "@/pages/Clients";
import Invoices from "@/pages/Invoices";
import Staff from "@/pages/Staff";
import Services from "@/pages/Services";
import Inventory from "@/pages/Inventory";
import NotFound from "@/pages/NotFound";
import { Toaster } from "@/components/ui/sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

function App() {
  return (
    <Router>
      <Routes>
        {/* Landing page */}
        <Route path="/" element={<Landing />} />
        
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

        {/* Invoices page with layout */}
        <Route 
          path="/invoices" 
          element={
            <DashboardLayout>
              <Invoice />
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

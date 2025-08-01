import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Booking from "./pages/Booking";
import NotFound from "./pages/NotFound";
import { DashboardLayout } from "./components/layout/DashboardLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="/dashboard" element={
            <DashboardLayout>
              <Dashboard />
            </DashboardLayout>
          } />
          <Route path="/appointments" element={
            <DashboardLayout>
              <div className="p-6">Appointments Page (Coming Soon)</div>
            </DashboardLayout>
          } />
          <Route path="/clients" element={
            <DashboardLayout>
              <div className="p-6">Clients Page (Coming Soon)</div>
            </DashboardLayout>
          } />
          <Route path="/staff" element={
            <DashboardLayout>
              <div className="p-6">Staff Page (Coming Soon)</div>
            </DashboardLayout>
          } />
          <Route path="/services" element={
            <DashboardLayout>
              <div className="p-6">Services Page (Coming Soon)</div>
            </DashboardLayout>
          } />
          <Route path="/inventory" element={
            <DashboardLayout>
              <div className="p-6">Inventory Page (Coming Soon)</div>
            </DashboardLayout>
          } />
          <Route path="/pos" element={
            <DashboardLayout>
              <div className="p-6">POS Page (Coming Soon)</div>
            </DashboardLayout>
          } />
          <Route path="/job-cards" element={
            <DashboardLayout>
              <div className="p-6">Job Cards Page (Coming Soon)</div>
            </DashboardLayout>
          } />
          <Route path="/reports" element={
            <DashboardLayout>
              <div className="p-6">Reports Page (Coming Soon)</div>
            </DashboardLayout>
          } />
          <Route path="/settings" element={
            <DashboardLayout>
              <div className="p-6">Settings Page (Coming Soon)</div>
            </DashboardLayout>
          } />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

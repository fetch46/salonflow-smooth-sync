
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from 'next-themes';
import { SaasProvider } from '@/lib/saas';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Import pages
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import Clients from '@/pages/Clients';
import Services from '@/pages/Services';
import Staff from '@/pages/Staff';
import Appointments from '@/pages/Appointments';
import JobCards from '@/pages/JobCards';
import Inventory from '@/pages/Inventory';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import NotFound from '@/pages/NotFound';

// Create a query client with better error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false, // Don't retry mutations by default
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <QueryClientProvider client={queryClient}>
          <SaasProvider>
            <Router>
              <div className="min-h-screen bg-background">
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  
                  {/* Protected dashboard routes */}
                  <Route path="/dashboard" element={<DashboardLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="clients" element={<Clients />} />
                    <Route path="services" element={<Services />} />
                    <Route path="staff" element={<Staff />} />
                    <Route path="appointments" element={<Appointments />} />
                    <Route path="job-cards" element={<JobCards />} />
                    <Route path="inventory" element={<Inventory />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="settings" element={<Settings />} />
                  </Route>
                  
                  {/* Catch all route */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
            </Router>
          </SaasProvider>
        </QueryClientProvider>
        <Toaster />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

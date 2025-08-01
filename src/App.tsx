import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Appointments from "@/pages/appointments";
import Home from "@/pages/home"; // Optional, if you have a home page
import NotFound from "@/pages/NotFound"; // Optional, 404 page
import { Toaster } from "@/components/ui/sonner"; // Assuming you're using Sonner for toasts

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Home or default route */}
          <Route path="/" element={<Navigate to="/appointments" />} />

          {/* Appointments Page */}
          <Route path="/appointments" element={<Appointments />} />

          {/* Optional: other pages */}
          {/* <Route path="/dashboard" element={<Dashboard />} /> */}

          {/* 404 fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>

        {/* Global toast notifications */}
        <Toaster richColors />
      </div>
    </Router>
  );
}

export default App;

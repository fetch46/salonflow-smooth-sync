import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Clock,
  User,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Check,
  Star
} from "lucide-react";

interface Service {
  id: number;
  name: string;
  description: string;
  price: number;
  duration: string;
  image: string;
  category: string;
}

const Booking = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    card: "",
    expiry: "",
    cvc: ""
  });

  const steps = [
    { number: 1, title: "Services", icon: User },
    { number: 2, title: "Date & Time", icon: Calendar },
    { number: 3, title: "Staff", icon: User },
    { number: 4, title: "Confirmation", icon: Check }
  ];

  const services: Service[] = [
    {
      id: 1,
      name: "Hair Cut",
      description: "Professional hair cutting and styling",
      price: 45,
      duration: "45 min",
      image: "/placeholder.svg",
      category: "Hair"
    },
    {
      id: 2,
      name: "Hair Color",
      description: "Full color treatment with premium products",
      price: 85,
      duration: "2 hours",
      image: "/placeholder.svg",
      category: "Hair"
    },
    {
      id: 3,
      name: "Manicure",
      description: "Complete nail care and polish application",
      price: 35,
      duration: "1 hour",
      image: "/placeholder.svg",
      category: "Nails"
    },
    {
      id: 4,
      name: "Facial Treatment",
      description: "Deep cleansing and rejuvenating facial",
      price: 75,
      duration: "1.5 hours",
      image: "/placeholder.svg",
      category: "Skincare"
    },
    {
      id: 5,
      name: "Massage Therapy",
      description: "Relaxing full body massage",
      price: 90,
      duration: "1 hour",
      image: "/placeholder.svg",
      category: "Wellness"
    },
    {
      id: 6,
      name: "Eyebrow Shaping",
      description: "Professional eyebrow shaping and tinting",
      price: 25,
      duration: "30 min",
      image: "/placeholder.svg",
      category: "Beauty"
    }
  ];

  const staff = [
    {
      id: 1,
      name: "Maria Garcia",
      specialties: ["Hair Cut", "Hair Color"],
      rating: 4.9,
      experience: "8 years",
      image: "/placeholder.svg"
    },
    {
      id: 2,
      name: "Lisa Wong",
      specialties: ["Manicure", "Facial Treatment"],
      rating: 4.8,
      experience: "5 years",
      image: "/placeholder.svg"
    },
    {
      id: 3,
      name: "Sarah Johnson",
      specialties: ["Massage Therapy", "Facial Treatment"],
      rating: 4.9,
      experience: "10 years",
      image: "/placeholder.svg"
    }
  ];

  const timeSlots = [
    "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
    "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
    "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM"
  ];

  const toggleService = (service: Service) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === service.id);
      return exists ? prev.filter(s => s.id !== service.id) : [...prev, service];
    });
  };

  const getTotalPrice = () => selectedServices.reduce((total, s) => total + s.price, 0);

  const getTotalDuration = () => {
    const totalMinutes = selectedServices.reduce((total, service) => {
      const duration = service.duration;
      const minutes = duration.includes("hour")
        ? parseFloat(duration) * 60
        : parseFloat(duration);
      return total + minutes;
    }, 0);

    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);

    return hours > 0
      ? `${hours}h${minutes > 0 ? ` ${minutes}min` : ""}`
      : `${minutes}min`;
  };

  const canProceed = () => {
    if (currentStep === 1) return selectedServices.length > 0;
    if (currentStep === 2) return selectedDate && selectedTime;
    if (currentStep === 3) return selectedStaff;
    return true;
  };

  const isFormValid = () => {
    return Object.values(form).every(val => val.trim() !== "");
  };

  const handleFormChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleBookingSubmit = () => {
    if (!isFormValid()) return;

    const bookingData = {
      services: selectedServices,
      date: selectedDate,
      time: selectedTime,
      staff: selectedStaff,
      total: getTotalPrice(),
      duration: getTotalDuration(),
      customer: form
    };

    console.log("Booking submitted:", bookingData);

    // Replace with Supabase or API call
    alert("Booking submitted successfully!");
  };

  const renderStepContent = () => {
    // Keep your existing renderStepContent() logic here – no change needed
    // You can paste that section from your current file here
    // OR if you prefer, I can return it inline again (let me know)
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Book Appointment</h1>
            <div className="flex items-center space-x-4">
              {steps.map((step, index) => (
                <div key={step.number} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      currentStep >= step.number
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {currentStep > step.number ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      step.number
                    )}
                  </div>
                  <span
                    className={`ml-2 text-sm ${
                      currentStep >= step.number
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {step.title}
                  </span>
                  {index < steps.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground mx-4" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {renderStepContent()}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <div className="flex items-center space-x-3">
            {currentStep < 4 ? (
              <Button
                onClick={() => setCurrentStep(prev => prev + 1)}
                disabled={!canProceed()}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                size="lg"
                className="px-8"
                onClick={handleBookingSubmit}
                disabled={!isFormValid()}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Complete Booking
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Booking;

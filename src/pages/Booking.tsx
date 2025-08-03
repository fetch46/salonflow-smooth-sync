import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, ChevronLeft, ChevronRight, Check, Calendar, User } from "lucide-react";

const Booking = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedStaff, setSelectedStaff] = useState("");
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

  const canProceed = () => {
    if (currentStep === 1) return selectedServices.length > 0;
    if (currentStep === 2) return selectedDate && selectedTime;
    if (currentStep === 3) return selectedStaff;
    return true;
  };

  const isFormValid = () => {
    return Object.values(form).every(val => val.trim() !== "");
  };

  const handleBookingSubmit = () => {
    if (!isFormValid()) return;

    const bookingData = {
      services: selectedServices,
      date: selectedDate,
      time: selectedTime,
      staff: selectedStaff,
      customer: form
    };

    console.log("Booking submitted:", bookingData);
    alert("Booking submitted successfully!");
  };

  const renderStepContent = () => {
    return (
      <div className="text-muted-foreground text-center p-12 border border-dashed rounded-lg">
        <p>Step {currentStep} content will go here.</p>
      </div>
    );
  };

  return (
    <div className="p-6 mx-auto space-y-6 max-w-5xl">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Book Appointment</h1>
          <p className="text-muted-foreground">Step-by-step salon service booking</p>
        </div>
      </div>

      {/* Steps Header */}
      <Card>
        <CardContent className="p-6 flex items-center justify-center gap-6 flex-wrap">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center space-x-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= step.number
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {currentStep > step.number ? <Check className="w-4 h-4" /> : step.number}
              </div>
              <span
                className={`text-sm ${
                  currentStep >= step.number ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.title}
              </span>
              {index < steps.length - 1 && (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>Step {currentStep}</CardTitle>
        </CardHeader>
        <CardContent>
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>

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
  );
};

export default Booking;

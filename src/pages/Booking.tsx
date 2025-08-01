import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const Booking = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedStaff, setSelectedStaff] = useState<string>("");

  const steps = [
    { number: 1, title: "Services", icon: User },
    { number: 2, title: "Date & Time", icon: Calendar },
    { number: 3, title: "Staff", icon: User },
    { number: 4, title: "Confirmation", icon: Check }
  ];

  const services = [
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

  const toggleService = (service: any) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === service.id);
      if (exists) {
        return prev.filter(s => s.id !== service.id);
      } else {
        return [...prev, service];
      }
    });
  };

  const getTotalPrice = () => {
    return selectedServices.reduce((total, service) => total + service.price, 0);
  };

  const getTotalDuration = () => {
    const totalMinutes = selectedServices.reduce((total, service) => {
      const duration = service.duration;
      const minutes = duration.includes('hour') 
        ? parseInt(duration) * 60 
        : parseInt(duration);
      return total + minutes;
    }, 0);
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}min`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${minutes}min`;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return selectedServices.length > 0;
      case 2:
        return selectedDate && selectedTime;
      case 3:
        return selectedStaff;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Select Services</h2>
              <p className="text-muted-foreground">Choose the services you'd like to book</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              {services.map((service) => (
                <Card
                  key={service.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedServices.find(s => s.id === service.id)
                      ? 'ring-2 ring-primary'
                      : ''
                  }`}
                  onClick={() => toggleService(service)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-foreground">{service.name}</h3>
                          <Badge variant="secondary">{service.category}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {service.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold text-primary">${service.price}</span>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Clock className="w-4 h-4 mr-1" />
                            {service.duration}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {selectedServices.length > 0 && (
              <Card className="bg-accent">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">Selected Services</h3>
                  <div className="space-y-2 mb-4">
                    {selectedServices.map((service) => (
                      <div key={service.id} className="flex justify-between text-sm">
                        <span>{service.name}</span>
                        <span>${service.price}</span>
                      </div>
                    ))}
                  </div>
                  <Separator className="my-3" />
                  <div className="flex justify-between font-semibold">
                    <span>Total: {getTotalDuration()}</span>
                    <span>${getTotalPrice()}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Select Date & Time</h2>
              <p className="text-muted-foreground">Choose your preferred appointment slot</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Select Date</CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Available Times</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                    {timeSlots.map((time) => (
                      <Button
                        key={time}
                        variant={selectedTime === time ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedTime(time)}
                        className="text-xs"
                      >
                        {time}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Choose Staff</h2>
              <p className="text-muted-foreground">Select your preferred technician or any available staff</p>
            </div>

            <div className="space-y-4">
              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedStaff === "any" ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedStaff("any")}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">Any Available Staff</h3>
                      <p className="text-sm text-muted-foreground">
                        We'll assign the best available technician for your services
                      </p>
                    </div>
                    <Badge variant="secondary">Recommended</Badge>
                  </div>
                </CardContent>
              </Card>

              {staff.map((member) => (
                <Card
                  key={member.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedStaff === member.id.toString() ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedStaff(member.id.toString())}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{member.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {member.specialties.join(", ")} • {member.experience}
                          </p>
                          <div className="flex items-center mt-1">
                            <Star className="w-4 h-4 text-warning mr-1" />
                            <span className="text-sm text-muted-foreground">{member.rating}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Confirm Booking</h2>
              <p className="text-muted-foreground">Review your appointment details and complete payment</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Appointment Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Services</Label>
                      <div className="space-y-2 mt-1">
                        {selectedServices.map((service) => (
                          <div key={service.id} className="flex justify-between text-sm">
                            <span>{service.name}</span>
                            <span>${service.price}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label>Date</Label>
                        <p className="text-muted-foreground">{selectedDate}</p>
                      </div>
                      <div>
                        <Label>Time</Label>
                        <p className="text-muted-foreground">{selectedTime}</p>
                      </div>
                      <div>
                        <Label>Duration</Label>
                        <p className="text-muted-foreground">{getTotalDuration()}</p>
                      </div>
                      <div>
                        <Label>Staff</Label>
                        <p className="text-muted-foreground">
                          {selectedStaff === "any" ? "Any Available" : 
                           staff.find(s => s.id.toString() === selectedStaff)?.name}
                        </p>
                      </div>
                    </div>

                    <Separator />
                    
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total</span>
                      <span>${getTotalPrice()}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Payment Information</CardTitle>
                  <CardDescription>Complete your booking with a deposit</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" placeholder="Enter your full name" />
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="Enter your email" />
                  </div>
                  
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" placeholder="Enter your phone number" />
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <Label htmlFor="card">Card Number</Label>
                    <Input id="card" placeholder="1234 5678 9012 3456" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="expiry">Expiry Date</Label>
                      <Input id="expiry" placeholder="MM/YY" />
                    </div>
                    <div>
                      <Label htmlFor="cvc">CVC</Label>
                      <Input id="cvc" placeholder="123" />
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    A 50% deposit (${Math.round(getTotalPrice() * 0.5)}) is required to secure your booking.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      default:
        return null;
    }
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
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {currentStep > step.number ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      step.number
                    )}
                  </div>
                  <span className={`ml-2 text-sm ${
                    currentStep >= step.number ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
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
              <Button size="lg" className="px-8">
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
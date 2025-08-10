import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Eye, 
  EyeOff, 
  Loader2, 
  ArrowLeft, 
  ArrowRight, 
  Building, 
  User, 
  MapPin, 
  CheckCircle,
  Mail,
  Phone,
  Lock,
  Sparkles,
  Shield,
  Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BusinessData {
  // Personal Info
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  
  // Business Info
  businessName: string;
  businessType: string;
  businessDescription: string;
  
  // Location Info
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

interface FieldError {
  [key: string]: string;
}

const Register = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldError>({});
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const navigate = useNavigate();

  const [formData, setFormData] = useState<BusinessData>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    businessName: "",
    businessType: "",
    businessDescription: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "US"
  });

  const totalSteps = 3;
  const progress = (currentStep / totalSteps) * 100;

  const businessTypes = [
    "Hair Salon",
    "Beauty Salon", 
    "Nail Salon",
    "Spa",
    "Barbershop",
    "Lash Studio",
    "Brow Studio",
    "Massage Therapy",
    "Wellness Center",
    "Medical Spa",
    "Day Spa",
    "Beauty Clinic",
    "Aesthetic Clinic",
    "Other"
  ];

  const updateFormData = (field: keyof BusinessData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Real-time validation
  const validateField = (field: keyof BusinessData, value: string): string => {
    switch (field) {
      case 'email':
        if (!value) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address';
        return '';
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) return 'Password must contain uppercase, lowercase, and number';
        return '';
      case 'confirmPassword':
        if (!value) return 'Please confirm your password';
        if (value !== formData.password) return 'Passwords do not match';
        return '';
      case 'phone':
        if (!value) return 'Phone number is required';
        if (!/^\+?[\d\s\-()]{10,}$/.test(value)) return 'Please enter a valid phone number';
        return '';
      case 'firstName':
      case 'lastName':
        if (!value) return `${field === 'firstName' ? 'First' : 'Last'} name is required`;
        if (value.length < 2) return 'Must be at least 2 characters';
        return '';
      case 'businessName':
        if (!value) return 'Business name is required';
        if (value.length < 2) return 'Business name must be at least 2 characters';
        return '';
      case 'businessType':
        if (!value) return 'Please select a business type';
        return '';
      case 'address':
        if (!value) return 'Address is required';
        return '';
      case 'city':
        if (!value) return 'City is required';
        return '';
      case 'state':
        if (!value) return 'State is required';
        return '';
      case 'zipCode':
        if (!value) return 'ZIP code is required';
        if (!/^\d{5}(-\d{4})?$/.test(value)) return 'Please enter a valid ZIP code';
        return '';
      default:
        return '';
    }
  };

  const validateStep = (step: number): boolean => {
    const errors: FieldError = {};
    let hasErrors = false;

    switch (step) {
      case 1: {
        const personalFields: (keyof BusinessData)[] = ['firstName', 'lastName', 'email', 'password', 'confirmPassword', 'phone'];
        personalFields.forEach(field => {
          const error = validateField(field, formData[field]);
          if (error) {
            errors[field] = error;
            hasErrors = true;
          }
        });
        break;
      }
      case 2: {
        const businessFields: (keyof BusinessData)[] = ['businessName', 'businessType'];
        businessFields.forEach(field => {
          const error = validateField(field, formData[field]);
          if (error) {
            errors[field] = error;
            hasErrors = true;
          }
        });
        break;
      }
      case 3: {
        const locationFields: (keyof BusinessData)[] = ['address', 'city', 'state', 'zipCode'];
        locationFields.forEach(field => {
          const error = validateField(field, formData[field]);
          if (error) {
            errors[field] = error;
            hasErrors = true;
          }
        });
        break;
      }
    }

    setFieldErrors(errors);
    if (hasErrors) {
      setError("Please fix the errors below");
      return false;
    }
    setError("");
    return true;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCompletedSteps(prev => [...prev, currentStep]);
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError("");
    setFieldErrors({});
  };

  const goToStep = (step: number) => {
    if (step <= currentStep || completedSteps.includes(step - 1)) {
      setCurrentStep(step);
      setError("");
      setFieldErrors({});
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setLoading(true);
    setError("");

    try {
      // Create user account with proper redirect URL
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone,
            business_name: formData.businessName,
            business_type: formData.businessType,
            business_description: formData.businessDescription,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            zip_code: formData.zipCode,
            country: formData.country,
            role: 'owner'
          }
        }
      });

      if (authError) {
        setError(authError.message);
        toast.error("Registration failed: " + authError.message);
        return;
      }

      if (authData.user) {
        // Store business info in localStorage to use in organization setup
        const businessInfo = {
          businessName: formData.businessName,
          businessType: formData.businessType,
          businessDescription: formData.businessDescription,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          country: formData.country
        };
        localStorage.setItem('pendingBusinessInfo', JSON.stringify(businessInfo));
        
        if (authData.user.email_confirmed_at) {
          // User is immediately confirmed, redirect to organization setup
          toast.success("Registration successful! Let's set up your organization.");
          navigate("/dashboard");
        } else {
          // User needs email confirmation
          toast.success("Registration successful! Please check your email to verify your account, then you'll be redirected to complete setup.");
          navigate("/login", { 
            state: { 
              message: "Please check your email to verify your account, then sign in to complete setup.",
              email: formData.email 
            } 
          });
        }
      }
    } catch (err) {
      setError("An unexpected error occurred");
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        }
      });
      
      if (error) {
        toast.error("Google sign-up failed: " + error.message);
      }
    } catch (err) {
      toast.error("An unexpected error occurred with Google sign-up");
    }
  };

  const renderSocialSignup = () => (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>
      
      <Button
        type="button"
        variant="outline"
        onClick={handleGoogleSignUp}
        className="w-full h-12 border-border hover:bg-accent"
      >
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
      </Button>
    </div>
  );

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
                      <button
              onClick={() => goToStep(step)}
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                step === currentStep
                  ? 'bg-primary text-primary-foreground shadow-lg scale-110'
                  : completedSteps.includes(step)
                  ? 'bg-success text-success-foreground hover:scale-105 cursor-pointer'
                  : step < currentStep
                  ? 'bg-primary/20 text-primary hover:scale-105 cursor-pointer'
                  : 'bg-muted text-muted-foreground'
              }`}
              disabled={step > currentStep && !completedSteps.includes(step - 1)}
              aria-label={`Go to step ${step}: ${step === 1 ? 'Personal Information' : step === 2 ? 'Business Information' : 'Business Location'}`}
              aria-current={step === currentStep ? 'step' : undefined}
            >
            {completedSteps.includes(step) ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              step
            )}
          </button>
          {step < 3 && (
            <div className={`w-16 h-1 mx-2 rounded-full transition-colors duration-300 ${
              completedSteps.includes(step) ? 'bg-success' : 'bg-muted'
            }`} />
          )}
        </div>
      ))}
    </div>
  );

  const renderFieldWithError = (
    field: keyof BusinessData,
    input: React.ReactNode,
    label: string,
    required: boolean = true
  ) => (
    <div className="space-y-2">
      <Label htmlFor={field} className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {input}
      {fieldErrors[field] && (
        <p className="text-sm text-destructive animate-in slide-in-from-top-1 duration-200">
          {fieldErrors[field]}
        </p>
      )}
    </div>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-primary/10 rounded-lg">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground">Personal Information</h3>
                <p className="text-sm text-muted-foreground">Tell us about yourself</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderFieldWithError(
                'firstName',
                <Input
                  id="firstName"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => updateFormData("firstName", e.target.value)}
                  onBlur={() => {
                    const error = validateField('firstName', formData.firstName);
                    if (error) setFieldErrors(prev => ({ ...prev, firstName: error }));
                  }}
                  className={`h-12 transition-colors ${fieldErrors.firstName ? 'border-destructive focus:border-destructive' : ''}`}
                />,
                'First Name'
              )}
              
              {renderFieldWithError(
                'lastName',
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => updateFormData("lastName", e.target.value)}
                  onBlur={() => {
                    const error = validateField('lastName', formData.lastName);
                    if (error) setFieldErrors(prev => ({ ...prev, lastName: error }));
                  }}
                  className={`h-12 transition-colors ${fieldErrors.lastName ? 'border-destructive focus:border-destructive' : ''}`}
                />,
                'Last Name'
              )}
            </div>

            {renderFieldWithError(
              'email',
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => updateFormData("email", e.target.value)}
                  onBlur={() => {
                    const error = validateField('email', formData.email);
                    if (error) setFieldErrors(prev => ({ ...prev, email: error }));
                  }}
                  className={`h-12 pl-10 transition-colors ${fieldErrors.email ? 'border-destructive focus:border-destructive' : ''}`}
                />
              </div>,
              'Email Address'
            )}

            {renderFieldWithError(
              'phone',
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={formData.phone}
                  onChange={(e) => updateFormData("phone", e.target.value)}
                  onBlur={() => {
                    const error = validateField('phone', formData.phone);
                    if (error) setFieldErrors(prev => ({ ...prev, phone: error }));
                  }}
                  className={`h-12 pl-10 transition-colors ${fieldErrors.phone ? 'border-destructive focus:border-destructive' : ''}`}
                />
              </div>,
              'Phone Number'
            )}

            {renderFieldWithError(
              'password',
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={(e) => updateFormData("password", e.target.value)}
                  onBlur={() => {
                    const error = validateField('password', formData.password);
                    if (error) setFieldErrors(prev => ({ ...prev, password: error }));
                  }}
                  className={`h-12 pl-10 pr-10 transition-colors ${fieldErrors.password ? 'border-destructive focus:border-destructive' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>,
              'Password'
            )}

            {renderFieldWithError(
              'confirmPassword',
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={(e) => updateFormData("confirmPassword", e.target.value)}
                  onBlur={() => {
                    const error = validateField('confirmPassword', formData.confirmPassword);
                    if (error) setFieldErrors(prev => ({ ...prev, confirmPassword: error }));
                  }}
                  className={`h-12 pl-10 pr-10 transition-colors ${fieldErrors.confirmPassword ? 'border-destructive focus:border-destructive' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>,
              'Confirm Password'
            )}

            <div className="bg-muted/50 rounded-lg p-4 border border-border">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>Your information is encrypted and secure</span>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground">Business Information</h3>
                <p className="text-sm text-muted-foreground">Tell us about your salon</p>
              </div>
            </div>

            {renderFieldWithError(
              'businessName',
              <Input
                id="businessName"
                placeholder="Elegant Beauty Salon"
                value={formData.businessName}
                onChange={(e) => updateFormData("businessName", e.target.value)}
                onBlur={() => {
                  const error = validateField('businessName', formData.businessName);
                  if (error) setFieldErrors(prev => ({ ...prev, businessName: error }));
                }}
                className={`h-12 transition-colors ${fieldErrors.businessName ? 'border-destructive focus:border-destructive' : ''}`}
              />,
              'Business Name'
            )}

            {renderFieldWithError(
              'businessType',
              <Select 
                value={formData.businessType} 
                onValueChange={(value) => updateFormData("businessType", value)}
              >
                <SelectTrigger className={`h-12 transition-colors ${fieldErrors.businessType ? 'border-destructive focus:border-destructive' : ''}`}>
                  <SelectValue placeholder="Select your business type" />
                </SelectTrigger>
                <SelectContent>
                  {businessTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>,
              'Business Type'
            )}

            <div className="space-y-2">
              <Label htmlFor="businessDescription" className="text-sm font-medium">
                Business Description
              </Label>
              <Textarea
                id="businessDescription"
                placeholder="Tell us about your business, services, and what makes you special..."
                value={formData.businessDescription}
                onChange={(e) => updateFormData("businessDescription", e.target.value)}
                className="min-h-[120px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Optional: Help clients understand what makes your business unique
              </p>
            </div>

            <div className="bg-accent/50 rounded-lg p-4 border border-border">
              <div className="flex items-center space-x-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Why this information matters</span>
              </div>
              <p className="text-xs text-muted-foreground">
                This helps us customize your experience and suggest relevant features for your business type.
              </p>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-primary/10 rounded-lg">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground">Business Location</h3>
                <p className="text-sm text-muted-foreground">Where are you located?</p>
              </div>
            </div>

            {renderFieldWithError(
              'address',
              <Input
                id="address"
                placeholder="123 Main Street"
                value={formData.address}
                onChange={(e) => updateFormData("address", e.target.value)}
                onBlur={() => {
                  const error = validateField('address', formData.address);
                  if (error) setFieldErrors(prev => ({ ...prev, address: error }));
                }}
                className={`h-12 transition-colors ${fieldErrors.address ? 'border-destructive focus:border-destructive' : ''}`}
              />,
              'Street Address'
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderFieldWithError(
                'city',
                <Input
                  id="city"
                  placeholder="New York"
                  value={formData.city}
                  onChange={(e) => updateFormData("city", e.target.value)}
                  onBlur={() => {
                    const error = validateField('city', formData.city);
                    if (error) setFieldErrors(prev => ({ ...prev, city: error }));
                  }}
                  className={`h-12 transition-colors ${fieldErrors.city ? 'border-destructive focus:border-destructive' : ''}`}
                />,
                'City'
              )}
              
              {renderFieldWithError(
                'state',
                <Input
                  id="state"
                  placeholder="NY"
                  value={formData.state}
                  onChange={(e) => updateFormData("state", e.target.value)}
                  onBlur={() => {
                    const error = validateField('state', formData.state);
                    if (error) setFieldErrors(prev => ({ ...prev, state: error }));
                  }}
                  className={`h-12 transition-colors ${fieldErrors.state ? 'border-destructive focus:border-destructive' : ''}`}
                />,
                'State'
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderFieldWithError(
                'zipCode',
                <Input
                  id="zipCode"
                  placeholder="10001"
                  value={formData.zipCode}
                  onChange={(e) => updateFormData("zipCode", e.target.value)}
                  onBlur={() => {
                    const error = validateField('zipCode', formData.zipCode);
                    if (error) setFieldErrors(prev => ({ ...prev, zipCode: error }));
                  }}
                  className={`h-12 transition-colors ${fieldErrors.zipCode ? 'border-destructive focus:border-destructive' : ''}`}
                />,
                'ZIP Code'
              )}
              
              <div className="space-y-2">
                <Label htmlFor="country" className="text-sm font-medium">
                  Country <span className="text-destructive">*</span>
                </Label>
                <Select value={formData.country} onValueChange={(value) => updateFormData("country", value)}>
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="CA">Canada</SelectItem>
                    <SelectItem value="UK">United Kingdom</SelectItem>
                    <SelectItem value="AU">Australia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-success/10 rounded-lg p-4 border border-success/20">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span className="text-sm font-medium text-success">Almost there!</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Once you complete this step, we'll create your account and get you started with your salon management platform.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-2xl">
        <Card className="shadow-xl border-0 bg-card/95 backdrop-blur-sm mx-auto">
          <CardHeader className="space-y-1 text-center pb-6">
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 bg-gradient-to-r from-primary to-primary/80 rounded-2xl flex items-center justify-center shadow-lg">
                <Sparkles className="text-primary-foreground w-7 h-7" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-foreground">
              Join AURA OS
            </CardTitle>
            <CardDescription className="text-base">
              Create your professional salon management account
            </CardDescription>
            
            {renderStepIndicator()}
            
            <div className="mt-4">
              <Progress value={progress} className="w-full h-2" />
              <p className="text-sm text-muted-foreground mt-2">
                Step {currentStep} of {totalSteps}
              </p>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6 px-4 sm:px-8 pb-8">
            {/* Social Sign-up Section - Only show on first step */}
            {currentStep === 1 && (
              <div className="animate-in slide-in-from-top-1 duration-300">
                {renderSocialSignup()}
              </div>
            )}

            {error && (
              <Alert variant="destructive" className="animate-in slide-in-from-top-2 duration-300">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="animate-in slide-in-from-right-2 duration-300" role="main" aria-label={`Registration step ${currentStep} of ${totalSteps}`}>
              {renderStep()}
            </div>

            <div className="flex justify-between items-center pt-6 border-t border-border">
              <div>
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    className="flex items-center space-x-2 h-11"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </Button>
                )}
              </div>

              <div className="flex items-center space-x-3">
                {currentStep < totalSteps ? (
                  <Button
                    type="button"
                    onClick={nextStep}
                    className="bg-primary hover:bg-primary/90 flex items-center space-x-2 h-11 px-6"
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 h-11 px-8"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <span>Create Account</span>
                        <CheckCircle className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            <div className="text-center text-sm text-muted-foreground pt-6">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-primary hover:text-primary/80 hover:underline font-medium transition-colors"
              >
                Sign in here
              </Link>
            </div>

            <div className="flex items-center justify-center space-x-6 text-xs text-muted-foreground pt-2">
              <div className="flex items-center space-x-1">
                <Shield className="w-3 h-3" />
                <span>Secure</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>Setup in 2 minutes</span>
              </div>
              <div className="flex items-center space-x-1">
                <CheckCircle className="w-3 h-3" />
                <span>No credit card</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;
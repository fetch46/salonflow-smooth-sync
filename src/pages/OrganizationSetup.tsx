import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSaas } from '@/contexts/SaasContext';
import { Database } from '@/integrations/supabase/types';
import {
  Building2,
  Check,
  Crown,
  Star,
  Sparkles,
  Rocket,
  Users,
  MapPin,
  BarChart3,
  Zap,
  Shield,
  Globe,
  ArrowRight,
  Loader2,
  Calendar,
  User,
  Package
} from 'lucide-react';

type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row'];

const OrganizationSetup = () => {
  const navigate = useNavigate();
  const { user, refreshOrganizationDataSilently, organization, organizations } = useSaas();
  
  // If user already has organizations, redirect to dashboard
  useEffect(() => {
    if (organization || organizations.length > 0) {
      console.log('User already has organization, redirecting to dashboard');
      navigate('/dashboard');
      return;
    }
  }, [organization, organizations, navigate]);
  
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');

  // -----------------------------
  // Demo plans fallback (client-side only)
  // -----------------------------
  const demoPlans: SubscriptionPlan[] = React.useMemo(() => {
    const now = new Date().toISOString();
    return [
      {
        id: 'starter-demo',
        name: 'Starter',
        slug: 'starter',
        description: 'Perfect for small salons just getting started',
        price_monthly: 2900,
        price_yearly: 29000,
        max_users: 5,
        max_locations: 1,
        features: {
          appointments: true,
          clients: true,
          staff: true,
          services: true,
          basic_reports: true,
          inventory: false,
          job_cards: true,
          invoices: true,
        } as any,
        is_active: true,
        sort_order: 1,
        created_at: now,
        updated_at: now,
      } as unknown as SubscriptionPlan,
      {
        id: 'professional-demo',
        name: 'Professional',
        slug: 'professional',
        description: 'For growing salons with multiple staff members',
        price_monthly: 5900,
        price_yearly: 59000,
        max_users: 25,
        max_locations: 3,
        features: {
          appointments: true,
          clients: true,
          staff: true,
          services: true,
          inventory: true,
          basic_reports: true,
          advanced_reports: true,
          pos: true,
          accounting: true,
          job_cards: true,
          invoices: true,
          analytics: true,
          multi_location: true,
        } as any,
        is_active: true,
        sort_order: 2,
        created_at: now,
        updated_at: now,
      } as unknown as SubscriptionPlan,
      {
        id: 'enterprise-demo',
        name: 'Enterprise',
        slug: 'enterprise',
        description: 'For large salon chains with advanced needs',
        price_monthly: 9900,
        price_yearly: 99000,
        max_users: 100,
        max_locations: 10,
        features: {
          appointments: true,
          clients: true,
          staff: true,
          services: true,
          inventory: true,
          basic_reports: true,
          advanced_reports: true,
          pos: true,
          accounting: true,
          job_cards: true,
          invoices: true,
          api_access: true,
          white_label: true,
          priority_support: true,
          custom_branding: true,
          analytics: true,
          multi_location: true,
          advanced_permissions: true,
          data_export: true,
        } as any,
        is_active: true,
        sort_order: 3,
        created_at: now,
        updated_at: now,
      } as unknown as SubscriptionPlan,
    ];
  }, []);

  const loadDemoPlans = React.useCallback(() => {
    toast.info('Loaded demo subscription plans');
    setPlans(demoPlans);
    const defaultPlan = demoPlans.find((p) => p.slug === 'professional') || demoPlans[0];
    setSelectedPlan(defaultPlan.id);
  }, [demoPlans]);

  // Auto-load demo plans after 5 seconds if no plans were fetched
  useEffect(() => {
    if (plans.length === 0) {
      const timer = setTimeout(() => {
        console.log('Auto-loading demo plans after 5 seconds');
        loadDemoPlans();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [plans, loadDemoPlans]);

  const [formData, setFormData] = useState({
    organizationName: '',
    organizationSlug: '',
    description: '',
    website: '',
    industry: '',
  });

  // Load business info from localStorage if available
  useEffect(() => {
    const pendingInfo = localStorage.getItem('pendingBusinessInfo');
    if (pendingInfo) {
      try {
        const businessInfo = JSON.parse(pendingInfo);
        setFormData(prev => ({
          ...prev,
          organizationName: businessInfo.businessName || '',
          organizationSlug: generateSlug(businessInfo.businessName || ''),
          description: businessInfo.businessDescription || '',
          industry: businessInfo.businessType || ''
        }));
        // Clear the pending info since we've used it
        localStorage.removeItem('pendingBusinessInfo');
      } catch (error) {
        console.error('Error parsing pending business info:', error);
      }
    }
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      // First check if user is authenticated
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !currentUser) {
        toast.error('Please log in to continue');
        return;
      }
      
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) {
        toast.error(`Database error: ${error.message}`);
        setPlans([]);
        setSelectedPlan('');
        return;
      }
      
      const plansToUse = data || [];
      
      if (plansToUse.length === 0) {
        toast.error('No subscription plans available. Please contact support.');
        setPlans([]);
        setSelectedPlan('');
        return;
      }
      
      setPlans(plansToUse);
      
      // Select the professional plan by default
      const professionalPlan = plansToUse.find(plan => plan.slug === 'professional');
      if (professionalPlan) {
        setSelectedPlan(professionalPlan.id);
      } else {
        // Select the first available plan if professional is not found
        const firstPlan = plansToUse[0];
        if (firstPlan) {
          setSelectedPlan(firstPlan.id);
        }
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to load subscription plans. Please try again or contact support.');
      setPlans([]);
      setSelectedPlan('');
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      organizationName: value,
      organizationSlug: generateSlug(value)
    }));
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price / 100);
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) { // || !selectedPlan) {
      toast.error('Please select a plan and ensure you are logged in');
      return;
    }

    if (!formData.organizationName.trim()) {
      toast.error('Organization name is required');
      return;
    }

    setLoading(true);

    // Add a safety timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setLoading(false);
      toast.error('Organization creation is taking too long. Please try again.');
    }, 45000); // 45 second timeout

    try {
      // Verify user authentication first
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !currentUser) {
        console.error('Authentication error:', authError);
        toast.error('Authentication error. Please log in again.');
        return;
      }
      
      console.log('Creating organization using safe function...');
      console.log('Current user:', currentUser.email);
      console.log('Form data:', {
        org_name: formData.organizationName,
        org_slug: formData.organizationSlug,
        plan_id: selectedPlan
      });
      
      const isDemoPlan = selectedPlan.includes('-demo');

      const rpcParams: any = {
        org_name: formData.organizationName,
        org_slug: formData.organizationSlug,
        org_settings: {
          description: formData.description,
          website: formData.website,
          industry: formData.industry,
        },
      };
      if (!isDemoPlan) {
        rpcParams.plan_id = selectedPlan;
      }

      // Use the new safe function to create organization with proper RLS handling
      console.log('Calling create_organization_with_user with params:', rpcParams);
      const { data: orgId, error: orgError } = await supabase.rpc('create_organization_with_user', rpcParams);

      if (orgError) {
        console.error('RPC error:', orgError);
        console.error('RPC error details:', {
          message: orgError.message,
          details: orgError.details,
          hint: orgError.hint,
          code: orgError.code
        });
        
        // Try fallback method if RPC fails
        if (!orgError.message?.includes('User must be authenticated')) {
          console.log('RPC failed, trying fallback method...');
          
          try {
            // Fallback: Direct database inserts
            const { data: org, error: insertError } = await supabase
              .from('organizations')
              .insert({
                name: formData.organizationName,
                slug: formData.organizationSlug,
                settings: {
                  description: formData.description,
                  website: formData.website,
                  industry: formData.industry,
                }
              })
              .select('id')
              .single();

            if (insertError) {
              console.error('Fallback insert error:', insertError);
              if (insertError.message?.includes('duplicate key')) {
                toast.error('Organization name already exists. Please choose a different name.');
              } else {
                toast.error(`Database error: ${insertError.message}`);
              }
              throw insertError;
            }

            // Add user to organization
            const { error: userError } = await supabase
              .from('organization_users')
              .insert({
                organization_id: org.id,
                user_id: user.id,
                role: 'owner',
                is_active: true
              });

            if (userError) {
              console.error('Fallback user insert error:', userError);
              // Clean up the organization we just created
              await supabase.from('organizations').delete().eq('id', org.id);
              toast.error(`Failed to add user to organization: ${userError.message}`);
              throw userError;
            }

            // Create subscription if plan is selected
            if (!isDemoPlan && selectedPlan) {
              const { error: subError } = await supabase
                .from('organization_subscriptions')
                .insert({
                  organization_id: org.id,
                  plan_id: selectedPlan,
                  status: 'trial',
                  interval: billingInterval
                });

              if (subError) {
                console.warn('Failed to create subscription:', subError);
                // Don't fail the whole process for this
              }
            }

            console.log('Organization created successfully using fallback method!');
            toast.success('Organization created successfully using fallback method!');
            
            // Set up trial dates
            if (!isDemoPlan && selectedPlan) {
              const trialStart = new Date();
              const trialEnd = new Date();
              trialEnd.setDate(trialEnd.getDate() + 14);

              const { error: trialError } = await supabase
                .from('organization_subscriptions')
                .update({
                  trial_start: trialStart.toISOString(),
                  trial_end: trialEnd.toISOString(),
                  interval: billingInterval
                })
                .eq('organization_id', org.id);

              if (trialError) {
                console.warn('Failed to set trial dates:', trialError);
              }
            }

            // Set up initial organization data
            try {
              const { error: setupError } = await supabase.rpc('setup_new_organization', {
                org_id: org.id
              });
              
              if (setupError) {
                console.warn('Failed to set up initial data:', setupError);
              }
            } catch (setupErr) {
              console.warn('Setup function not available or failed:', setupErr);
            }

            toast.success('Organization created successfully! Welcome to your 14-day trial.');
            
            // Refresh organization data silently, then navigate
            await refreshOrganizationDataSilently();
            navigate('/dashboard');
            return;

          } catch (fallbackError: any) {
            console.error('Fallback method also failed:', fallbackError);
            toast.error('Organization creation failed. Please try again or contact support.');
            throw fallbackError;
          }
        }
        
        // Provide specific error messages for RPC errors
        if (orgError.message?.includes('function create_organization_with_user does not exist')) {
          toast.error('Database setup incomplete. Please run the latest migrations.');
          console.error('Missing function: create_organization_with_user');
        } else if (orgError.message?.includes('duplicate key')) {
          toast.error('Organization name already exists. Please choose a different name.');
        } else if (orgError.message?.includes('permission denied')) {
          toast.error('Permission denied. Please check your account settings.');
        } else {
          toast.error(`Database error: ${orgError.message}`);
        }
        
        throw orgError;
      }

      if (!orgId) {
        console.error('No organization ID returned from function');
        toast.error('Organization creation failed - no ID returned');
        throw new Error('No organization ID returned');
      }

      console.log('Organization created with ID:', orgId);

      // Set up trial dates on the subscription (the function creates basic subscription)
      if (!isDemoPlan && selectedPlan) {
        const trialStart = new Date();
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 14); // 14-day trial

        const { error: trialError } = await supabase
          .from('organization_subscriptions')
          .update({
            trial_start: trialStart.toISOString(),
            trial_end: trialEnd.toISOString(),
            interval: billingInterval
          })
          .eq('organization_id', orgId);

        if (trialError) {
          console.warn('Failed to set trial dates:', trialError);
          // Don't fail the whole process for this
        }
      }

      // Set up initial organization data
      try {
        const { error: setupError } = await supabase.rpc('setup_new_organization', {
          org_id: orgId
        });
        
        if (setupError) {
          console.warn('Failed to set up initial data:', setupError);
          // Don't fail for this either - user can add data later
        }
      } catch (setupErr) {
        console.warn('Setup function not available or failed:', setupErr);
      }

      // Refresh organization data and navigate
      toast.success('Organization created successfully! Welcome to your salon management system.');
      
      // Clear any pending data and refresh
      localStorage.removeItem('pendingBusinessInfo');
      await refreshOrganizationDataSilently();
      
      // Use setTimeout to ensure state updates have processed
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);

    } catch (error: any) {
      console.error('Error creating organization:', error);
      
      // Clear timeout on error
      clearTimeout(timeoutId);
      
      if (error.message?.includes('organization already exists') || error.message?.includes('duplicate')) {
        toast.error('An organization with this name already exists. Please choose a different name.');
      } else {
        toast.error(`Organization creation failed: ${error.message || 'Unknown error'}. Please try again.`);
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const getPlanIcon = (slug: string) => {
    switch (slug) {
      case 'starter': return <Rocket className="w-6 h-6" />;
      case 'professional': return <Star className="w-6 h-6" />;
      case 'enterprise': return <Crown className="w-6 h-6" />;
      default: return <Building2 className="w-6 h-6" />;
    }
  };

  const getPlanColor = (slug: string) => {
    switch (slug) {
      case 'starter': return 'from-blue-500 to-blue-600';
      case 'professional': return 'from-purple-500 to-purple-600';
      case 'enterprise': return 'from-amber-500 to-amber-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getPopularPlan = () => {
    return plans.find(plan => plan.slug === 'professional')?.id;
  };

  const selectedPlanData = plans.find(plan => plan.id === selectedPlan);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-8">

        {/* Emergency Exit for Stuck Users */}
        {user && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-blue-900">Already have an organization?</h3>
                <p className="text-sm text-blue-800">If you're stuck on this page but already completed setup, click below to go to your dashboard.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  console.log('Manual navigation to dashboard');
                  // Force refresh organization data before navigating
                  refreshOrganizationDataSilently().then(() => {
                    navigate('/dashboard');
                  });
                }}
                className="bg-white hover:bg-blue-50 border-blue-300"
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="p-3 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl shadow-lg w-fit mx-auto">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Setup Your Organization</h1>
            <p className="text-slate-600 mt-2">
              Let's get your salon management system ready in just a few steps
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Organization Details */}
          <Card className="shadow-lg border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-violet-600" />
                Organization Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Label htmlFor="organizationName">Organization Name *</Label>
                  <Input
                    id="organizationName"
                    value={formData.organizationName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g., Bella Vista Salon"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="organizationSlug">Organization URL</Label>
                  <div className="flex items-center">
                    <span className="bg-slate-100 text-slate-600 px-3 py-2 rounded-l-md border border-r-0 text-sm">
                      app.salonsaas.com/
                    </span>
                    <Input
                      id="organizationSlug"
                      value={formData.organizationSlug}
                      onChange={(e) => setFormData(prev => ({ ...prev, organizationSlug: e.target.value }))}
                      placeholder="bella-vista-salon"
                      className="rounded-l-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="website">Website (Optional)</Label>
                  <Input
                    id="website"
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://www.example.com"
                  />
                </div>

                <div>
                  <Label htmlFor="industry">Industry (Optional)</Label>
                  <Input
                    id="industry"
                    value={formData.industry}
                    onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                    placeholder="e.g., Hair Salon, Spa, Beauty Center"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your salon and services..."
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Plan Selection */}
          <Card className="shadow-lg border-slate-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-600" />
                  Choose Your Plan
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={billingInterval === 'month' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBillingInterval('month')}
                  >
                    Monthly
                  </Button>
                  <Button
                    type="button"
                    variant={billingInterval === 'year' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBillingInterval('year')}
                  >
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 mr-2">
                      Save 20%
                    </Badge>
                    Yearly
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {plans.length === 0 && (
                <div className="text-center py-8 space-y-4">
                  <div className="animate-pulse">
                    <div className="h-4 bg-slate-200 rounded w-3/4 mx-auto mb-3"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/2 mx-auto"></div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-4">
                    <p className="text-red-800 font-medium">No subscription plans available</p>
                    <p className="text-sm text-red-700">
                      You can load demo plans or retry fetching from the database.
                    </p>
                    <div className="flex justify-center gap-3">
                      <Button type="button" onClick={loadDemoPlans}>
                        📦 Load Demo Plans & Continue Setup
                      </Button>
                      <Button type="button" variant="outline" onClick={fetchPlans}>
                        ↻ Retry Fetching Plans
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              

              
              <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {plans.map((plan) => {
                    const isPopular = plan.id === getPopularPlan();
                    const price = billingInterval === 'month' ? plan.price_monthly : plan.price_yearly;
                    const features = plan.features as Record<string, boolean>;
                    
                    return (
                      <div key={plan.id} className="relative">
                        {isPopular && (
                          <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 shadow-lg">
                            <Sparkles className="w-3 h-3 mr-1" />
                            Most Popular
                          </Badge>
                        )}
                        
                        <div
                          className={`border-2 rounded-xl p-6 cursor-pointer transition-all duration-200 h-full ${
                            selectedPlan === plan.id
                              ? 'border-violet-500 shadow-lg bg-violet-50'
                              : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                          }`}
                          onClick={() => setSelectedPlan(plan.id)}
                        >
                          <RadioGroupItem value={plan.id} id={plan.id} className="sr-only" />
                          
                          <div className="space-y-4">
                            {/* Plan Header */}
                            <div className="text-center">
                              <div className={`p-3 bg-gradient-to-br ${getPlanColor(plan.slug)} rounded-lg w-fit mx-auto mb-3`}>
                                <div className="text-white">
                                  {getPlanIcon(plan.slug)}
                                </div>
                              </div>
                              <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                              <p className="text-slate-600 text-sm mt-1">{plan.description}</p>
                            </div>

                            {/* Pricing */}
                            <div className="text-center">
                              <div className="text-3xl font-bold text-slate-900">
                                {formatPrice(price)}
                              </div>
                              <div className="text-slate-600 text-sm">
                                per {billingInterval}
                                {billingInterval === 'year' && (
                                  <span className="block text-xs text-emerald-600 font-medium">
                                    {formatPrice(plan.price_monthly * 12 - price)} saved annually
                                  </span>
                                )}
                              </div>
                            </div>

                            <Separator />

                            {/* Features */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-sm">
                                <Users className="w-4 h-4 text-slate-600" />
                                <span>
                                  {plan.max_users ? `Up to ${plan.max_users} users` : 'Unlimited users'}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2 text-sm">
                                <MapPin className="w-4 h-4 text-slate-600" />
                                <span>
                                  {plan.max_locations ? `${plan.max_locations} location${plan.max_locations > 1 ? 's' : ''}` : 'Unlimited locations'}
                                </span>
                              </div>

                              {Object.entries(features).map(([feature, enabled]) => {
                                if (!enabled) return null;
                                
                                const getFeatureIcon = (f: string) => {
                                  switch (f) {
                                    case 'appointments': return <Calendar className="w-4 h-4 text-emerald-600" />;
                                    case 'clients': return <Users className="w-4 h-4 text-emerald-600" />;
                                    case 'staff': return <User className="w-4 h-4 text-emerald-600" />;
                                    case 'inventory': return <Package className="w-4 h-4 text-emerald-600" />;
                                    case 'reports': return <BarChart3 className="w-4 h-4 text-emerald-600" />;
                                    case 'advanced_reports': return <BarChart3 className="w-4 h-4 text-emerald-600" />;
                                    case 'integrations': return <Zap className="w-4 h-4 text-emerald-600" />;
                                    case 'api_access': return <Globe className="w-4 h-4 text-emerald-600" />;
                                    case 'white_label': return <Shield className="w-4 h-4 text-emerald-600" />;
                                    default: return <Check className="w-4 h-4 text-emerald-600" />;
                                  }
                                };

                                const getFeatureLabel = (f: string) => {
                                  switch (f) {
                                    case 'appointments': return 'Appointment Management';
                                    case 'clients': return 'Client Management';
                                    case 'staff': return 'Staff Management';
                                    case 'inventory': return 'Inventory Management';
                                    case 'basic_reports': return 'Basic Reports';
                                    case 'reports': return 'Advanced Reports';
                                    case 'advanced_reports': return 'Premium Analytics';
                                    case 'integrations': return 'Third-party Integrations';
                                    case 'api_access': return 'API Access';
                                    case 'white_label': return 'White Label Branding';
                                    default: return f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                  }
                                };

                                return (
                                  <div key={feature} className="flex items-center gap-2 text-sm">
                                    {getFeatureIcon(feature)}
                                    <span>{getFeatureLabel(feature)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </RadioGroup>

              {selectedPlanData && (
                <div className="mt-6 p-4 bg-violet-50 border border-violet-200 rounded-lg">
                  <div className="flex items-center gap-2 text-violet-800 mb-2">
                    <Sparkles className="w-4 h-4" />
                    <span className="font-medium">14-Day Free Trial</span>
                  </div>
                  <p className="text-violet-700 text-sm">
                    Start with a free trial of {selectedPlanData.name}. No credit card required. 
                    You can upgrade, downgrade, or cancel anytime during your trial.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button
              type="submit"
              size="lg"
              disabled={loading || !selectedPlan}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg px-8"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Organization...
                </>
              ) : (
                <>
                  Start Free Trial
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>

          {/* Debug Section */}
          <div className="mt-8 border-t border-slate-200 pt-6">
            <details className="group">
              <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700 font-medium">
                🔧 Debug & Troubleshooting
              </summary>
              <div className="mt-4 space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h4 className="font-medium text-slate-900 mb-3">Database Connection Test</h4>
                  <div className="space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        console.log('🔍 Testing database connection...');
                        
                        // Test user authentication
                        const { data: { user }, error: authError } = await supabase.auth.getUser();
                        if (authError) {
                          console.error('❌ Auth error:', authError);
                          toast.error('Authentication error. Please log in again.');
                          return;
                        }
                        if (!user) {
                          console.error('❌ No user authenticated');
                          toast.error('No user authenticated. Please log in.');
                          return;
                        }
                        console.log('✅ User authenticated:', user.email);

                        // Test subscription plans access
                        const { data: plans, error: plansError } = await supabase
                          .from('subscription_plans')
                          .select('id, name, slug')
                          .eq('is_active', true);
                        if (plansError) {
                          console.error('❌ Cannot read subscription_plans:', plansError);
                          toast.error('Cannot access subscription plans. Check database permissions.');
                          return;
                        }
                        console.log('✅ Can read subscription_plans:', plans?.length || 0, 'plans');

                        // Test RPC function
                        const { error: funcError } = await supabase.rpc('create_organization_with_user', {
                          org_name: 'test',
                          org_slug: 'test',
                          org_settings: {},
                          plan_id: null
                        });
                        if (funcError && funcError.message.includes('function create_organization_with_user does not exist')) {
                          console.error('❌ RPC function does not exist');
                          toast.error('Database function missing. Run emergency script.');
                          return;
                        }
                        console.log('✅ RPC function exists (even if call failed due to validation)');

                        // Test organizations table access
                        const { data: orgs, error: orgsError } = await supabase
                          .from('organizations')
                          .select('id, name')
                          .limit(1);
                        if (orgsError) {
                          console.error('❌ Cannot read organizations:', orgsError);
                          toast.error('Cannot access organizations table. Check database permissions.');
                          return;
                        }
                        console.log('✅ Can read organizations:', orgs?.length || 0, 'organizations');

                        toast.success('Database connection test completed. Check console for details.');
                      }}
                    >
                      🔍 Test DB
                    </Button>
                    
                    <div className="text-xs text-slate-600 space-y-1">
                      <p>• Click to test database connectivity and permissions</p>
                      <p>• Check browser console (F12) for detailed results</p>
                      <p>• Visit <a href="/debug/database" className="text-violet-600 hover:underline">Debug Database</a> for comprehensive testing</p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-medium text-amber-900 mb-3">Common Issues & Solutions</h4>
                  <div className="text-xs text-amber-800 space-y-2">
                    <p><strong>❌ "Failed to create organization"</strong></p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Run the emergency database script in Supabase SQL Editor</li>
                      <li>Check if user is properly authenticated</li>
                      <li>Try a different organization name</li>
                    </ul>
                    
                    <p><strong>❌ "Function does not exist"</strong></p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Copy and run <code className="bg-amber-100 px-1 rounded">emergency_create_organization_function.sql</code></li>
                      <li>Verify Supabase project is active</li>
                    </ul>
                    
                    <p><strong>❌ "Permission denied"</strong></p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Log out and log back in</li>
                      <li>Check RLS policies are properly set</li>
                    </ul>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrganizationSetup;

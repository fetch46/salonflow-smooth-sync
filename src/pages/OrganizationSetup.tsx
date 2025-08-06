import React, { useState, useEffect } from 'react';
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
  const { user, refreshOrganizationData } = useSaas();
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');

  const [formData, setFormData] = useState({
    organizationName: '',
    organizationSlug: '',
    description: '',
    website: '',
    industry: '',
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setPlans(data || []);
      
      // Select the professional plan by default
      const professionalPlan = data?.find(plan => plan.slug === 'professional');
      if (professionalPlan) {
        setSelectedPlan(professionalPlan.id);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to load subscription plans');
    }
  };

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
    
    if (!user || !selectedPlan) {
      toast.error('Please select a plan and ensure you are logged in');
      return;
    }

    if (!formData.organizationName.trim()) {
      toast.error('Organization name is required');
      return;
    }

    setLoading(true);

    try {
      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert([{
          name: formData.organizationName,
          slug: formData.organizationSlug,
          settings: {
            description: formData.description,
            website: formData.website,
            industry: formData.industry,
          }
        }])
        .select()
        .single();

      if (orgError) throw orgError;

      // Add user as owner
      const { error: userError } = await supabase
        .from('organization_users')
        .insert([{
          organization_id: org.id,
          user_id: user.id,
          role: 'owner',
          is_active: true,
          joined_at: new Date().toISOString(),
        }]);

      if (userError) throw userError;

      // Create trial subscription
      const trialStart = new Date();
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14); // 14-day trial

      const { error: subError } = await supabase
        .from('organization_subscriptions')
        .insert([{
          organization_id: org.id,
          plan_id: selectedPlan,
          status: 'trial',
          interval: billingInterval,
          trial_start: trialStart.toISOString(),
          trial_end: trialEnd.toISOString(),
        }]);

      if (subError) throw subError;

      toast.success('Organization created successfully! Welcome to your 14-day trial.');
      
      // Refresh organization data and navigate to dashboard
      await refreshOrganizationData();
      navigate('/dashboard');

    } catch (error) {
      console.error('Error creating organization:', error);
      toast.error('Failed to create organization. Please try again.');
    } finally {
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
        </form>
      </div>
    </div>
  );
};

export default OrganizationSetup;
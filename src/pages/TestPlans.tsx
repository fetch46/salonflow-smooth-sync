import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSaas } from '@/contexts/SaasContext';
import { Database } from '@/integrations/supabase/types';

type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row'];

export default function TestPlans() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useSaas();

  // Same mock plans as in OrganizationSetup
  const mockPlans = useMemo(() => [
    {
      id: 'mock-starter',
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
        inventory: false
      },
      is_active: true,
      sort_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'mock-professional',
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
        accounting: true
      },
      is_active: true,
      sort_order: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'mock-enterprise',
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
        api_access: true,
        white_label: true
      },
      is_active: true,
      sort_order: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ], []);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('TestPlans: Fetching subscription plans...');
      const { data, error: queryError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      console.log('TestPlans: Query result:', { data, error: queryError });

      if (queryError) throw queryError;
      
      setPlans(data || []);
      
      if (!data || data.length === 0) {
        console.warn('TestPlans: No plans found, using mock data');
        setPlans(mockPlans);
        toast.error('No plans in database, showing mock data');
      } else {
        toast.success(`Loaded ${data.length} plans from database`);
      }
      
    } catch (err: any) {
      console.error('TestPlans: Error fetching plans:', err);
      setError(err.message);
      setPlans(mockPlans);
      toast.error('Database error, using mock data');
    } finally {
      setLoading(false);
    }
  }, [mockPlans]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price / 100);
  };

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-slate-900">Subscription Plans Test</h1>
          <p className="text-slate-600">Testing subscription plan loading and rendering</p>
        </div>

        {/* Debug Info */}
        <Card>
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <strong>User:</strong> {user?.email || 'No user logged in'}
              </div>
              <div>
                <strong>Plans Count:</strong> {plans.length}
              </div>
              <div>
                <strong>Loading:</strong> {loading ? 'Yes' : 'No'}
              </div>
            </div>
            
            {error && (
              <div className="bg-red-50 text-red-800 p-3 rounded">
                <strong>Error:</strong> {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={fetchPlans} disabled={loading}>
                {loading ? 'Loading...' : 'Fetch from Database'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setPlans(mockPlans);
                  toast.success('Loaded mock plans');
                }}
              >
                Load Mock Plans
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setPlans([]);
                  toast.info('Cleared plans');
                }}
              >
                Clear Plans
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Plans Display */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Plan Cards ({plans.length} found)</h2>
          
          {plans.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-slate-600">No plans to display</p>
                <p className="text-sm text-slate-500 mt-2">
                  Click "Fetch from Database" or "Load Mock Plans" above
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => {
                const isPopular = plan.slug === 'professional';
                const features = plan.features as Record<string, boolean>;
                
                return (
                  <Card key={plan.id} className={`relative ${isPopular ? 'border-purple-500 shadow-lg' : ''}`}>
                    {isPopular && (
                      <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-purple-600">
                        Most Popular
                      </Badge>
                    )}
                    
                    <CardHeader className="text-center">
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <p className="text-slate-600 text-sm">{plan.description}</p>
                      <div className="text-3xl font-bold text-slate-900">
                        {formatPrice(plan.price_monthly)}
                        <span className="text-base font-normal text-slate-600">/month</span>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Max Users:</span>
                          <span className="font-medium">{plan.max_users || 'Unlimited'}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Max Locations:</span>
                          <span className="font-medium">{plan.max_locations || 'Unlimited'}</span>
                        </div>
                      </div>

                      <div className="pt-4 border-t">
                        <h4 className="font-medium text-sm mb-2">Features:</h4>
                        <div className="space-y-1">
                          {Object.entries(features).map(([feature, enabled]) => {
                            if (!enabled) return null;
                            return (
                              <div key={feature} className="flex items-center gap-2 text-sm">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="capitalize">{feature.replace('_', ' ')}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Raw Data */}
        {plans.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Raw Plan Data</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-slate-100 p-4 rounded overflow-auto">
                {JSON.stringify(plans, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
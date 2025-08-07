import React, { useState, useEffect, useCallback } from 'react';
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
        console.warn('TestPlans: No plans found in database');
        toast.error('No subscription plans available in database');
      } else {
        toast.success(`Loaded ${data.length} plans from database`);
      }
      
    } catch (err: any) {
      console.error('TestPlans: Error fetching plans:', err);
      setError(err.message);
      setPlans([]);
      toast.error('Failed to load subscription plans from database');
    } finally {
      setLoading(false);
    }
  }, []);

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

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Test Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <Button 
                onClick={fetchPlans} 
                disabled={loading}
                variant="outline"
              >
                🔄 Fetch from Database
              </Button>
              
              <Button 
                onClick={() => {
                  console.log('Current user:', user?.email || 'Not authenticated');
                  console.log('Plans state:', plans);
                  console.log('Error state:', error);
                  toast.info('Check console for debug info');
                }}
                variant="outline"
              >
                🐛 Debug Info
              </Button>
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium">Error:</p>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            )}
            
            <div className="text-sm text-slate-600">
              <p><strong>User:</strong> {user?.email || 'Not authenticated'}</p>
              <p><strong>Plans Found:</strong> {plans.length}</p>
              <p><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</p>
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
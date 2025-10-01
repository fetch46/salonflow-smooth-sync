import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check, Crown, Zap } from 'lucide-react';
import { useSaas } from '@/lib/saas';

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price_monthly: number;
  price_yearly: number;
  max_users?: number;
  max_locations?: number;
  features: any;
  is_active: boolean;
}

export function SubscriptionPlanSelector() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const { organization, subscriptionPlan } = useSaas();

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    if (subscriptionPlan) {
      setSelectedPlanId(subscriptionPlan.id);
    }
  }, [subscriptionPlan]);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const updateSubscription = async () => {
    if (!organization?.id || !selectedPlanId) return;

    try {
      setUpdating(true);
      
      // Update organization subscription
      const { error: subError } = await supabase
        .from('organization_subscriptions')
        .upsert({
          organization_id: organization.id,
          plan_id: selectedPlanId,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        });

      if (subError) throw subError;

      toast.success('Subscription plan updated successfully');
      
      // Reload the page to refresh module access
      window.location.reload();
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast.error('Failed to update subscription plan');
    } finally {
      setUpdating(false);
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getModules = (plan: SubscriptionPlan) => {
    try {
      const features = plan.features || {};
      return Object.keys(features).filter(key => features[key] === true);
    } catch {
      return [];
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-600" />
          Subscription Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Plan</label>
          <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a subscription plan" />
            </SelectTrigger>
            <SelectContent>
              {plans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  <div className="flex items-center gap-2">
                    <span>{plan.name}</span>
                    <Badge variant="outline">
                      {formatPrice(plan.price_monthly)}/mo
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedPlanId && (
          <div className="space-y-4">
            {plans.filter(p => p.id === selectedPlanId).map(plan => (
              <div key={plan.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{plan.name}</h3>
                    <p className="text-sm text-gray-600">{plan.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatPrice(plan.price_monthly)}/month</div>
                    <div className="text-sm text-gray-500">{formatPrice(plan.price_yearly)}/year</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Included Modules:</h4>
                  <div className="flex flex-wrap gap-2">
                    {getModules(plan).length > 0 ? (
                      getModules(plan).map(module => (
                        <Badge key={module} variant="secondary" className="text-xs">
                          <Check className="w-3 h-3 mr-1" />
                          {module.charAt(0).toUpperCase() + module.slice(1).replace('_', ' ')}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-gray-500">No modules configured</span>
                    )}
                  </div>
                </div>

                {plan.max_users && (
                  <div className="text-sm">
                    <span className="font-medium">Max Users:</span> {plan.max_users}
                  </div>
                )}

                {plan.max_locations && (
                  <div className="text-sm">
                    <span className="font-medium">Max Locations:</span> {plan.max_locations}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <Button 
          onClick={updateSubscription} 
          disabled={!selectedPlanId || updating || selectedPlanId === subscriptionPlan?.id}
          className="w-full"
        >
          {updating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
              Updating...
            </>
          ) : selectedPlanId === subscriptionPlan?.id ? (
            'Current Plan'
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Update Subscription
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
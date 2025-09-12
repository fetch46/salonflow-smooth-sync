import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreditCard, Crown, Calendar, DollarSign, Download, ExternalLink, Zap, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSaas } from '@/lib/saas';
import { useOrganizationCurrency } from '@/lib/saas/hooks';
import { SubscriptionPlanSelector } from './SubscriptionPlanSelector';

interface BillingRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  paid_at?: string;
  invoice_url?: string;
}

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

export function SubscriptionBilling() {
  const { organization, subscriptionPlan, subscription } = useSaas();
  const { format: formatCurrency } = useOrganizationCurrency();
  const [billingHistory, setBillingHistory] = useState<BillingRecord[]>([]);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);

  useEffect(() => {
    if (organization?.id) {
      loadBillingData();
      loadAvailablePlans();
    }
  }, [organization?.id]);

  const loadBillingData = async () => {
    if (!organization?.id) return;

    try {
      const { data, error } = await supabase
        .from('billing_history')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBillingHistory(data || []);
    } catch (error) {
      console.error('Error loading billing history:', error);
      toast.error('Failed to load billing history');
    }
  };

  const loadAvailablePlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setAvailablePlans(data || []);
    } catch (error) {
      console.error('Error loading plans:', error);
      toast.error('Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (cents: number) => {
    return formatCurrency(cents / 100);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      paid: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      refunded: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getSubscriptionStatus = () => {
    if (!subscription) return 'No Subscription';
    
    switch (subscription.status) {
      case 'active': return 'Active';
      case 'trial': return 'Trial';
      case 'cancelled': return 'Cancelled';
      case 'expired': return 'Expired';
      default: return subscription.status;
    }
  };

  const getSubscriptionStatusColor = () => {
    if (!subscription) return 'bg-gray-100 text-gray-800';
    
    switch (subscription.status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'trial': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const handleManageSubscription = () => {
    // This would typically open Stripe Customer Portal or similar
    toast.info('Subscription management will be implemented with payment provider integration');
  };

  const getFeatures = (plan: SubscriptionPlan) => {
    try {
      const features = plan.features || {};
      return Object.keys(features).filter(key => features[key] === true);
    } catch {
      return [];
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Subscription + Plan Selection side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-600" />
              Current Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">
                  {subscriptionPlan?.name || 'No Plan Selected'}
                </h3>
                <p className="text-sm text-gray-600">
                  {subscriptionPlan?.description || 'Select a subscription plan to get started'}
                </p>
              </div>
              <div className="text-right space-y-1">
                <Badge className={getSubscriptionStatusColor()}>
                  {getSubscriptionStatus()}
                </Badge>
                {subscriptionPlan && (
                  <div className="text-sm text-gray-600">
                    {formatPrice(subscriptionPlan.price_monthly)}/month
                  </div>
                )}
              </div>
            </div>

            {subscriptionPlan && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {subscriptionPlan.max_users || '∞'}
                  </div>
                  <div className="text-sm text-gray-600">Max Users</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {subscriptionPlan.max_locations || '∞'}
                  </div>
                  <div className="text-sm text-gray-600">Max Locations</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {getFeatures(subscriptionPlan).length}
                  </div>
                  <div className="text-sm text-gray-600">Features</div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={() => setIsUpgradeDialogOpen(true)}>
                <Zap className="w-4 h-4 mr-2" />
                Change Plan
              </Button>
              {subscription && (
                <Button variant="outline" onClick={handleManageSubscription}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Manage Billing
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Plan Selection */}
        <SubscriptionPlanSelector />
      </div>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Billing History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {billingHistory.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500">No billing history found</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid Date</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billingHistory.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {new Date(record.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(record.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(record.status)}>
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {record.paid_at 
                        ? new Date(record.paid_at).toLocaleDateString()
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      {record.invoice_url && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={record.invoice_url} target="_blank" rel="noopener noreferrer">
                            <Download className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Plan Comparison Dialog */}
      <Dialog open={isUpgradeDialogOpen} onOpenChange={setIsUpgradeDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choose Your Plan</DialogTitle>
            <DialogDescription>
              Select the plan that best fits your business needs
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availablePlans.map((plan) => (
              <Card 
                key={plan.id} 
                className={`relative cursor-pointer transition-all hover:shadow-lg ${
                  subscriptionPlan?.id === plan.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setSelectedPlan(plan)}
              >
                {subscriptionPlan?.id === plan.id && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-blue-100 text-blue-800">Current</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <div className="space-y-2">
                    <div className="text-2xl font-bold">
                      {formatPrice(plan.price_monthly)}
                      <span className="text-sm font-normal text-gray-500">/month</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatPrice(plan.price_yearly)}/year (save 2 months)
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600">{plan.description}</p>
                  
                  <div className="space-y-2">
                    <div className="text-sm">
                      <strong>Users:</strong> {plan.max_users || 'Unlimited'}
                    </div>
                    <div className="text-sm">
                      <strong>Locations:</strong> {plan.max_locations || 'Unlimited'}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Features:</div>
                    <div className="space-y-1">
                      {getFeatures(plan).slice(0, 5).map((feature) => (
                        <div key={feature} className="flex items-center gap-2 text-sm">
                          <Check className="w-3 h-3 text-green-600" />
                          {feature.charAt(0).toUpperCase() + feature.slice(1).replace('_', ' ')}
                        </div>
                      ))}
                      {getFeatures(plan).length > 5 && (
                        <div className="text-xs text-gray-500">
                          +{getFeatures(plan).length - 5} more features
                        </div>
                      )}
                    </div>
                  </div>

                  {subscriptionPlan?.id !== plan.id && (
                    <Button className="w-full" size="sm">
                      Select Plan
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
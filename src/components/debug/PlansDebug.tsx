import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CheckCircle, Crown } from 'lucide-react';

export default function PlansDebug() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching subscription plans...');
      
      const { data, error: queryError, count } = await supabase
        .from('subscription_plans')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .order('sort_order');

      console.log('Query response:', { data, error: queryError, count });
      
      setRawResponse({ data, error: queryError, count });

      if (queryError) {
        throw queryError;
      }

      setPlans(data || []);
      
    } catch (err: any) {
      console.error('Error fetching plans:', err);
      setError(err.message || 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const testInsert = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Testing subscription plan insert...');
      
      // Try to insert a test plan
      const { data, error: insertError } = await supabase
        .from('subscription_plans')
        .insert({
          name: 'Test Plan',
          slug: 'test-plan-' + Date.now(),
          description: 'A test plan for debugging',
          price_monthly: 1000,
          price_yearly: 10000,
          max_users: 5,
          max_locations: 1,
          features: { test: true },
          is_active: true,
          sort_order: 999
        })
        .select()
        .single();

      console.log('Insert response:', { data, error: insertError });

      if (insertError) {
        throw insertError;
      }

      // Fetch plans again to see the new one
      await fetchPlans();
      
    } catch (err: any) {
      console.error('Error inserting test plan:', err);
      setError(err.message || 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Current user:', user);
  };

  useEffect(() => {
    checkAuth();
    fetchPlans();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5" />
            Subscription Plans Debug
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={fetchPlans} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Fetch Plans
            </Button>
            <Button onClick={testInsert} disabled={loading} variant="outline">
              Test Insert
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4">
            <div>
              <h3 className="font-semibold mb-2">Plans Found: {plans.length}</h3>
              {plans.length === 0 && !loading && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No subscription plans found. This could mean:
                    <ul className="list-disc ml-4 mt-2">
                      <li>The migration hasn't been run</li>
                      <li>RLS policies are blocking access</li>
                      <li>The data wasn't inserted properly</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {plans.map((plan) => (
              <Card key={plan.id} className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Slug:</strong> {plan.slug}
                    </div>
                    <div>
                      <strong>Monthly:</strong> ${(plan.price_monthly / 100).toFixed(2)}
                    </div>
                    <div>
                      <strong>Yearly:</strong> ${(plan.price_yearly / 100).toFixed(2)}
                    </div>
                    <div>
                      <strong>Max Users:</strong> {plan.max_users || 'Unlimited'}
                    </div>
                    <div>
                      <strong>Max Locations:</strong> {plan.max_locations || 'Unlimited'}
                    </div>
                    <div>
                      <strong>Sort Order:</strong> {plan.sort_order}
                    </div>
                  </div>
                  <div className="mt-4">
                    <strong>Description:</strong>
                    <p className="text-slate-600 mt-1">{plan.description}</p>
                  </div>
                  <div className="mt-4">
                    <strong>Features:</strong>
                    <pre className="text-xs bg-slate-100 p-2 rounded mt-1 overflow-auto">
                      {JSON.stringify(plan.features, null, 2)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {rawResponse && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Raw Response Debug</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-slate-100 p-4 rounded overflow-auto">
                  {JSON.stringify(rawResponse, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
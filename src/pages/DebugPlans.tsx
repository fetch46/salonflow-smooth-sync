import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const DebugPlans = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const fetchPlans = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Debug: Fetching plans...');
      
      // Check authentication
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      setUser(currentUser);
      
      if (userError) {
        console.error('❌ Auth error:', userError);
        setError(`Authentication error: ${userError.message}`);
        return;
      }
      
      console.log('✅ User authenticated:', currentUser?.email);
      
      // Fetch plans
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      console.log('📋 Plans query result:', { data, error });

      if (error) {
        console.error('❌ Plans query error:', error);
        setError(`Database error: ${error.message}`);
        return;
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ No plans found');
        setError('No subscription plans found in database');
        return;
      }

      console.log('✅ Plans loaded:', data);
      setPlans(data);
      toast.success(`Loaded ${data.length} plans successfully`);
      
    } catch (err: any) {
      console.error('❌ Unexpected error:', err);
      setError(`Unexpected error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testRPC = async () => {
    try {
      console.log('🔍 Testing RPC function...');
      const { data, error } = await supabase.rpc('is_super_admin');
      console.log('RPC test result:', { data, error });
      toast.info(`RPC test: ${error ? 'Failed' : 'Success'}`);
    } catch (err: any) {
      console.error('RPC test error:', err);
      toast.error(`RPC test failed: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">🔧 Debug: Subscription Plans</h1>
          <p className="text-slate-600 mt-2">Testing subscription plans loading and display</p>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="font-medium text-blue-900">Authentication</div>
                <div className="text-sm text-blue-700">
                  {user ? `✅ ${user.email}` : '❌ Not authenticated'}
                </div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="font-medium text-green-900">Plans Found</div>
                <div className="text-sm text-green-700">
                  {plans.length} plan(s) loaded
                </div>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg">
                <div className="font-medium text-amber-900">Status</div>
                <div className="text-sm text-amber-700">
                  {loading ? '🔄 Loading...' : error ? '❌ Error' : '✅ Ready'}
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={fetchPlans} disabled={loading}>
                {loading ? 'Loading...' : '🔄 Refresh Plans'}
              </Button>
              <Button variant="outline" onClick={testRPC}>
                🧪 Test RPC
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-800">❌ Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Plans Display */}
        {plans.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Subscription Plans ({plans.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => (
                  <div key={plan.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">{plan.name}</h3>
                      <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                        {plan.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600">{plan.description}</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Monthly:</span>
                        <span className="font-medium">${(plan.price_monthly / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Yearly:</span>
                        <span className="font-medium">${(plan.price_yearly / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Max Users:</span>
                        <span className="font-medium">{plan.max_users}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Max Locations:</span>
                        <span className="font-medium">{plan.max_locations}</span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      ID: {plan.id}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Raw Data */}
        {plans.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Raw Data</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-slate-100 p-4 rounded-lg text-xs overflow-auto">
                {JSON.stringify(plans, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DebugPlans;
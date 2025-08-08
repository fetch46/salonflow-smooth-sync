import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSaas } from '@/lib/saas/context';
import { Check, X, Loader2, Database, User, Shield, Settings } from 'lucide-react';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  details?: any;
}

export default function DebugDatabase() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const { user } = useSaas();

  const runTest = async (testName: string, testFn: () => Promise<any>): Promise<TestResult> => {
    try {
      const result = await testFn();
      return {
        name: testName,
        status: 'success',
        message: 'Test passed',
        details: result
      };
    } catch (error: any) {
      return {
        name: testName,
        status: 'error',
        message: error.message || 'Test failed',
        details: error
      };
    }
  };

  const runFullTestSuite = async () => {
    setRunning(true);
    setTestResults([]);

    const tests: TestResult[] = [];

    // Test 1: User Authentication
    tests.push(await runTest('User Authentication', async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!user) throw new Error('No user authenticated');
      return { userId: user.id, email: user.email };
    }));

    // Test 2: Subscription Plans Access
    tests.push(await runTest('Subscription Plans Access', async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, slug, is_active')
        .eq('is_active', true);
      if (error) throw error;
      return { count: data?.length || 0, plans: data };
    }));

    // Test 3: Organizations Table Access
    tests.push(await runTest('Organizations Table Access', async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .limit(1);
      if (error) throw error;
      return { count: data?.length || 0 };
    }));

    // Test 4: Organization Users Table Access
    tests.push(await runTest('Organization Users Table Access', async () => {
      const { data, error } = await supabase
        .from('organization_users')
        .select('organization_id, user_id, role')
        .limit(1);
      if (error) throw error;
      return { count: data?.length || 0 };
    }));

    // Test 5: RPC Function Test
    tests.push(await runTest('RPC Function Test', async () => {
      const { error } = await supabase.rpc('create_organization_with_user', {
        org_name: 'test-org',
        org_slug: 'test-org-slug',
        org_settings: {},
        plan_id: null
      });
      // We expect this to fail with authentication error, which means the function exists
      if (error && error.message.includes('User must be authenticated')) {
        return { message: 'Function exists and working correctly' };
      }
      if (error && error.message.includes('function create_organization_with_user does not exist')) {
        throw new Error('Function does not exist');
      }
      throw error;
    }));

    // Test 6: Organization Creation Test (with fallback)
    tests.push(await runTest('Organization Creation Test', async () => {
      const testOrgName = `test-org-${Date.now()}`;
      const testOrgSlug = `test-org-${Date.now()}`;
      
      // Try RPC first
      const { data: orgId, error: rpcError } = await supabase.rpc('create_organization_with_user', {
        org_name: testOrgName,
        org_slug: testOrgSlug,
        org_settings: {},
        plan_id: null
      });

      if (rpcError && !rpcError.message.includes('User must be authenticated')) {
        // Try fallback method
        const { data: org, error: insertError } = await supabase
          .from('organizations')
          .insert({
            name: testOrgName,
            slug: testOrgSlug,
            settings: {}
          })
          .select('id')
          .single();

        if (insertError) throw insertError;

        // Add user to organization
        const { error: userError } = await supabase
          .from('organization_users')
          .insert({
            organization_id: org.id,
            user_id: user?.id,
            role: 'owner',
            is_active: true
          });

        if (userError) throw userError;

        // Clean up test organization
        await supabase.from('organization_users').delete().eq('organization_id', org.id);
        await supabase.from('organizations').delete().eq('id', org.id);

        return { method: 'fallback', orgId: org.id };
      }

      if (orgId) {
        // Clean up test organization
        await supabase.from('organization_users').delete().eq('organization_id', orgId);
        await supabase.from('organizations').delete().eq('id', orgId);
        return { method: 'rpc', orgId };
      }

      throw new Error('No organization ID returned');
    }));

    setTestResults(tests);
    setRunning(false);

    const successCount = tests.filter(t => t.status === 'success').length;
    const errorCount = tests.filter(t => t.status === 'error').length;

    if (errorCount === 0) {
      toast.success(`All ${successCount} tests passed! Organization creation should work.`);
    } else {
      toast.error(`${errorCount} tests failed. Check results below.`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <Check className="w-4 h-4 text-green-500" />;
      case 'error': return <X className="w-4 h-4 text-red-500" />;
      default: return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success': return <Badge className="bg-green-100 text-green-800">Passed</Badge>;
      case 'error': return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      default: return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-slate-900">Database Debug Tool</h1>
          <p className="text-slate-600">Comprehensive testing for organization creation issues</p>
        </div>

        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Current User
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user ? (
              <div className="space-y-2">
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>ID:</strong> {user.id}</p>
                <Badge className="bg-green-100 text-green-800">Authenticated</Badge>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-red-600">No user authenticated</p>
                <Badge className="bg-red-100 text-red-800">Not Authenticated</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Test Controls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={runFullTestSuite} 
              disabled={running}
              className="w-full"
            >
              {running ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Run Full Test Suite
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Test Results */}
        {testResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Test Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {testResults.map((test, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(test.status)}
                        <span className="font-medium">{test.name}</span>
                      </div>
                      {getStatusBadge(test.status)}
                    </div>
                    <p className="text-sm text-slate-600">{test.message}</p>
                    {test.details && (
                      <details className="mt-2">
                        <summary className="text-sm text-slate-500 cursor-pointer">View Details</summary>
                        <pre className="text-xs bg-slate-100 p-2 rounded mt-1 overflow-auto">
                          {JSON.stringify(test.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <p><strong>1.</strong> Click "Run Full Test Suite" to test all database connections</p>
              <p><strong>2.</strong> Check the results - all tests should show "Passed"</p>
              <p><strong>3.</strong> If any tests fail, the error details will help identify the issue</p>
              <p><strong>4.</strong> Common fixes:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Run the emergency database script if RPC function is missing</li>
                <li>Check Supabase project status if connection fails</li>
                <li>Verify environment variables are correct</li>
                <li>Ensure user is properly authenticated</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
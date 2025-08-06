import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSaas } from '@/contexts/SaasContext';
import { AlertTriangle, CheckCircle, Database, User, Shield, Zap } from 'lucide-react';

export default function DatabaseTest() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [testOrgName, setTestOrgName] = useState('Test Organization ' + Date.now());
  const { user } = useSaas();

  const addResult = (test: string, success: boolean, message: string, details?: any) => {
    setResults(prev => [...prev, { test, success, message, details, timestamp: new Date() }]);
  };

  const clearResults = () => {
    setResults([]);
  };

  const runDatabaseTests = async () => {
    try {
      setLoading(true);
      clearResults();

      // Test 1: Check user authentication
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        addResult('User Authentication', true, `Authenticated as ${currentUser.email}`, currentUser);
      } else {
        addResult('User Authentication', false, 'Not authenticated');
        return;
      }

      // Test 2: Check if we can read subscription plans
      try {
        const { data: plans, error: plansError } = await supabase
          .from('subscription_plans')
          .select('*')
          .limit(1);

        if (plansError) {
          addResult('Read Subscription Plans', false, `Error: ${plansError.message}`, plansError);
        } else {
          addResult('Read Subscription Plans', true, `Found ${plans?.length || 0} plans`, plans);
        }
      } catch (err: any) {
        addResult('Read Subscription Plans', false, `Exception: ${err.message}`, err);
      }

      // Test 3: Check if we can read organizations
      try {
        const { data: orgs, error: orgsError } = await supabase
          .from('organizations')
          .select('*')
          .limit(5);

        if (orgsError) {
          addResult('Read Organizations', false, `Error: ${orgsError.message}`, orgsError);
        } else {
          addResult('Read Organizations', true, `Found ${orgs?.length || 0} organizations`, orgs);
        }
      } catch (err: any) {
        addResult('Read Organizations', false, `Exception: ${err.message}`, err);
      }

      // Test 4: Test creating organization using old method (should fail)
      try {
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .insert([{
            name: 'Test Org Direct Insert',
            slug: 'test-org-direct-' + Date.now(),
          }])
          .select()
          .single();

        if (orgError) {
          addResult('Direct Organization Insert', false, `RLS working - blocked insert: ${orgError.message}`, orgError);
        } else {
          addResult('Direct Organization Insert', true, 'Direct insert worked (unexpected)', orgData);
          
          // Clean up if it worked
          await supabase.from('organizations').delete().eq('id', orgData.id);
        }
      } catch (err: any) {
        addResult('Direct Organization Insert', false, `Exception: ${err.message}`, err);
      }

      // Test 5: Test creating organization using safe function
      try {
        const { data: orgId, error: funcError } = await supabase.rpc('create_organization_with_user', {
          org_name: testOrgName,
          org_slug: 'test-org-' + Date.now(),
          org_settings: { test: true }
        });

        if (funcError) {
          addResult('Safe Organization Creation', false, `Function error: ${funcError.message}`, funcError);
        } else {
          addResult('Safe Organization Creation', true, `Created organization with ID: ${orgId}`, { orgId });
          
          // Test 6: Verify we can read the organization we just created
          const { data: newOrg, error: readError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', orgId)
            .single();

          if (readError) {
            addResult('Read Created Organization', false, `Can't read created org: ${readError.message}`, readError);
          } else {
            addResult('Read Created Organization', true, `Successfully read created org: ${newOrg.name}`, newOrg);
          }

          // Test 7: Test creating a client for the organization
          try {
            const { data: clientData, error: clientError } = await supabase
              .from('clients')
              .insert([{
                organization_id: orgId,
                first_name: 'Test',
                last_name: 'Client',
                email: 'test@example.com',
              }])
              .select()
              .single();

            if (clientError) {
              addResult('Create Client', false, `Can't create client: ${clientError.message}`, clientError);
            } else {
              addResult('Create Client', true, `Created client: ${clientData.first_name} ${clientData.last_name}`, clientData);
            }
          } catch (err: any) {
            addResult('Create Client', false, `Client creation exception: ${err.message}`, err);
          }

          // Test 8: Test creating a staff member
          try {
            const { data: staffData, error: staffError } = await supabase
              .from('staff')
              .insert([{
                organization_id: orgId,
                first_name: 'Test',
                last_name: 'Staff',
                email: 'staff@example.com',
                role: 'stylist',
              }])
              .select()
              .single();

            if (staffError) {
              addResult('Create Staff', false, `Can't create staff: ${staffError.message}`, staffError);
            } else {
              addResult('Create Staff', true, `Created staff: ${staffData.first_name} ${staffData.last_name}`, staffData);
            }
          } catch (err: any) {
            addResult('Create Staff', false, `Staff creation exception: ${err.message}`, err);
          }
        }
      } catch (err: any) {
        addResult('Safe Organization Creation', false, `Function exception: ${err.message}`, err);
      }

      // Test 9: Check RLS policies exist
      try {
        const { data: policies, error: policiesError } = await supabase
          .from('pg_policies')
          .select('tablename, policyname, cmd')
          .in('tablename', ['organizations', 'organization_users', 'clients', 'staff']);

        if (policiesError) {
          addResult('Check RLS Policies', false, `Can't read policies: ${policiesError.message}`, policiesError);
        } else {
          addResult('Check RLS Policies', true, `Found ${policies?.length || 0} RLS policies`, policies);
        }
      } catch (err: any) {
        addResult('Check RLS Policies', false, `Policy check exception: ${err.message}`, err);
      }

    } catch (error: any) {
      addResult('Database Tests', false, `Overall test failure: ${error.message}`, error);
    } finally {
      setLoading(false);
    }
  };

  const testSpecificTable = async (tableName: string) => {
    if (!user) {
      toast.error('Must be logged in to test');
      return;
    }

    try {
      setLoading(true);
      
      // Try to read from the table
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(5);

      if (error) {
        addResult(`Read ${tableName}`, false, `Error: ${error.message}`, error);
      } else {
        addResult(`Read ${tableName}`, true, `Found ${data?.length || 0} records`, data);
      }
    } catch (err: any) {
      addResult(`Read ${tableName}`, false, `Exception: ${err.message}`, err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">Database Connectivity Test</h1>
        <p className="text-slate-600">Test database writes, RLS policies, and permissions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Database Tests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="orgName">Test Organization Name</Label>
              <Input
                id="orgName"
                value={testOrgName}
                onChange={(e) => setTestOrgName(e.target.value)}
                placeholder="Test Organization Name"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={runDatabaseTests} disabled={loading}>
                {loading ? 'Running Tests...' : 'Run Full Test Suite'}
              </Button>
              <Button variant="outline" onClick={clearResults}>
                Clear Results
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Test Individual Tables:</h4>
              <div className="flex flex-wrap gap-2">
                {['organizations', 'clients', 'staff', 'services', 'appointments'].map(table => (
                  <Button
                    key={table}
                    variant="outline"
                    size="sm"
                    onClick={() => testSpecificTable(table)}
                    disabled={loading}
                  >
                    {table}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Current User
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              <strong>Email:</strong> {user?.email || 'Not logged in'}
            </div>
            <div className="text-sm">
              <strong>User ID:</strong> {user?.id || 'None'}
            </div>
            <div className="text-sm">
              <strong>Status:</strong> 
              <Badge variant={user ? 'default' : 'destructive'} className="ml-2">
                {user ? 'Authenticated' : 'Not authenticated'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Test Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Test Results ({results.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="text-slate-600 text-center py-8">
              No tests run yet. Click "Run Full Test Suite" to start.
            </p>
          ) : (
            <div className="space-y-3">
              {results.map((result, index) => (
                <Alert key={index} variant={result.success ? 'default' : 'destructive'}>
                  <div className="flex items-start gap-3">
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <strong>{result.test}</strong>
                        <Badge variant={result.success ? 'default' : 'destructive'}>
                          {result.success ? 'PASS' : 'FAIL'}
                        </Badge>
                      </div>
                      <AlertDescription className="mt-1">
                        {result.message}
                      </AlertDescription>
                      {result.details && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-slate-600">
                            View details
                          </summary>
                          <pre className="text-xs bg-slate-100 p-2 rounded mt-1 overflow-auto">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
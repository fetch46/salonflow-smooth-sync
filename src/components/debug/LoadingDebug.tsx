import React from 'react';
import { useSaas } from '@/contexts/SaasContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function LoadingDebug() {
  const { 
    user, 
    loading, 
    organization, 
    organizations, 
    organizationRole, 
    isSuperAdmin,
    subscription,
    subscriptionPlan 
  } = useSaas();

  const clearLocalStorage = () => {
    localStorage.clear();
    window.location.reload();
  };

  const forceLogout = async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔍 Loading Debug
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Authentication State</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <strong>Loading:</strong> 
                  <Badge variant={loading ? "destructive" : "default"} className="ml-2">
                    {loading ? "Yes" : "No"}
                  </Badge>
                </div>
                <div>
                  <strong>User:</strong> {user?.email || 'Not logged in'}
                </div>
                <div>
                  <strong>User ID:</strong> {user?.id || 'N/A'}
                </div>
                <div>
                  <strong>Super Admin:</strong> 
                  <Badge variant={isSuperAdmin ? "default" : "secondary"} className="ml-2">
                    {isSuperAdmin ? "Yes" : "No"}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Organization State</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <strong>Organizations Count:</strong> {organizations.length}
                </div>
                <div>
                  <strong>Active Organization:</strong> {organization?.name || 'None'}
                </div>
                <div>
                  <strong>Organization Role:</strong> {organizationRole || 'None'}
                </div>
                <div>
                  <strong>Subscription:</strong> {subscription?.status || 'None'}
                </div>
                <div>
                  <strong>Plan:</strong> {subscriptionPlan?.name || 'None'}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Organizations List</h3>
            {organizations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No organizations found</p>
            ) : (
              <div className="space-y-2">
                {organizations.map((org) => (
                  <div key={org.id} className="text-sm p-2 bg-slate-50 rounded">
                    <strong>{org.name}</strong> ({org.slug}) - {org.status}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={clearLocalStorage} variant="outline">
              Clear Local Storage & Reload
            </Button>
            <Button onClick={forceLogout} variant="destructive">
              Force Logout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
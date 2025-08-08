import React from 'react';
import { useSaas } from '@/lib/saas/context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function TestDashboard() {
  const { user, organization, subscriptionPlan, loading } = useSaas();

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Test Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">SaasContext State:</h3>
            <div className="space-y-2 text-sm">
              <div><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</div>
              <div><strong>User:</strong> {user?.email || 'Not logged in'}</div>
              <div><strong>Organization:</strong> {organization?.name || 'None'}</div>
              <div><strong>Plan:</strong> {subscriptionPlan?.name || 'None'}</div>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Actions:</h3>
            <div className="space-x-2">
              <Button onClick={() => window.location.reload()}>
                Reload Page
              </Button>
              
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
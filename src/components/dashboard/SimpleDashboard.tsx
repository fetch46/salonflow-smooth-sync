
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSaas } from "@/lib/saas";

const SimpleDashboard = () => {
  const { organization, user, systemSettings } = useSaas();
  const appName = (systemSettings as Record<string, any>)?.app_name || 'AURA OS';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome to {organization?.name || appName}
        </h1>
        <p className="text-gray-600 mt-2">
          Hello {user?.email}, your dashboard is loading...
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Welcome to your business management dashboard. 
              Your application is successfully connected and ready to use.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Database</span>
                <span className="text-green-600 font-semibold">Connected</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Authentication</span>
                <span className="text-green-600 font-semibold">Active</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Explore the sidebar to access all features:
              </p>
              <ul className="text-sm text-gray-600 list-disc list-inside">
                <li>Manage clients and appointments</li>
                <li>Track inventory and services</li>
                <li>View reports and analytics</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SimpleDashboard;

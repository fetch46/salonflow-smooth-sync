import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, Building, CreditCard, Database, TrendingUp, Activity,
  Calendar, Package, ShoppingCart, DollarSign, FileText, Briefcase,
  AlertCircle, CheckCircle, Clock, ArrowUp, ArrowDown
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { Link } from "react-router-dom";

interface SystemStats {
  organizations: {
    total: number;
    active: number;
    trial: number;
    recent: number;
  };
  users: {
    total: number;
    recent: number;
    confirmed: number;
  };
  subscriptions: {
    active: number;
    trial: number;
    canceled: number;
    revenue: number;
  };
  businessData: {
    [key: string]: {
      total: number;
      recent: number;
      growth: number;
    };
  };
}

interface RecentActivity {
  type: string;
  description: string;
  timestamp: string;
  organization?: string;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<SystemStats>({
    organizations: { total: 0, active: 0, trial: 0, recent: 0 },
    users: { total: 0, recent: 0, confirmed: 0 },
    subscriptions: { active: 0, trial: 0, canceled: 0, revenue: 0 },
    businessData: {}
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const businessTables = useMemo(() => [
    { name: 'clients', label: 'Clients', icon: Users, color: 'text-blue-600' },
    { name: 'staff', label: 'Staff', icon: Users, color: 'text-green-600' },
    { name: 'services', label: 'Services', icon: Briefcase, color: 'text-amber-600' },
    { name: 'appointments', label: 'Appointments', icon: Calendar, color: 'text-orange-600' },
    { name: 'inventory_items', label: 'Inventory', icon: Package, color: 'text-indigo-600' },
    { name: 'sales', label: 'Sales', icon: ShoppingCart, color: 'text-emerald-600' },

    { name: 'expenses', label: 'Expenses', icon: DollarSign, color: 'text-yellow-600' }
  ], []);

 
   const fetchSystemStats = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get organizations stats
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('status, created_at');

      if (orgsError) throw orgsError;

      const orgStats = {
        total: orgs?.length || 0,
        active: orgs?.filter(o => o.status === 'active').length || 0,
        trial: 0, // Will get from subscriptions
        recent: orgs?.filter(o => 
          new Date(o.created_at) > subDays(new Date(), 7)
        ).length || 0
      };

      // Get subscriptions stats
      const { data: subs, error: subsError } = await supabase
        .from('organization_subscriptions')
        .select(`
          status,
          subscription_plans(price_monthly)
        `);

      if (subsError) throw subsError;

      const subStats = {
        active: subs?.filter(s => s.status === 'active').length || 0,
        trial: subs?.filter(s => s.status === 'trial').length || 0,
        canceled: subs?.filter(s => s.status === 'canceled').length || 0,
        revenue: (subs as any[])?.reduce((total, sub) => {
          const plan = Array.isArray(sub.subscription_plans) ? sub.subscription_plans[0] : sub.subscription_plans;
          const price = plan?.price_monthly ?? 0;
          if (sub.status === 'active' && typeof price === 'number') {
            return total + price;
          }
          return total;
        }, 0) || 0
      };

      orgStats.trial = subStats.trial;

      // Get users stats - try to get from auth admin API
      let userStats = { total: 0, recent: 0, confirmed: 0 };
      try {
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
        
        const users = (authUsers as any)?.users as any[] | undefined;
        if (!authError && users) {
          userStats = {
            total: users.length,
            recent: users.filter(u => 
              u?.created_at && new Date(u.created_at) > subDays(new Date(), 7)
            ).length,
            confirmed: users.filter(u => u?.email_confirmed_at).length
          };
        }
      } catch (error) {
        // Fallback to profiles table if admin API is not available
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('created_at, email_confirmed_at');

        if (!profilesError && profiles) {
          userStats = {
            total: profiles.length,
            recent: profiles.filter(p => 
              new Date(p.created_at) > subDays(new Date(), 7)
            ).length,
            confirmed: profiles.filter((p: any) => !!p.email_confirmed_at).length
          };
        }
      }

      // Get business data stats
      const businessData: any = {};
      
      for (const table of businessTables) {
        try {
          // Get total count
          const { count: total, error: totalError } = await supabase
            .from(table.name as any)
            .select('*', { count: 'exact', head: true });

          if (totalError) throw totalError;

          // Get recent count (last 7 days)
          const { count: recent, error: recentError } = await supabase
            .from(table.name as any)
            .select('*', { count: 'exact', head: true })
            .gte('created_at', subDays(new Date(), 7).toISOString());

          if (recentError) throw recentError;

          // Get previous period count for growth calculation
          const { count: previousPeriod, error: prevError } = await supabase
            .from(table.name as any)
            .select('*', { count: 'exact', head: true })
            .gte('created_at', subDays(new Date(), 14).toISOString())
            .lt('created_at', subDays(new Date(), 7).toISOString());

          if (prevError) throw prevError;

          const growth = previousPeriod > 0 
            ? ((recent - previousPeriod) / previousPeriod) * 100 
            : recent > 0 ? 100 : 0;

          businessData[table.name] = {
            total: total || 0,
            recent: recent || 0,
            growth: Number(growth.toFixed(1))
          };
        } catch (error) {
          console.error(`Error fetching stats for ${table.name}:`, error);
          businessData[table.name] = { total: 0, recent: 0, growth: 0 };
        }
      }

      setStats({
        organizations: orgStats,
        users: userStats,
        subscriptions: subStats,
        businessData
      });

    } catch (error) {
      console.error('Error fetching system stats:', error);
    } finally {
      setLoading(false);
    }
  }, [businessTables]);

  const fetchRecentActivity = useCallback(async () => {
    try {
      const activities: RecentActivity[] = [];

      // Get recent organizations
      const { data: recentOrgs } = await supabase
        .from('organizations')
        .select('name, created_at')
        .gte('created_at', subDays(new Date(), 7).toISOString())
        .order('created_at', { ascending: false })
        .limit(5);

      recentOrgs?.forEach(org => {
        activities.push({
          type: 'organization',
          description: `New organization "${org.name}" created`,
          timestamp: org.created_at,
          organization: org.name
        });
      });

      // Get recent subscriptions
      const { data: recentSubs } = await supabase
        .from('organization_subscriptions')
        .select(`
          status,
          created_at,
          organizations(name),
          subscription_plans(name)
        `)
        .gte('created_at', subDays(new Date(), 7).toISOString())
        .order('created_at', { ascending: false })
        .limit(5);

      recentSubs?.forEach((sub: any) => {
        const org = Array.isArray(sub.organizations) ? sub.organizations[0] : sub.organizations;
        const plan = Array.isArray(sub.subscription_plans) ? sub.subscription_plans[0] : sub.subscription_plans;
        activities.push({
          type: 'subscription',
          description: `${org?.name ?? 'Organization'} subscribed to ${plan?.name ?? 'a plan'}`,
          timestamp: sub.created_at,
          organization: org?.name
        });
      });

      // Sort all activities by timestamp
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setRecentActivity(activities.slice(0, 10));
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    }
  }, []);

  useEffect(() => {
    fetchSystemStats();
    fetchRecentActivity();
  }, [fetchSystemStats, fetchRecentActivity]);

  const { formatAmount } = useOrganizationCurrency();
  const formatCurrency = (cents: number) => formatAmount(cents / 100);

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) return <ArrowUp className="h-4 w-4 text-green-600" />;
    if (growth < 0) return <ArrowDown className="h-4 w-4 text-red-600" />;
    return <Clock className="h-4 w-4 text-gray-400" />;
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return "text-green-600";
    if (growth < 0) return "text-red-600";
    return "text-gray-500";
  };

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">System overview and key metrics</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link to="/admin/organizations">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 dark:from-blue-950 dark:to-blue-900 dark:border-blue-800 hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">Organizations</CardTitle>
                <Building className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-200">
                  {loading ? '...' : stats.organizations.total.toLocaleString()}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    +{stats.organizations.recent} this week
                  </span>
                  <Badge variant="outline" className="text-xs bg-blue-100/60 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800">
                    {stats.organizations.active} active
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/admin/users">
            <Card className="bg-gradient-to-br from-emerald-50 to-green-100 border-emerald-200 dark:from-emerald-950 dark:to-emerald-900 dark:border-emerald-800 hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Users</CardTitle>
                <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-200">
                  {loading ? '...' : stats.users.total.toLocaleString()}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">
                    +{stats.users.recent} this week
                  </span>
                  <Badge variant="outline" className="text-xs bg-emerald-100/60 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800">
                    {stats.users.confirmed} confirmed
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/admin/subscription-plans">
            <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-amber-200 dark:from-amber-900 dark:to-yellow-900 dark:border-amber-800 hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-amber-700 dark:text-yellow-300">Subscriptions</CardTitle>
                <CreditCard className="h-4 w-4 text-amber-600 dark:text-yellow-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-700 dark:text-yellow-200">
                  {loading ? '...' : stats.subscriptions.active.toLocaleString()}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-amber-600 dark:text-yellow-400">
                    {stats.subscriptions.trial} trial
                  </span>
                  <Badge variant="outline" className="text-xs bg-amber-100/60 text-amber-800 border-amber-200 dark:bg-yellow-900/40 dark:text-yellow-200 dark:border-yellow-800">
                    {formatCurrency(stats.subscriptions.revenue)}/mo
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/admin/business-data">
            <Card className="bg-gradient-to-br from-indigo-50 to-blue-100 border-indigo-200 dark:from-indigo-950 dark:to-indigo-900 dark:border-indigo-800 hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Business Data</CardTitle>
                <Database className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-200">
                  {loading ? '...' : Object.values(stats.businessData)
                    .reduce((sum, data) => sum + data.total, 0)
                    .toLocaleString()}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-indigo-600 dark:text-indigo-400">
                    +{Object.values(stats.businessData)
                      .reduce((sum, data) => sum + data.recent, 0)} this week
                  </span>
                  <Badge variant="outline" className="text-xs bg-indigo-100/60 text-indigo-800 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-800">
                    All records
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Business Data Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Data Overview</CardTitle>
              <CardDescription>
                Records across all business tables
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {businessTables.map((table) => {
                  const data = stats.businessData[table.name];
                  const Icon = table.icon;
                  
                  return (
                    <div key={table.name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Icon className={`h-5 w-5 ${table.color}`} />
                        <div>
                          <p className="text-sm font-medium">{table.label}</p>
                          <p className="text-xs text-gray-500">
                            +{data?.recent || 0} this week
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-lg font-semibold">
                          {(data?.total || 0).toLocaleString()}
                        </span>
                        <div className="flex items-center space-x-1">
                          {getGrowthIcon(data?.growth || 0)}
                          <span className={`text-xs ${getGrowthColor(data?.growth || 0)}`}>
                            {Math.abs(data?.growth || 0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest system activity and changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="mt-1">
                        {activity.type === 'organization' && (
                          <Building className="h-4 w-4 text-blue-600" />
                        )}
                        {activity.type === 'subscription' && (
                          <CreditCard className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium">
                          {activity.description}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(activity.timestamp), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <Activity className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No recent activity</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>
              Current system health and status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Database</p>
                  <p className="text-xs text-gray-500">Operational</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Authentication</p>
                  <p className="text-xs text-gray-500">Operational</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm font-medium">API Services</p>
                  <p className="text-xs text-gray-500">Operational</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
};

export default AdminDashboard;
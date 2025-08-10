import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format, subDays } from "date-fns";
import { Activity, Building, CreditCard, Search } from "lucide-react";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";

interface ActivityItem {
  type: "organization" | "subscription" | "user" | "other";
  description: string;
  timestamp: string;
  organization?: string | null;
}

export default function AdminActivity() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [search, setSearch] = useState("");
  const [rangeDays, setRangeDays] = useState<number>(14);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchActivity = useCallback(async () => {
    try {
      setLoading(true);
      const since = subDays(new Date(), rangeDays).toISOString();
      const activities: ActivityItem[] = [];

      const [{ data: recentOrgs }, { data: recentSubs }] = await Promise.all([
        supabase
          .from("organizations")
          .select("name, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("organization_subscriptions")
          .select(`
            status,
            created_at,
            organizations(name),
            subscription_plans(name)
          `)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      (recentOrgs || []).forEach((org) => {
        activities.push({
          type: "organization",
          description: `New organization "${org.name}" created`,
          timestamp: org.created_at,
          organization: org.name,
        });
      });

      (recentSubs || []).forEach((sub: any) => {
        const org = Array.isArray(sub.organizations) ? sub.organizations[0] : sub.organizations;
        const plan = Array.isArray(sub.subscription_plans) ? sub.subscription_plans[0] : sub.subscription_plans;
        activities.push({
          type: "subscription",
          description: `${org?.name ?? "Organization"} subscribed to ${plan?.name ?? "a plan"} (${sub.status})`,
          timestamp: sub.created_at,
          organization: org?.name ?? null,
        });
      });

      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setItems(activities);
    } catch (error) {
      console.error("Error fetching activity:", error);
    } finally {
      setLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const filtered = items.filter((i) => {
    const hay = `${i.type} ${i.description} ${i.organization ?? ""}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Activity Logs</h1>
            <p className="text-gray-500 mt-1">Recent system activity across organizations and subscriptions</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search activity..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 w-72"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Range:</span>
              <select
                value={rangeDays}
                onChange={(e) => setRangeDays(Number(e.target.value))}
                className="p-2 border rounded-md"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
              </select>
              <Button variant="outline" onClick={fetchActivity}>Refresh</Button>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest events and changes</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-6 text-gray-500">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No recent activity</div>
            ) : (
              <div className="divide-y">
                {filtered.map((a, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-4 hover:bg-muted/50">
                    <div className="mt-1">
                      {a.type === "organization" ? (
                        <Building className="h-5 w-5 text-blue-600" />
                      ) : a.type === "subscription" ? (
                        <CreditCard className="h-5 w-5 text-green-600" />
                      ) : (
                        <Activity className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{a.description}</p>
                        {a.organization && <Badge variant="outline">{a.organization}</Badge>}
                      </div>
                      <p className="text-xs text-gray-500">{format(new Date(a.timestamp), "MMM dd, yyyy HH:mm")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
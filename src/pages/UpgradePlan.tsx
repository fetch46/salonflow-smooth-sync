import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSaas } from "@/lib/saas";
import { useEffect, useState } from "react";
import { SubscriptionService } from "@/lib/saas/services";
import { useOrganizationCurrency } from "@/lib/saas/hooks";

export default function UpgradePlan() {
  const navigate = useNavigate();
  const { organization } = useSaas();
  const [plans, setPlans] = useState<any[]>([])
  const { formatUsdCents } = useOrganizationCurrency()
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      setPlans(data || [])
    })()
  }, [])

  const handleSelect = async (planId: string) => {
    if (!organization) return
    try {
      setSaving(planId)
      await SubscriptionService.updateSubscription(organization.id, planId)
      navigate('/settings')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upgrade Plan</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div key={p.id} className="border rounded-md p-4 space-y-3">
              <div className="text-lg font-semibold capitalize">{p.name}</div>
              <div className="text-sm text-muted-foreground">{p.slug}</div>
                             <div className="text-xl font-bold">{formatUsdCents(p.price_monthly)}/mo</div>
              <Button variant="outline" disabled={!!saving} onClick={() => handleSelect(p.id)}>{saving === p.id ? 'Saving...' : 'Select'}</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
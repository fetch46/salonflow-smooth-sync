import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PLAN_FEATURES } from "@/lib/features";
import { useNavigate } from "react-router-dom";

export default function UpgradePlan() {
  const navigate = useNavigate();
  const plans = Object.keys(PLAN_FEATURES);
  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upgrade Plan</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div key={p} className="border rounded-md p-4 space-y-3">
              <div className="text-lg font-semibold capitalize">{p}</div>
              <ul className="text-sm list-disc pl-4">
                {Object.entries(PLAN_FEATURES[p as keyof typeof PLAN_FEATURES]).slice(0,6).map(([k,v]) => (
                  <li key={k}>{k.replaceAll('_',' ')} {v.enabled ? '' : '(disabled)'}</li>
                ))}
              </ul>
              <Button variant="outline" onClick={() => navigate('/settings')}>Select</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
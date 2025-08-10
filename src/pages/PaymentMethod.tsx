import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useSaas } from "@/lib/saas";
import { useEffect, useState } from "react";

export default function PaymentMethod() {
  const { organization } = useSaas();
  const [method, setMethod] = useState<any | null>(null)

  useEffect(() => {
    (async () => {
      if (!organization) return
      const { data } = await supabase
        .from('organization_payment_methods')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setMethod(data || null)
    })()
  }, [organization])

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Update Payment Method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {method && (
            <div className="text-sm text-muted-foreground">
              Current: {method.provider} {method.brand || ''} {method.last4 ? `•••• ${method.last4}` : ''}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm">Card Holder Name</label>
              <Input placeholder="Jane Doe" />
            </div>
            <div>
              <label className="text-sm">Card Number</label>
              <Input placeholder="4242 4242 4242 4242" />
            </div>
            <div>
              <label className="text-sm">Expiry</label>
              <Input placeholder="MM/YY" />
            </div>
            <div>
              <label className="text-sm">CVC</label>
              <Input placeholder="123" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button disabled>Save (Coming soon)</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
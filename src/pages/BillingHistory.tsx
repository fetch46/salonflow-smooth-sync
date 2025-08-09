import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { supabase } from "@/integrations/supabase/client";
import { useSaas } from "@/lib/saas/context";
import { useEffect, useState } from "react";

export default function BillingHistory() {
  const { symbol } = useOrganizationCurrency();
  const { organization } = useSaas();
  const [rows, setRows] = useState<any[]>([])

  useEffect(() => {
    (async () => {
      if (!organization) return
      const { data } = await supabase
        .from('billing_history')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
      setRows(data || [])
    })()
  }, [organization])

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>{r.description}</TableCell>
                  <TableCell className="text-right">{symbol}{Number(r.amount).toFixed(2)}</TableCell>
                  <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
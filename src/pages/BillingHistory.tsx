import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useOrganizationCurrency } from "@/lib/saas/hooks";

export default function BillingHistory() {
  const { symbol } = useOrganizationCurrency();
  const rows = [
    { id: "1", date: "2025-01-01", description: "Monthly subscription", amount: 49.99, status: "Paid" },
    { id: "2", date: "2024-12-01", description: "Monthly subscription", amount: 49.99, status: "Paid" },
  ];
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
                  <TableCell>{r.date}</TableCell>
                  <TableCell>{r.description}</TableCell>
                  <TableCell className="text-right">{symbol}{r.amount.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MpesaPaymentButton } from "@/components/payments/MpesaPaymentButton";
import { useMpesaPayments } from "@/hooks/useMpesaPayments";
import { useSaas } from "@/lib/saas/context";
import { format } from "date-fns";
import { Smartphone, Search, RefreshCw } from "lucide-react";

export default function MpesaPayments() {
  const { organization } = useSaas();
  const { payments, loading, fetchPayments } = useMpesaPayments(organization?.id);
  const [searchTerm, setSearchTerm] = useState("");

  // Test payment form state
  const [testAmount, setTestAmount] = useState("100");
  const [testPhone, setTestPhone] = useState("");
  const [testDescription, setTestDescription] = useState("Test Payment");

  useEffect(() => {
    if (organization?.id) {
      fetchPayments();
    }
  }, [organization?.id, fetchPayments]);

  const filteredPayments = payments.filter(payment => 
    payment.account_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.phone_number.includes(searchTerm) ||
    payment.transaction_desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (payment.mpesa_receipt_number && payment.mpesa_receipt_number.includes(searchTerm))
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  if (!organization) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <p className="text-muted-foreground">Please select an organization to view M-Pesa payments.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <PageHeader 
        title="M-Pesa Payments" 
        subtitle="Manage M-Pesa mobile payments"
        icon={<Smartphone />}
      />

      {/* Test Payment Section */}
      <Card>
        <CardHeader>
          <CardTitle>Test M-Pesa Payment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="testAmount">Amount (KES)</Label>
              <Input
                id="testAmount"
                type="number"
                value={testAmount}
                onChange={(e) => setTestAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <div>
              <Label htmlFor="testDescription">Description</Label>
              <Input
                id="testDescription"
                value={testDescription}
                onChange={(e) => setTestDescription(e.target.value)}
                placeholder="Payment description"
              />
            </div>
            <div>
              <MpesaPaymentButton
                amount={Number(testAmount) || 0}
                organizationId={organization.id}
                accountReference={`TEST-${Date.now()}`}
                transactionDesc={testDescription}
                referenceType="test"
                referenceId={`test-${Date.now()}`}
                onSuccess={(paymentId) => {
                  console.log('Test payment successful:', paymentId);
                  fetchPayments(); // Refresh payments list
                }}
                disabled={!testAmount || Number(testAmount) <= 0}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Payment History</CardTitle>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search payments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button onClick={fetchPayments} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading payments...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No payments found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPayments.map((payment) => (
                <div 
                  key={payment.id} 
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{formatAmount(payment.amount)}</span>
                        <Badge className={getStatusColor(payment.status)}>
                          {payment.status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {payment.transaction_desc}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Phone: {payment.phone_number} • Ref: {payment.account_reference}
                      </p>
                      {payment.mpesa_receipt_number && (
                        <p className="text-xs text-muted-foreground">
                          Receipt: {payment.mpesa_receipt_number}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>{format(new Date(payment.created_at), 'MMM dd, yyyy')}</p>
                      <p>{format(new Date(payment.created_at), 'HH:mm')}</p>
                      {payment.transaction_date && payment.status === 'success' && (
                        <p className="text-xs">
                          Paid: {format(new Date(payment.transaction_date), 'HH:mm')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, DollarSign, Calendar, Receipt } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationCurrency } from "@/lib/saas/hooks";
import { toast } from "@/hooks/use-toast";

interface CommissionSummary {
  total_accrued: number;
  total_paid: number;
  staff_count: number;
  pending_payments: number;
}

export default function Payroll() {
  const navigate = useNavigate();
  const { format: formatCurrency } = useOrganizationCurrency();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CommissionSummary>({
    total_accrued: 0,
    total_paid: 0,
    staff_count: 0,
    pending_payments: 0
  });

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      const { data: commissions, error } = await supabase
        .from('staff_commissions')
        .select(`
          commission_amount,
          status,
          staff_id
        `);

      if (error) throw error;

      const accrued = commissions
        ?.filter(c => c.status === 'accrued')
        ?.reduce((sum, c) => sum + (c.commission_amount || 0), 0) || 0;

      const paid = commissions
        ?.filter(c => c.status === 'paid')
        ?.reduce((sum, c) => sum + (c.commission_amount || 0), 0) || 0;

      const uniqueStaff = new Set(commissions?.map(c => c.staff_id)).size;
      const pending = commissions?.filter(c => c.status === 'accrued')?.length || 0;

      setSummary({
        total_accrued: accrued,
        total_paid: paid,
        staff_count: uniqueStaff,
        pending_payments: pending
      });
    } catch (error) {
      console.error('Error loading payroll summary:', error);
      toast({
        title: "Error",
        description: "Failed to load payroll summary",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payroll Management</h1>
          <p className="text-muted-foreground">Manage staff commissions and payroll</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Accrued</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.total_accrued)}</div>
            <p className="text-xs text-muted-foreground">Unpaid commissions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.total_paid)}</div>
            <p className="text-xs text-muted-foreground">Commissions paid</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staff with Commissions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.staff_count}</div>
            <p className="text-xs text-muted-foreground">Active staff members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.pending_payments}</div>
            <p className="text-xs text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Commission Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Process commission payments for staff members
            </p>
            <Button 
              onClick={() => navigate('/payroll/commissions')}
              className="w-full"
            >
              Manage Commission Payments
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Staff Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              View and manage staff commission rates
            </p>
            <Button 
              onClick={() => navigate('/staff')}
              variant="outline"
              className="w-full"
            >
              View Staff
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Commission Status Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Accrued</Badge>
              <span className="text-muted-foreground">{formatCurrency(summary.total_accrued)} pending payment</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default">Paid</Badge>
              <span className="text-muted-foreground">{formatCurrency(summary.total_paid)} already paid</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
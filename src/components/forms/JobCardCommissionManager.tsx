import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface StaffCommission {
  id: string;
  staff_id: string;
  commission_percentage?: number;
  commission_amount: number;
  status: 'accrued' | 'paid';
  accrued_date?: string;
  paid_date?: string;
  invoice_id?: string;
  invoice_item_id?: string;
  job_card_id?: string;
  payment_reference?: string;
  staff?: {
    full_name: string;
  };
}

interface JobCardCommissionManagerProps {
  jobCardId: string;
}

export const JobCardCommissionManager: React.FC<JobCardCommissionManagerProps> = ({
  jobCardId
}) => {
  const [commissions, setCommissions] = useState<StaffCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

const loadCommissions = async () => {
    try {
      const { data, error } = await supabase
        .from('staff_commissions')
        .select(`
          *,
          staff:staff_id (
            full_name
          )
        `)
        .eq('job_card_id', jobCardId)
        .order('accrued_date', { ascending: false });

      if (error) throw error;
      setCommissions((data as StaffCommission[]) || []);
    } catch (error) {
      console.error('Error loading commissions:', error);
      toast({
        title: "Error",
        description: "Failed to load commission data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const accrueCommission = async (serviceData: any) => {
    if (!serviceData.staff_id || !serviceData.commission_percentage || !serviceData.unit_price) {
      return;
    }

    const commissionAmount = (serviceData.unit_price * serviceData.quantity * serviceData.commission_percentage) / 100;

    try {
      const { error } = await supabase
        .from('staff_commissions')
        .insert({
          staff_id: serviceData.staff_id,
          job_card_id: jobCardId,
          service_id: serviceData.service_id,
          commission_percentage: serviceData.commission_percentage,
          commission_amount: commissionAmount,
          status: 'accrued'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Commission of $${commissionAmount.toFixed(2)} accrued for staff member`,
        variant: "default"
      });

      await loadCommissions();
    } catch (error) {
      console.error('Error accruing commission:', error);
      toast({
        title: "Error",
        description: "Failed to accrue commission",
        variant: "destructive"
      });
    }
  };

  const payCommission = async (commissionId: string) => {
    try {
      const { error } = await supabase.rpc('pay_staff_commission', {
        p_commission_id: commissionId
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Commission payment processed successfully",
        variant: "default"
      });

      await loadCommissions();
    } catch (error) {
      console.error('Error paying commission:', error);
      toast({
        title: "Error",
        description: "Failed to process commission payment",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    loadCommissions();
  }, [jobCardId]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading commissions...</div>;
  }

  const totalAccrued = commissions
    .filter(c => c.status === 'accrued')
    .reduce((sum, c) => sum + c.commission_amount, 0);

  const totalPaid = commissions
    .filter(c => c.status === 'paid')
    .reduce((sum, c) => sum + c.commission_amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          Commission Management
          <div className="flex gap-2">
            <Badge variant="outline">
              Accrued: ${totalAccrued.toFixed(2)}
            </Badge>
            <Badge variant="secondary">
              Paid: ${totalPaid.toFixed(2)}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {commissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No commissions recorded</p>
        ) : (
          <div className="space-y-3">
            {commissions.map((commission) => (
              <div key={commission.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{commission.staff?.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {commission.commission_percentage}% = ${commission.commission_amount.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Accrued: {commission.accrued_date ? new Date(commission.accrued_date).toLocaleDateString() : 'N/A'}
                    {commission.paid_date && ` | Paid: ${new Date(commission.paid_date).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={commission.status === 'paid' ? 'default' : 'outline'}>
                    {commission.status === 'paid' ? 'Paid' : 'Accrued'}
                  </Badge>
                  {commission.status === 'accrued' && (
                    <Button
                      size="sm"
                      onClick={() => payCommission(commission.id)}
                      className="h-8"
                    >
                      Pay
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
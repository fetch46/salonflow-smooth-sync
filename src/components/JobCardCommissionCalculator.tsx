import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CommissionCalculatorProps {
  serviceId?: string;
  staffId?: string;
  amount: number;
  onCommissionChange: (commission: number, rate: number) => void;
}

export const JobCardCommissionCalculator: React.FC<CommissionCalculatorProps> = ({
  serviceId,
  staffId,
  amount,
  onCommissionChange
}) => {
  const [commissionRate, setCommissionRate] = useState(0);
  const [calculatedCommission, setCalculatedCommission] = useState(0);

  useEffect(() => {
    const calculateCommission = async () => {
      if (!staffId || amount <= 0) {
        setCommissionRate(0);
        setCalculatedCommission(0);
        onCommissionChange(0, 0);
        return;
      }

      try {
        // Get commission rate from service or staff
        let rate = 0;
        
        if (serviceId) {
          const { data: service } = await supabase
            .from('services')
            .select('commission_percentage')
            .eq('id', serviceId)
            .single();
          rate = service?.commission_percentage || 0;
        }
        
        if (rate === 0) {
          const { data: staff } = await supabase
            .from('staff')
            .select('commission_rate')
            .eq('id', staffId)
            .single();
          rate = staff?.commission_rate || 0;
        }

        const commission = (amount * rate) / 100;
        
        setCommissionRate(rate);
        setCalculatedCommission(commission);
        onCommissionChange(commission, rate);
      } catch (error) {
        console.error('Error calculating commission:', error);
        setCommissionRate(0);
        setCalculatedCommission(0);
        onCommissionChange(0, 0);
      }
    };

    calculateCommission();
  }, [serviceId, staffId, amount, onCommissionChange]);

  if (!staffId || amount <= 0) {
    return null;
  }

  return (
    <div className="text-xs text-muted-foreground">
      Commission: {commissionRate}% = ${calculatedCommission.toFixed(2)}
    </div>
  );
};
import React, { useState, useEffect } from 'react';
import { ProfitLossReport } from '@/components/reports/ProfitLossReport';
import { BalanceSheetReport } from '@/components/reports/BalanceSheetReport';
import { ExpenseReport } from '@/components/reports/ExpenseReport';
import { CustomerReports } from '@/components/reports/CustomerReports';
import { CommissionPayableReport } from '@/components/reports/CommissionPayableReport';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/lib/saas/hooks';

const SpecificReports = () => {
  const [searchParams] = useSearchParams();
  const reportType = searchParams.get('type');
  const { organization } = useOrganization();
  
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return start.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Load locations for current organization only
  useEffect(() => {
    const loadLocations = async () => {
      if (!organization?.id) return;
      
      try {
        const { data } = await supabase
          .from('business_locations')
          .select('id, name')
          .eq('organization_id', organization.id)
          .eq('is_active', true)
          .order('name');
        setLocations(data || []);
      } catch (error) {
        console.error('Error loading locations:', error);
      }
    };
    loadLocations();
  }, [organization?.id]);

  const commonProps = {
    locationFilter,
    setLocationFilter,
    locations,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
  };

  switch (reportType) {
    case 'profit-loss':
      return <ProfitLossReport {...commonProps} />;
    case 'balance-sheet':
      return <BalanceSheetReport {...commonProps} />;
    case 'expenses':
      return <ExpenseReport {...commonProps} />;
    case 'customers':
      return <CustomerReports {...commonProps} />;
    case 'commission-payable':
      return <CommissionPayableReport {...commonProps} />;
    default:
      return <div>Report type not found</div>;
  }
};

export default SpecificReports;
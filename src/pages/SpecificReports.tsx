import React from 'react';
import { ProfitLossReport } from '@/components/reports/ProfitLossReport';
import { BalanceSheetReport } from '@/components/reports/BalanceSheetReport';
import { ExpenseReport } from '@/components/reports/ExpenseReport';
import { CustomerReports } from '@/components/reports/CustomerReports';
import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';

const SpecificReports = () => {
  const [searchParams] = useSearchParams();
  const reportType = searchParams.get('type');
  
  const [locations] = useState<Array<{ id: string; name: string }>>([]);
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return start.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

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
    default:
      return <div>Report type not found</div>;
  }
};

export default SpecificReports;
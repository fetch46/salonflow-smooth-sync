import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSaas } from '@/lib/saas';

export interface TransactionNumberSeries {
  id: string;
  organization_id: string;
  transaction_type: string;
  prefix?: string;
  current_number: number;
  padding_length: number;
  suffix?: string;
  format_template: string;
  is_active: boolean;
}

export interface UseTransactionNumbersResult {
  series: TransactionNumberSeries[];
  isLoading: boolean;
  getNextNumber: (transactionType: string) => Promise<string>;
  updateSeries: (transactionType: string, updates: Partial<TransactionNumberSeries>) => Promise<void>;
  refreshSeries: () => Promise<void>;
}

export function useTransactionNumbers(): UseTransactionNumbersResult {
  const { organization } = useSaas();
  const [series, setSeries] = useState<TransactionNumberSeries[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSeries = async () => {
    if (!organization?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('transaction_number_series')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .order('transaction_type');

      if (error) throw error;
      setSeries(data || []);
    } catch (error) {
      console.error('Error loading transaction number series:', error);
      setSeries([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSeries();
  }, [organization?.id]);

  const getNextNumber = async (transactionType: string): Promise<string> => {
    if (!organization?.id) {
      throw new Error('No organization selected');
    }

    try {
      const { data, error } = await supabase.rpc('get_next_transaction_number', {
        p_organization_id: organization.id,
        p_transaction_type: transactionType
      });

      if (error) throw error;
      
      // Refresh series after getting next number
      await loadSeries();
      
      return data || '';
    } catch (error) {
      console.error('Error getting next transaction number:', error);
      throw error;
    }
  };

  const updateSeries = async (transactionType: string, updates: Partial<TransactionNumberSeries>) => {
    if (!organization?.id) {
      throw new Error('No organization selected');
    }

    try {
      const { error } = await supabase
        .from('transaction_number_series')
        .update(updates)
        .eq('organization_id', organization.id)
        .eq('transaction_type', transactionType);

      if (error) throw error;
      
      await loadSeries();
    } catch (error) {
      console.error('Error updating transaction number series:', error);
      throw error;
    }
  };

  const refreshSeries = async () => {
    await loadSeries();
  };

  return {
    series,
    isLoading,
    getNextNumber,
    updateSeries,
    refreshSeries
  };
}
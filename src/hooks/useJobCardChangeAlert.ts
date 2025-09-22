import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/lib/saas/hooks';

interface JobCardInfo {
  id: string;
  job_card_number: string;
  total_amount: number;
  updated_at: string;
  client_name?: string;
}

interface JobCardChangeAlert {
  hasChanges: boolean;
  jobCardInfo: JobCardInfo | null;
  lastInvoiceUpdate: string | null;
  checkForChanges: () => Promise<void>;
}

export function useJobCardChangeAlert(jobCardId?: string | null, invoiceUpdatedAt?: string | null): JobCardChangeAlert {
  const [hasChanges, setHasChanges] = useState(false);
  const [jobCardInfo, setJobCardInfo] = useState<JobCardInfo | null>(null);
  const { organization } = useOrganization();

  const checkForChanges = async () => {
    if (!jobCardId || !invoiceUpdatedAt || !organization?.id) {
      setHasChanges(false);
      setJobCardInfo(null);
      return;
    }

    try {
      // Get job card info with updated_at timestamp
      const { data: jobCard } = await supabase
        .from('job_cards')
        .select(`
          id,
          job_card_number,
          total_amount,
          updated_at,
          clients(full_name)
        `)
        .eq('id', jobCardId)
        .eq('organization_id', organization.id)
        .maybeSingle();

      if (!jobCard) {
        setHasChanges(false);
        setJobCardInfo(null);
        return;
      }

      const jobCardData: JobCardInfo = {
        id: jobCard.id,
        job_card_number: jobCard.job_card_number,
        total_amount: jobCard.total_amount,
        updated_at: jobCard.updated_at,
        client_name: (jobCard as any).clients?.full_name
      };

      setJobCardInfo(jobCardData);

      // Check if job card was updated after the invoice
      const jobCardUpdated = new Date(jobCard.updated_at);
      const invoiceUpdated = new Date(invoiceUpdatedAt);
      
      // Also check if there were any changes to job card services or products
      const [{ data: serviceChanges }, { data: productChanges }] = await Promise.all([
        supabase
          .from('job_card_services')
          .select('updated_at')
          .eq('job_card_id', jobCardId)
          .gte('updated_at', invoiceUpdatedAt),
        supabase
          .from('job_card_products')
          .select('updated_at')
          .eq('job_card_id', jobCardId)
          .gte('updated_at', invoiceUpdatedAt)
      ]);

      const hasServiceChanges = (serviceChanges || []).length > 0;
      const hasProductChanges = (productChanges || []).length > 0;
      const hasJobCardChanges = jobCardUpdated > invoiceUpdated;

      setHasChanges(hasJobCardChanges || hasServiceChanges || hasProductChanges);
    } catch (error) {
      console.error('Error checking job card changes:', error);
      setHasChanges(false);
      setJobCardInfo(null);
    }
  };

  useEffect(() => {
    checkForChanges();
  }, [jobCardId, invoiceUpdatedAt, organization?.id]);

  return {
    hasChanges,
    jobCardInfo,
    lastInvoiceUpdate: invoiceUpdatedAt,
    checkForChanges
  };
}
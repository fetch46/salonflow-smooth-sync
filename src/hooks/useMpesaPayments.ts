import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface MpesaPayment {
  id: string;
  organization_id: string;
  phone_number: string;
  amount: number;
  account_reference: string;
  transaction_desc: string;
  merchant_request_id?: string;
  checkout_request_id?: string;
  response_code?: string;
  response_description?: string;
  customer_message?: string;
  mpesa_receipt_number?: string;
  transaction_date?: string;
  status: string;
  reference_type?: string;
  reference_id?: string;
  created_at: string;
  updated_at: string;
}

export const useMpesaPayments = (organizationId?: string) => {
  const [payments, setPayments] = useState<MpesaPayment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPayments = useCallback(async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mpesa_payments')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching M-Pesa payments:', error);
      toast({
        title: "Error",
        description: "Failed to fetch M-Pesa payments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const getPaymentById = useCallback(async (paymentId: string) => {
    try {
      const { data, error } = await supabase
        .from('mpesa_payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching M-Pesa payment:', error);
      throw error;
    }
  }, []);

  const getPaymentsByReference = useCallback(async (referenceType: string, referenceId: string) => {
    try {
      const { data, error } = await supabase
        .from('mpesa_payments')
        .select('*')
        .eq('reference_type', referenceType)
        .eq('reference_id', referenceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching M-Pesa payments by reference:', error);
      throw error;
    }
  }, []);

  const initiatePayment = useCallback(async (paymentRequest: {
    organizationId: string;
    phoneNumber: string;
    amount: number;
    accountReference: string;
    transactionDesc: string;
    referenceType?: string;
    referenceId?: string;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
        body: paymentRequest
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Payment initiation failed');
      }

      return data.data;
    } catch (error) {
      console.error('Error initiating M-Pesa payment:', error);
      throw error;
    }
  }, []);

  return {
    payments,
    loading,
    fetchPayments,
    getPaymentById,
    getPaymentsByReference,
    initiatePayment
  };
};
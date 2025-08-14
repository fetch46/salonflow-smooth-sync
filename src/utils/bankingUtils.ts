import { supabase } from "@/integrations/supabase/client";

export interface BankingTransaction {
  id: string;
  account_id: string;
  transaction_date: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  reference_type?: string;
  reference_id?: string;
}

export const postPaymentReceived = async (
  accountId: string,
  amount: number,
  description: string,
  paymentDate: string = new Date().toISOString().split('T')[0],
  referenceType?: string,
  referenceId?: string
) => {
  try {
    // Payment received should DEBIT the bank account (money coming in)
    const { error } = await supabase
      .from('account_transactions')
      .insert({
        account_id: accountId,
        transaction_date: paymentDate,
        description,
        debit_amount: amount,
        credit_amount: 0,
        reference_type: referenceType,
        reference_id: referenceId
      });
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error posting payment received:', error);
    return false;
  }
};

export const postPaymentMade = async (
  accountId: string,
  amount: number,
  description: string,
  paymentDate: string = new Date().toISOString().split('T')[0],
  referenceType?: string,
  referenceId?: string
) => {
  try {
    // Payment made should CREDIT the bank account (money going out)
    const { error } = await supabase
      .from('account_transactions')
      .insert({
        account_id: accountId,
        transaction_date: paymentDate,
        description,
        debit_amount: 0,
        credit_amount: amount,
        reference_type: referenceType,
        reference_id: referenceId
      });
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error posting payment made:', error);
    return false;
  }
};
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Mpesa callback received');
    
    const callbackData = await req.json();
    console.log('Callback data:', JSON.stringify(callbackData, null, 2));

    const { Body } = callbackData;
    
    if (!Body || !Body.stkCallback) {
      console.log('Invalid callback format');
      return new Response(JSON.stringify({ 
        ResultCode: 0, 
        ResultDesc: "Success" 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { 
      MerchantRequestID, 
      CheckoutRequestID, 
      ResultCode, 
      ResultDesc,
      CallbackMetadata 
    } = Body.stkCallback;

    console.log('Processing callback for CheckoutRequestID:', CheckoutRequestID);

    // Find the payment record
    const { data: paymentRecord, error: findError } = await supabase
      .from('mpesa_payments')
      .select('*')
      .eq('checkout_request_id', CheckoutRequestID)
      .single();

    if (findError) {
      console.error('Payment record not found:', findError);
      return new Response(JSON.stringify({ 
        ResultCode: 1, 
        ResultDesc: "Payment record not found" 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let updateData: any = {
      response_code: ResultCode.toString(),
      response_description: ResultDesc,
      updated_at: new Date().toISOString()
    };

    // If payment was successful, extract additional details
    if (ResultCode === 0 && CallbackMetadata && CallbackMetadata.Item) {
      const metadata = CallbackMetadata.Item;
      
      // Extract Mpesa receipt number and transaction date
      const receiptItem = metadata.find((item: any) => item.Name === 'MpesaReceiptNumber');
      const dateItem = metadata.find((item: any) => item.Name === 'TransactionDate');
      
      if (receiptItem) {
        updateData.mpesa_receipt_number = receiptItem.Value;
      }
      
      if (dateItem) {
        // Convert Safaricom date format (YYYYMMDDHHmmss) to ISO date
        const dateStr = dateItem.Value.toString();
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const hour = dateStr.substring(8, 10);
        const minute = dateStr.substring(10, 12);
        const second = dateStr.substring(12, 14);
        
        updateData.transaction_date = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
      }
      
      updateData.status = 'success';
    } else {
      updateData.status = 'failed';
    }

    console.log('Updating payment record with:', updateData);

    // Update the payment record
    const { error: updateError } = await supabase
      .from('mpesa_payments')
      .update(updateData)
      .eq('id', paymentRecord.id);

    if (updateError) {
      console.error('Error updating payment record:', updateError);
      return new Response(JSON.stringify({ 
        ResultCode: 1, 
        ResultDesc: "Database update failed" 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Payment record updated successfully');

    // If payment was successful and has reference, update the related record
    if (ResultCode === 0 && paymentRecord.reference_type && paymentRecord.reference_id) {
      console.log('Updating related record:', paymentRecord.reference_type, paymentRecord.reference_id);
      
      try {
        // Update related records (invoices, receipts, etc.) to mark as paid
        if (paymentRecord.reference_type === 'invoice') {
          // Create invoice payment record
          await supabase
            .from('invoice_payments')
            .insert([
              {
                invoice_id: paymentRecord.reference_id,
                amount: paymentRecord.amount,
                payment_method: 'mpesa',
                reference: updateData.mpesa_receipt_number || CheckoutRequestID,
                payment_date: updateData.transaction_date || new Date().toISOString()
              }
            ]);
        }
        // Add other reference types as needed (receipts, job_cards, etc.)
      } catch (referenceError) {
        console.error('Error updating reference record:', referenceError);
        // Don't fail the callback for this
      }
    }

    return new Response(JSON.stringify({ 
      ResultCode: 0, 
      ResultDesc: "Success" 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in mpesa-callback function:', error);
    return new Response(JSON.stringify({ 
      ResultCode: 1, 
      ResultDesc: "Internal error" 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
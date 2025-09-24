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

interface MpesaPaymentRequest {
  organizationId: string;
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  referenceType?: string;
  referenceId?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Mpesa STK Push request received');
    
    const { 
      organizationId, 
      phoneNumber, 
      amount, 
      accountReference, 
      transactionDesc,
      referenceType,
      referenceId 
    }: MpesaPaymentRequest = await req.json();

    // Validate required fields
    if (!organizationId || !phoneNumber || !amount || !accountReference) {
      throw new Error('Missing required fields');
    }

    // Get Mpesa credentials from environment
    const consumerKey = Deno.env.get('MPESA_CONSUMER_KEY');
    const consumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET');
    const passkey = Deno.env.get('MPESA_PASSKEY');
    const businessShortCode = Deno.env.get('MPESA_BUSINESS_SHORT_CODE');

    if (!consumerKey || !consumerSecret || !passkey || !businessShortCode) {
      throw new Error('Mpesa credentials not configured');
    }

    console.log('Mpesa credentials found, proceeding with authentication');

    // Get OAuth token from Safaricom
    const authString = btoa(`${consumerKey}:${consumerSecret}`);
    const authResponse = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authString}`,
      },
    });

    if (!authResponse.ok) {
      throw new Error(`Authentication failed: ${authResponse.statusText}`);
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    console.log('Authentication successful, initiating STK push');

    // Generate timestamp and password
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const password = btoa(`${businessShortCode}${passkey}${timestamp}`);

    // Format phone number (remove leading + or 0, add 254 prefix)
    let formattedPhone = phoneNumber.replace(/^\+?/, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.slice(1);
    } else if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone;
    }

    // Prepare STK Push request
    const stkPushRequest = {
      BusinessShortCode: businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(amount), // Ensure amount is an integer
      PartyA: formattedPhone,
      PartyB: businessShortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mpesa-callback`,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc
    };

    console.log('STK Push request prepared:', { ...stkPushRequest, Password: '[REDACTED]' });

    // Send STK Push request
    const stkResponse = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stkPushRequest),
    });

    const stkData = await stkResponse.json();
    console.log('STK Push response:', stkData);

    if (!stkResponse.ok) {
      throw new Error(`STK Push failed: ${JSON.stringify(stkData)}`);
    }

    // Store payment record in database
    const { data: paymentRecord, error: dbError } = await supabase
      .from('mpesa_payments')
      .insert([
        {
          organization_id: organizationId,
          phone_number: formattedPhone,
          amount: amount,
          account_reference: accountReference,
          transaction_desc: transactionDesc,
          merchant_request_id: stkData.MerchantRequestID,
          checkout_request_id: stkData.CheckoutRequestID,
          response_code: stkData.ResponseCode,
          response_description: stkData.ResponseDescription,
          customer_message: stkData.CustomerMessage,
          reference_type: referenceType || null,
          reference_id: referenceId || null,
          status: stkData.ResponseCode === '0' ? 'pending' : 'failed'
        }
      ])
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    console.log('Payment record created:', paymentRecord.id);

    return new Response(JSON.stringify({
      success: true,
      data: {
        paymentId: paymentRecord.id,
        merchantRequestId: stkData.MerchantRequestID,
        checkoutRequestId: stkData.CheckoutRequestID,
        responseCode: stkData.ResponseCode,
        responseDescription: stkData.ResponseDescription,
        customerMessage: stkData.CustomerMessage
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in mpesa-stk-push function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
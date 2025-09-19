import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organization_id, test_number, config } = await req.json();

    console.log('Testing WhatsApp connection for organization:', organization_id);

    // Validate required config
    if (!config.account_sid || !config.auth_token || !config.from_number) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required Twilio credentials (Account SID, Auth Token, or From Number)' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!test_number) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Test phone number is required' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare Twilio API credentials
    const twilioAuth = btoa(`${config.account_sid}:${config.auth_token}`);
    
    // Send test WhatsApp message via Twilio
    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.account_sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${twilioAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: config.from_number,
          To: `whatsapp:${test_number}`,
          Body: 'Test message from your business WhatsApp integration. If you received this, your WhatsApp integration is working correctly!'
        }),
      }
    );

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('Twilio API error:', twilioData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: twilioData.message || 'Failed to send test message via Twilio' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('WhatsApp test message sent successfully:', twilioData.sid);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Test message sent successfully!',
        message_sid: twilioData.sid
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in test-whatsapp function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
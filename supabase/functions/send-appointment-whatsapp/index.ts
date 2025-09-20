import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const { appointment_id, organization_id } = await req.json();

    console.log('Sending WhatsApp notification for appointment:', appointment_id);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get appointment details
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointment_id)
      .single();

    if (appointmentError || !appointment) {
      throw new Error(`Failed to fetch appointment: ${appointmentError?.message}`);
    }

    // Get organization WhatsApp settings
    const { data: orgSettings, error: settingsError } = await supabase
      .from('organization_settings')
      .select('whatsapp_config')
      .eq('organization_id', organization_id)
      .single();

    if (settingsError || !orgSettings?.whatsapp_config) {
      throw new Error('WhatsApp not configured for this organization');
    }

    const config = orgSettings.whatsapp_config;

    // Validate WhatsApp config
    if (!config.account_sid || !config.auth_token || !config.from_number) {
      throw new Error('WhatsApp configuration incomplete');
    }

    if (!appointment.customer_phone) {
      throw new Error('Customer phone number is required');
    }

    // Format appointment details
    const appointmentDate = new Date(appointment.appointment_date).toLocaleDateString();
    const appointmentTime = appointment.appointment_time;
    
    const message = `Hello ${appointment.customer_name}! 

Your appointment has been confirmed:
📅 Date: ${appointmentDate}
⏰ Time: ${appointmentTime}
🏪 Service: ${appointment.service_name}
${appointment.notes ? `📝 Notes: ${appointment.notes}` : ''}

We look forward to seeing you!`;

    // Prepare Twilio API credentials
    const twilioAuth = btoa(`${config.account_sid}:${config.auth_token}`);
    
    // Send WhatsApp message via Twilio
    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.account_sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${twilioAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: config.from_number.startsWith('whatsapp:') ? config.from_number : `whatsapp:${config.from_number}`,
          To: appointment.customer_phone.startsWith('whatsapp:') ? appointment.customer_phone : `whatsapp:${appointment.customer_phone}`,
          Body: message
        }),
      }
    );

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('Twilio API error:', twilioData);
      throw new Error(twilioData.message || 'Failed to send WhatsApp message');
    }

    // Update appointment with confirmation sent timestamp
    await supabase
      .from('appointments')
      .update({ 
        confirmation_whatsapp_sent_at: new Date().toISOString() 
      })
      .eq('id', appointment_id);

    console.log('WhatsApp message sent successfully:', twilioData.sid);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'WhatsApp notification sent successfully!',
        message_sid: twilioData.sid
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-appointment-whatsapp function:', error);
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
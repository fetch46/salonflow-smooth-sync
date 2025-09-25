import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { consumer_key, consumer_secret, environment } = await req.json();

    if (!consumer_key || !consumer_secret) {
      return new Response(
        JSON.stringify({ success: false, error: 'Consumer key and secret are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine the OAuth URL based on environment
    const oauthUrl = environment === 'production' 
      ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
      : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

    // Create Basic auth header
    const auth = btoa(`${consumer_key}:${consumer_secret}`);

    console.log('Testing M-Pesa connection for environment:', environment);

    // Get access token
    const tokenResponse = await fetch(oauthUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token request failed:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Authentication failed: ${tokenResponse.status} - ${errorText}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to get access token from M-Pesa API' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('M-Pesa connection test successful');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Connection test successful! M-Pesa API is accessible.',
        environment,
        token_expires_in: tokenData.expires_in
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Connection test error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Connection test failed: ${error.message}` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    const authClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    
    console.log(`Authenticated user: ${user.id}`);
    
    const { email } = await req.json();
    
    if (!email) {
      throw new Error('Email is required');
    }

    const consumerKey = Deno.env.get('PESAPAL_CONSUMER_KEY');
    const consumerSecret = Deno.env.get('PESAPAL_CONSUMER_SECRET');

    if (!consumerKey || !consumerSecret) {
      throw new Error('PesaPal credentials not configured');
    }

    // Get PesaPal access token
    console.log('Getting PesaPal access token...');
    const tokenResponse = await fetch('https://pay.pesapal.com/v3/api/Auth/RequestToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token error:', errorText);
      throw new Error('Failed to get PesaPal token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.token;

    console.log('Access token obtained, registering IPN...');

    // Register IPN URL
    const ipnUrl = `${supabaseUrl}/functions/v1/pesapal-callback`;

    const ipnResponse = await fetch('https://pay.pesapal.com/v3/api/URLSetup/RegisterIPN', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        url: ipnUrl,
        ipn_notification_type: 'POST',
      }),
    });

    const ipnData = await ipnResponse.json();
    console.log('IPN response:', JSON.stringify(ipnData));
    
    if (!ipnResponse.ok || ipnData.error) {
      console.error('IPN registration failed:', JSON.stringify(ipnData));
      throw new Error(`IPN registration failed: ${ipnData.error?.message || 'Unknown error'}`);
    }
    
    const ipnId = ipnData.ipn_id;
    if (!ipnId) {
      console.error('No IPN ID returned');
      throw new Error('No IPN ID returned from PesaPal');
    }

    console.log('IPN registered with ID:', ipnId);

    // Create payment order
    const orderId = `PWO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Use the app's actual URL for callback
    const callbackUrl = 'https://polywatch-wizard.lovable.app/dashboard?payment=success';
    
    const orderPayload = {
      id: orderId,
      currency: 'KES',
      amount: 1000,
      description: 'PolyWatch Premium Subscription - Monthly',
      callback_url: callbackUrl,
      notification_id: ipnId,
      billing_address: {
        email_address: email,
      },
    };
    
    console.log('Creating order with payload:', JSON.stringify(orderPayload));
    
    const orderResponse = await fetch('https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const orderData = await orderResponse.json();
    console.log('Order response:', JSON.stringify(orderData));
    
    if (!orderResponse.ok || orderData.error) {
      console.error('Order creation failed:', JSON.stringify(orderData));
      throw new Error(`Failed to create payment order: ${orderData.error?.message || orderData.message || 'Unknown error'}`);
    }
    
    if (!orderData.redirect_url) {
      console.error('No redirect URL in response:', JSON.stringify(orderData));
      throw new Error('PesaPal did not return a redirect URL');
    }
    
    console.log('Payment order created successfully:', orderData.order_tracking_id);

    // Store order reference in database
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user by email
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (profile) {
      await supabase
        .from('profiles')
        .update({ subscription_id: orderData.order_tracking_id })
        .eq('id', profile.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        redirect_url: orderData.redirect_url,
        order_tracking_id: orderData.order_tracking_id,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Payment error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

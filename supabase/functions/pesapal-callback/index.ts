import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Get PesaPal access token
async function getPesaPalToken(): Promise<string> {
  const consumerKey = Deno.env.get('PESAPAL_CONSUMER_KEY');
  const consumerSecret = Deno.env.get('PESAPAL_CONSUMER_SECRET');
  
  if (!consumerKey || !consumerSecret) {
    throw new Error('PesaPal credentials not configured');
  }

  const response = await fetch('https://pay.pesapal.com/v3/api/Auth/RequestToken', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      consumer_key: consumerKey,
      consumer_secret: consumerSecret
    })
  });

  if (!response.ok) {
    throw new Error('Failed to authenticate with PesaPal');
  }

  const data = await response.json();
  return data.token;
}

// Verify transaction status directly with PesaPal API
async function verifyTransactionStatus(orderTrackingId: string, token: string): Promise<{ isCompleted: boolean; status: string }> {
  const response = await fetch(
    `https://pay.pesapal.com/v3/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    console.error('PesaPal verification failed:', response.status, await response.text());
    throw new Error('Failed to verify transaction with PesaPal');
  }

  const data = await response.json();
  console.log('PesaPal transaction status:', JSON.stringify(data));
  
  // PesaPal returns status_code: 1 for completed payments
  // Valid status codes: 0 = Invalid, 1 = Completed, 2 = Failed, 3 = Reversed
  const isCompleted = data.status_code === 1 || data.payment_status_description === 'Completed';
  
  return {
    isCompleted,
    status: data.payment_status_description || data.status || 'unknown'
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const callbackId = crypto.randomUUID().slice(0, 8);
  console.log(`[Callback ${callbackId}] Received at ${new Date().toISOString()}`);

  try {
    const body = await req.json();
    console.log(`[Callback ${callbackId}] Payload:`, JSON.stringify(body));

    const { OrderTrackingId, OrderMerchantReference, OrderNotificationType } = body;

    // Basic validation
    if (!OrderTrackingId || typeof OrderTrackingId !== 'string') {
      console.log(`[Callback ${callbackId}] Invalid OrderTrackingId`);
      return new Response(
        JSON.stringify({ status: 'REJECTED', reason: 'Invalid request' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Only process if notification indicates completion
    if (OrderNotificationType !== 'COMPLETED') {
      console.log(`[Callback ${callbackId}] Non-completion notification: ${OrderNotificationType}`);
      return new Response(
        JSON.stringify({ status: 'ACKNOWLEDGED' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // CRITICAL: Verify payment status directly with PesaPal API
    // This prevents attackers from forging callback notifications
    console.log(`[Callback ${callbackId}] Verifying transaction with PesaPal API...`);
    const token = await getPesaPalToken();
    const verification = await verifyTransactionStatus(OrderTrackingId, token);

    if (!verification.isCompleted) {
      console.log(`[Callback ${callbackId}] Transaction NOT verified as completed. Status: ${verification.status}`);
      return new Response(
        JSON.stringify({ status: 'REJECTED', reason: 'Transaction not verified' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[Callback ${callbackId}] Transaction VERIFIED as completed`);

    // Now safe to update user to premium
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('profiles')
      .update({ is_premium: true })
      .eq('subscription_id', OrderTrackingId)
      .select();

    if (error) {
      console.error(`[Callback ${callbackId}] Database update error:`, error);
      return new Response(
        JSON.stringify({ status: 'ERROR', reason: 'Update failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!data || data.length === 0) {
      console.log(`[Callback ${callbackId}] No profile found with subscription_id: ${OrderTrackingId}`);
      return new Response(
        JSON.stringify({ status: 'ACKNOWLEDGED', note: 'No matching profile' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`[Callback ${callbackId}] User upgraded to premium:`, data[0]?.id);

    return new Response(
      JSON.stringify({ status: 'OK' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[Callback ${callbackId}] Error [${errorId}]:`, error);
    
    return new Response(
      JSON.stringify({ status: 'ERROR', errorId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

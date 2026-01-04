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
    const body = await req.json();
    console.log('PesaPal callback received:', JSON.stringify(body));

    const { OrderTrackingId, OrderMerchantReference, OrderNotificationType } = body;

    if (OrderNotificationType === 'COMPLETED' && OrderTrackingId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Update user to premium
      const { data, error } = await supabase
        .from('profiles')
        .update({ is_premium: true })
        .eq('subscription_id', OrderTrackingId)
        .select();

      if (error) {
        console.error('Update error:', error);
        throw error;
      }

      console.log('User upgraded to premium:', data);
    }

    return new Response(
      JSON.stringify({ status: 'OK' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Callback error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

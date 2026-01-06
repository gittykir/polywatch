import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TelegramMessage {
  text?: string;
  date?: number;
  message_id?: number;
}

interface ParsedAlert {
  alert_type: 'new_market' | 'price_imbalance' | 'whale_activity';
  market_id: string;
  market_question: string;
  details: Record<string, unknown>;
}

// Parse Telegram message text to extract market alert information
function parseAlertFromMessage(text: string): ParsedAlert | null {
  if (!text) return null;

  const lowerText = text.toLowerCase();
  
  // Generate a unique market ID based on the message content
  const marketId = `tg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Detect alert type from message content
  let alertType: ParsedAlert['alert_type'] = 'new_market';
  
  if (lowerText.includes('whale') || lowerText.includes('large bet') || lowerText.includes('big money') || lowerText.includes('volume')) {
    alertType = 'whale_activity';
  } else if (lowerText.includes('imbalance') || lowerText.includes('arbitrage') || lowerText.includes('mispricing') || lowerText.includes('odds')) {
    alertType = 'price_imbalance';
  } else if (lowerText.includes('new') || lowerText.includes('launched') || lowerText.includes('created') || lowerText.includes('market')) {
    alertType = 'new_market';
  }

  // Extract the main question/title (first line or first sentence)
  const lines = text.split('\n').filter(line => line.trim());
  const marketQuestion = lines[0]?.substring(0, 500) || text.substring(0, 500);

  return {
    alert_type: alertType,
    market_id: marketId,
    market_question: marketQuestion,
    details: {
      full_message: text,
      source: 'telegram',
      parsed_at: new Date().toISOString(),
    },
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('Received webhook payload:', JSON.stringify(body));

    // Handle different payload formats
    let messages: TelegramMessage[] = [];
    
    if (body.message) {
      // Single Telegram update format
      messages = [body.message];
    } else if (body.messages && Array.isArray(body.messages)) {
      // Array of messages
      messages = body.messages;
    } else if (body.text) {
      // Simple text format (manual forwarding)
      messages = [{ text: body.text, date: Math.floor(Date.now() / 1000) }];
    } else if (typeof body === 'string') {
      // Plain text body
      messages = [{ text: body, date: Math.floor(Date.now() / 1000) }];
    }

    const alerts: ParsedAlert[] = [];
    
    for (const msg of messages) {
      if (msg.text) {
        const parsed = parseAlertFromMessage(msg.text);
        if (parsed) {
          alerts.push(parsed);
        }
      }
    }

    if (alerts.length === 0) {
      console.log('No valid alerts parsed from message');
      return new Response(
        JSON.stringify({ success: true, message: 'No alerts to process', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert alerts into the database
    const alertsToInsert = alerts.map(alert => ({
      alert_type: alert.alert_type,
      market_id: alert.market_id,
      market_question: alert.market_question,
      details: alert.details,
      detected_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('market_alerts')
      .insert(alertsToInsert)
      .select();

    if (error) {
      console.error('Error inserting alerts:', error);
      throw error;
    }

    console.log(`Successfully inserted ${data?.length || 0} alerts`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${alerts.length} alert(s)`,
        count: data?.length || 0,
        alerts: data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Flexible interfaces to handle various API response formats
interface PolymarketMarket {
  id?: string;
  question?: string;
  outcomePrices?: string;
  outcomes?: string;
  clobTokenIds?: string;
  active?: boolean;
  closed?: boolean;
  volume?: number;
  liquidity?: number;
}

interface PolymarketEvent {
  id?: string;
  slug?: string;
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  volume?: number;
  liquidity?: number;
  markets?: PolymarketMarket[];
  createdAt?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    
    // Check if this is an internal call (cron job) - token contains 'anon' role claim or is service role
    const isServiceRole = token === supabaseServiceKey;
    
    // For cron jobs using anon key, check if token is a valid JWT with anon role
    let isAnonKeyCall = false;
    if (token && !isServiceRole) {
      try {
        // Parse JWT payload (base64 decode the middle part)
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          // Check if this is an anon key (role: anon) and from our project
          isAnonKeyCall = payload.role === 'anon' && payload.ref === 'yhefwlkpyybonlhbijoc';
        }
      } catch {
        // Not a valid JWT, will be handled by user auth check
      }
    }
    
    const isInternalCall = isServiceRole || isAnonKeyCall;
    
    console.log('isServiceRole:', isServiceRole);
    console.log('isAnonKeyCall:', isAnonKeyCall);
    console.log('isInternalCall:', isInternalCall);
    
    // For public calls (no auth or invalid internal key), require user JWT
    if (!isInternalCall) {
      if (!authHeader) {
        console.error('No authorization header provided');
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }
      
      // Verify user JWT - use service key for auth client since we're validating user tokens
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
    } else {
      console.log(`Internal access: ${isServiceRole ? 'service role' : 'anon key'} (cron job)`);
    }
    
    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching events from Polymarket API...');
    
    // Fetch all events without filtering
    const response = await fetch('https://gamma-api.polymarket.com/events?limit=100');
    
    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status}`);
    }

    const events: PolymarketEvent[] = await response.json();
    console.log(`Fetched ${events.length} events from Polymarket`);
    
    // Log first event structure for debugging
    if (events.length > 0) {
      console.log('Sample event keys:', Object.keys(events[0]));
      if (events[0].markets && events[0].markets.length > 0) {
        console.log('Sample market keys:', Object.keys(events[0].markets[0]));
      }
    }

    const alerts: {
      alert_type: string;
      market_id: string;
      market_question: string;
      details: Record<string, unknown>;
      detected_at: string;
    }[] = [];

    const now = new Date();

    let totalMarkets = 0;

    for (const event of events) {
      // Handle markets array
      const markets = event.markets || [];
      
      // If no nested markets, treat the event itself as a market
      if (markets.length === 0) {
        totalMarkets++;
        const marketId = event.id || event.slug || `event-${totalMarkets}`;
        const marketQuestion = event.title || event.description || 'Unknown Market';
        
        alerts.push({
          alert_type: 'new_market',
          market_id: marketId,
          market_question: marketQuestion,
          details: {
            eventTitle: event.title || 'Unknown',
            volume: event.volume || 0,
            liquidity: event.liquidity || 0,
          },
          detected_at: now.toISOString(),
        });
        continue;
      }

      for (const market of markets) {
        totalMarkets++;
        const marketId = market.id || event.id || `market-${totalMarkets}`;
        const marketQuestion = market.question || event.title || 'Unknown Market';

        // Parse outcome prices if available
        let yesPrice = 0;
        let noPrice = 0;
        
        if (market.outcomePrices) {
          try {
            const prices = JSON.parse(market.outcomePrices);
            if (Array.isArray(prices) && prices.length >= 2) {
              yesPrice = parseFloat(prices[0]) || 0;
              noPrice = parseFloat(prices[1]) || 0;
            }
          } catch {
            // Ignore parse errors
          }
        }

        // Create alert for every market
        alerts.push({
          alert_type: 'new_market',
          market_id: marketId,
          market_question: marketQuestion,
          details: {
            eventTitle: event.title || 'Unknown',
            yesPrice,
            noPrice,
            volume: event.volume || market.volume || 0,
            liquidity: event.liquidity || market.liquidity || 0,
          },
          detected_at: now.toISOString(),
        });

        // Check for price imbalances if we have price data
        if (yesPrice > 0 || noPrice > 0) {
          const totalPrice = yesPrice + noPrice;
          const deviation = Math.abs(1 - totalPrice);
          
          if (deviation > 0.01) {
            alerts.push({
              alert_type: 'price_imbalance',
              market_id: marketId,
              market_question: marketQuestion,
              details: {
                eventTitle: event.title || 'Unknown',
                yesPrice,
                noPrice,
                deviation: deviation * 100,
              },
              detected_at: now.toISOString(),
            });
          }
        }

        // Detect whale activity (high volume)
        const marketVolume = event.volume || market.volume || 0;
        if (marketVolume > 100000) {
          alerts.push({
            alert_type: 'whale_bet',
            market_id: marketId,
            market_question: marketQuestion,
            details: {
              eventTitle: event.title || 'Unknown',
              amount: marketVolume,
              outcome: yesPrice > noPrice ? 'YES' : 'NO',
            },
            detected_at: now.toISOString(),
          });
        }
      }
    }

    console.log(`Processed ${totalMarkets} markets from ${events.length} events`);
    console.log(`Generated ${alerts.length} alerts`);

    // Insert new alerts (avoid duplicates by checking recent entries)
    if (alerts.length > 0) {
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const { data: recentAlerts } = await supabase
        .from('market_alerts')
        .select('market_id, alert_type')
        .gte('detected_at', oneHourAgo.toISOString());

      const existingKeys = new Set(
        (recentAlerts || []).map(a => `${a.market_id}-${a.alert_type}`)
      );

      const newAlerts = alerts.filter(
        a => !existingKeys.has(`${a.market_id}-${a.alert_type}`)
      );

      if (newAlerts.length > 0) {
        const { error: insertError } = await supabase
          .from('market_alerts')
          .insert(newAlerts);

        if (insertError) {
          console.error('Insert error:', insertError);
          throw insertError;
        }
        
        console.log(`Inserted ${newAlerts.length} new alerts`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        eventsProcessed: events.length,
        marketsProcessed: totalMarkets,
        alertsGenerated: alerts.length 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

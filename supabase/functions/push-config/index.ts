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
    // Get VAPID key from environment variables (Supabase secrets)
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
    
    if (!VAPID_PUBLIC_KEY) {
      console.error('VAPID_PUBLIC_KEY not configured in Supabase secrets');
      throw new Error('Push notification service not configured');
    }

    console.log('Returning VAPID public key configuration');
    
    return new Response(
      JSON.stringify({ 
        success: true,
        vapidPublicKey: VAPID_PUBLIC_KEY
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error("Error in push-config function:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to get push notification configuration'
      }),
      {
        status: 200, // Using 200 to avoid CORS issues
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
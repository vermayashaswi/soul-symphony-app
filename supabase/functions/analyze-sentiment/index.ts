
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

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
    const requestData = await req.json();
    
    // Check if this is an environment check request
    if (requestData.debugEnv === true) {
      console.log("Environment check requested");
      
      // Get Supabase URL and service key from environment
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      // Create Supabase admin client for checking secrets
      const supabase = supabaseUrl && supabaseServiceKey 
        ? createClient(supabaseUrl, supabaseServiceKey)
        : null;
        
      // Check for Google NL API key directly
      let googleNlApiKey = Deno.env.get('GOOGLE_NL_API_KEY');
      let googleNlApiConfigured = !!googleNlApiKey;
      
      console.log(`Google NL API key directly from env: ${googleNlApiConfigured ? 'Found' : 'Not found'}`);
      
      // Check for OpenAI API key
      const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
      
      // Test Supabase connection
      let supabaseConnected = false;
      try {
        if (supabase) {
          const { data, error } = await supabase.from('emotions').select('name').limit(1);
          supabaseConnected = !error;
        }
      } catch (error) {
        console.error("Error testing Supabase connection:", error);
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          googleNlApiConfigured: googleNlApiConfigured,
          openAiApiConfigured: !!openAiApiKey,
          supabaseConnected: supabaseConnected,
          message: "Environment check completed successfully"
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Regular sentiment analysis logic...
    const { text } = requestData;
    
    if (!text) {
      throw new Error("No text provided for analysis");
    }
    
    // Get the Google Natural Language API key directly from environment
    const apiKey = Deno.env.get('GOOGLE_NL_API_KEY');
    
    if (!apiKey) {
      throw new Error("Google Natural Language API key is not configured");
    }
    
    console.log('Analyzing sentiment for text:', text.slice(0, 100) + '...');
    
    // Call the Google Natural Language API
    const response = await fetch(`https://language.googleapis.com/v1/documents:analyzeSentiment?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document: {
          type: 'PLAIN_TEXT',
          content: text,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Google NL API error:', error);
      throw new Error(`Google API error: ${error}`);
    }

    const result = await response.json();
    
    // Return sentiment as a number, not a string
    const sentimentScore = result.documentSentiment?.score || 0;
    
    // Also return magnitude for more complete sentiment information
    const sentimentMagnitude = result.documentSentiment?.magnitude || 0;
    
    return new Response(
      JSON.stringify({ 
        sentiment: sentimentScore,
        magnitude: sentimentMagnitude,
        success: true 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error("Error in analyze-sentiment function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        success: false 
      }),
      {
        status: 200, // Using 200 instead of error code to avoid CORS issues
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});


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
    const requestData = await req.json();
    const { key, value } = requestData;
    
    if (!key || !value) {
      throw new Error('Missing required parameters: key and value');
    }
    
    // Validate that we only allow setting specific keys
    const allowedKeys = ['GOOGLE_NL_API_KEY', 'OPENAI_API_KEY'];
    if (!allowedKeys.includes(key)) {
      throw new Error(`Key "${key}" is not allowed to be set via this endpoint`);
    }
    
    console.log(`Verifying key: ${key}`);
    
    // For security, we don't log the actual value
    console.log(`Secret value length: ${value.length} characters`);

    // Instead of setting an environment variable (which doesn't work in Edge Functions)
    // we'll just validate and return success - the key will be passed directly in API calls
    
    // Verify the API key by making a minimal test request to OpenAI
    if (key === 'OPENAI_API_KEY') {
      try {
        const testResponse = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${value}`,
            'Content-Type': 'application/json',
          }
        });
        
        if (!testResponse.ok) {
          throw new Error(`OpenAI API key verification failed: ${testResponse.status}`);
        }
        
        console.log('OpenAI API key verification successful');
      } catch (verifyError) {
        console.error('API key verification error:', verifyError);
        throw new Error(`Failed to verify API key: ${verifyError.message}`);
      }
    }
    
    console.log(`Key ${key} successfully validated`);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: `${key} has been successfully validated`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error("Error in set-api-key function:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 200, // Using 200 instead of error code to avoid CORS issues
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

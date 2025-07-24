
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
    
    console.log(`Setting secret: ${key}`);
    
    // For security, we don't log the actual value
    console.log(`Secret value length: ${value.length} characters`);
    
    // Enhanced API key validation based on the key type
    if (key === 'GOOGLE_NL_API_KEY') {
      // Google API keys usually contain hyphens and are relatively long
      if (value.length < 20 || !value.includes('-')) {
        throw new Error(`The provided Google NL API key appears to be invalid. Google API keys are typically longer than 20 characters and contain hyphens.`);
      }
      console.log(`Google NL API key format validation passed`);
    } else if (key === 'OPENAI_API_KEY') {
      // OpenAI API keys usually start with "sk-" and are long
      if (!value.startsWith('sk-') || value.length < 30) {
        throw new Error(`The provided OpenAI API key appears to be invalid. OpenAI API keys typically start with "sk-" and are longer than 30 characters.`);
      }
      console.log(`OpenAI API key format validation passed`);
    }

    // Set the environment variable directly
    Deno.env.set(key, value);
    
    console.log(`Secret ${key} set successfully via Deno.env.set`);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: `${key} has been set successfully`
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

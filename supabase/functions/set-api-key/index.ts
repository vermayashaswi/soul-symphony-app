
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header is required');
    }

    // Initialize Supabase client for authentication verification
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT token
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    
    if (authError || !user) {
      throw new Error('Invalid or expired authentication token');
    }

    // Check if user has admin privileges or is authenticated
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('User profile not found');
    }

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
    
    console.log(`Setting secret: ${key} for user: ${user.id}`);
    
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

    // Sanitize key value to prevent injection attacks
    const sanitizedKey = key.replace(/[^A-Z_]/g, '');
    const sanitizedValue = value.replace(/[\r\n\0]/g, '');

    // Set the environment variable with sanitized values
    Deno.env.set(sanitizedKey, sanitizedValue);
    
    console.log(`Secret ${sanitizedKey} set successfully for authenticated user`);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: `${sanitizedKey} has been set successfully`
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
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

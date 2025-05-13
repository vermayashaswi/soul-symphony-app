
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Define Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Define CORS headers
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
    const { userId, messageId, threadId, content: queryText, timezoneOffset } = await req.json();

    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!queryText) {
      throw new Error('Query text is required');
    }

    console.log(`Ensuring chat persistence for user ${userId}`);
    console.log(`User timezone offset: ${timezoneOffset || 0} minutes`);
    
    // Insert the query into the user_queries table without generating embeddings
    const { data, error } = await supabase
      .from('user_queries')
      .insert({
        user_id: userId,
        query_text: queryText,
        thread_id: threadId,
        message_id: messageId,
        timezone_offset: timezoneOffset || 0
      })
      .select()
      .single();
      
    if (error) {
      console.error("Error logging user query:", error);
      throw error;
    }
    
    console.log("User query logged successfully with ID:", data.id);

    return new Response(
      JSON.stringify({ success: true, queryId: data.id }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

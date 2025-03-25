
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Get environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Initialize Supabase client with admin privileges
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Set up CORS headers
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
    // Get the authenticated user from the request JWT
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error('No authorization token found');
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      throw new Error('User not authenticated');
    }
    
    const userId = user.id;
    
    // 1. Get total number of journal entries for the user
    const { count: totalEntries, error: entriesError } = await supabase
      .from('Journal Entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
      
    if (entriesError) {
      console.error('Error counting journal entries:', entriesError);
      throw entriesError;
    }
    
    // 2. Get entries with embeddings
    // First get the IDs of user's journal entries
    const { data: entryIds, error: idsError } = await supabase
      .from('Journal Entries')
      .select('id')
      .eq('user_id', userId);
      
    if (idsError) {
      console.error('Error getting entry IDs:', idsError);
      throw idsError;
    }
    
    // If no entries, return early
    if (!entryIds || entryIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          totalEntries: 0, 
          embeddedEntries: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Count entries with embeddings
    const { count: embeddedEntries, error: embeddingsError } = await supabase
      .from('journal_embeddings')
      .select('journal_entry_id', { count: 'exact', head: true })
      .in('journal_entry_id', entryIds.map(entry => entry.id));
      
    if (embeddingsError) {
      console.error('Error counting embeddings:', embeddingsError);
      throw embeddingsError;
    }
    
    // Return the results
    return new Response(
      JSON.stringify({ 
        totalEntries: totalEntries || 0, 
        embeddedEntries: embeddedEntries || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-embedding-status function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unknown error occurred',
        totalEntries: 0,
        embeddedEntries: 0
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

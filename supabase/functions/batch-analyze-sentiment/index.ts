
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Get environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const googleNLApiKey = Deno.env.get('GOOGLE_NL_API_KEY') || '';

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
    const { userId } = await req.json();
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log("Processing journal entries for user:", userId);
    
    // Create a Supabase client with the service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Fetch all journal entries that don't have sentiment analysis yet
    const { data: entries, error: fetchError } = await supabase
      .from('Journal Entries')
      .select('id, refined text')
      .eq('user_id', userId)
      .is('sentiment', null)
      .order('created_at', { ascending: false });
      
    if (fetchError) {
      console.error("Error fetching entries:", fetchError);
      throw fetchError;
    }
    
    console.log(`Found ${entries?.length || 0} entries to analyze`);
    
    // Process each entry
    const results = [];
    for (const entry of entries || []) {
      if (!entry["refined text"]) {
        console.log(`Skipping entry ${entry.id} - no refined text`);
        continue;
      }
      
      try {
        console.log(`Analyzing sentiment for entry ${entry.id}`);
        
        // Call Google Natural Language API
        const response = await fetch(`https://language.googleapis.com/v1/documents:analyzeSentiment?key=${googleNLApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            document: {
              type: 'PLAIN_TEXT',
              content: entry["refined text"],
            },
            encodingType: 'UTF8',
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Google NL API error for entry ${entry.id}:`, errorText);
          continue;
        }

        const result = await response.json();
        const sentimentScore = result.documentSentiment?.score;
        
        if (sentimentScore !== undefined) {
          // Update the entry in the database with the sentiment score
          const { error: updateError } = await supabase
            .from('Journal Entries')
            .update({ sentiment: sentimentScore.toString() })
            .eq('id', entry.id);
            
          if (updateError) {
            console.error(`Error updating entry ${entry.id} with sentiment:`, updateError);
          } else {
            console.log(`Updated entry ${entry.id} with sentiment score: ${sentimentScore}`);
            results.push({ id: entry.id, sentiment: sentimentScore });
          }
        }
      } catch (error) {
        console.error(`Error processing entry ${entry.id}:`, error);
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return new Response(
      JSON.stringify({ 
        processed: results.length,
        results 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error("Error in batch-analyze-sentiment function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

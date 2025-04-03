
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function analyzeSentiment(text: string) {
  try {
    console.log('Analyzing sentiment for text:', text.slice(0, 100) + '...');
    
    const googleNLApiKey = Deno.env.get('GOOGLE_API');
    
    if (!googleNLApiKey) {
      console.error('Google NL API key not found in environment');
      throw new Error('Google Natural Language API key is not configured');
    }
    
    // Call the Google Natural Language API
    const response = await fetch(`https://language.googleapis.com/v1/documents:analyzeSentiment?key=${googleNLApiKey}`, {
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
      console.error('Error analyzing sentiment:', error);
      throw new Error(`Failed to analyze sentiment: ${error}`);
    }

    const result = await response.json();
    console.log('Sentiment analysis complete:', JSON.stringify(result.documentSentiment, null, 2));
    
    // Return the document sentiment score
    return result.documentSentiment?.score;
  } catch (error) {
    console.error('Error in analyzeSentiment:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    console.log('Processing journal entries for user:', userId);

    if (!userId) {
      throw new Error('User ID is required');
    }

    // Fetch all entries from the database that don't have sentiment analysis yet
    const { data: entries, error: fetchError } = await supabase
      .from('Journal Entries')
      .select('id, "refined text"')
      .eq('user_id', userId)
      .is('sentiment', null);
    
    if (fetchError) {
      console.error('Error fetching entries:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${entries?.length || 0} entries to process`);
    let processedCount = 0;

    // Process each entry
    for (const entry of entries || []) {
      try {
        if (!entry["refined text"]) {
          console.log(`Skipping entry ${entry.id} - no refined text available`);
          continue;
        }

        const sentimentScore = await analyzeSentiment(entry["refined text"]);
        
        // Update the database with the sentiment score
        const { error: updateError } = await supabase
          .from('Journal Entries')
          .update({ sentiment: sentimentScore.toString() })
          .eq('id', entry.id);
        
        if (updateError) {
          console.error(`Error updating sentiment for entry ${entry.id}:`, updateError);
        } else {
          processedCount++;
          console.log(`Updated sentiment for entry ${entry.id}: ${sentimentScore}`);
        }
      } catch (error) {
        console.error(`Error processing entry ${entry.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        total: entries?.length || 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in batch-analyze-sentiment function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

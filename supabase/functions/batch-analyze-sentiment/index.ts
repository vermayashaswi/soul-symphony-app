import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getAuthenticatedContext, createAdminClient } from '../_shared/auth.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const googleNLApiKey = Deno.env.get('GOOGLE_API') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function analyzeSentiment(text: string) {
  try {
    console.log('Analyzing sentiment for text:', text.slice(0, 100) + '...');
    
    if (!googleNLApiKey) {
      console.error('Google API key not found in environment');
      throw new Error('Google Natural Language API key is not configured');
    }
    
    if (googleNLApiKey.length < 20 || !googleNLApiKey.includes('-')) {
      console.error('Google API key appears to be invalid:', googleNLApiKey.substring(0, 5) + '...');
      return 0;
    }
    
    console.log('Making request to Google NL API for sentiment analysis with UTF-8 encoding...');
    
    // Call the Google Natural Language API - specifying analyzeSentiment endpoint
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
        encodingType: 'UTF8'  // Added UTF-8 encoding parameter
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error analyzing sentiment:', error);
      
      // Try to parse the error for more details
      try {
        const errorJson = JSON.parse(error);
        console.error('Detailed error:', errorJson);
        
        // Check for specific error types
        if (errorJson.error && errorJson.error.status === 'INVALID_ARGUMENT') {
          console.error('Invalid argument error - check text format and encoding');
        } else if (errorJson.error && errorJson.error.status === 'PERMISSION_DENIED') {
          console.error('Permission denied - check API key permissions');
        }
      } catch (e) {
        // Continue if parsing fails
      }
      
      throw new Error(`Failed to analyze sentiment: ${error}`);
    }

    const result = await response.json();
    console.log('Sentiment analysis complete:', JSON.stringify(result.documentSentiment, null, 2));
    
    // Return the document sentiment score
    return result.documentSentiment?.score || 0;
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
    // Get authenticated context for RLS compliance
    const { supabase: authSupabase } = await getAuthenticatedContext(req);
    
    const reqData = await req.json();
    const { entryIds, processTranslated = false } = reqData;
    
    console.log('Processing authenticated request with params:', {
      entryIds: entryIds ? `[${entryIds.join(', ')}]` : 'not provided',
      hasGoogleApiKey: !!googleNLApiKey,
      processTranslated: processTranslated ? 'YES' : 'NO'
    });

    if (!googleNLApiKey) {
      throw new Error('Google API key is not configured in environment variables');
    }
    
    // Enhanced API key validation with better error message
    if (googleNLApiKey.length < 20 || !googleNLApiKey.includes('-')) {
      throw new Error('Google API key appears to be invalid (format check failed)');
    }

    let entries;
    
    // Check if specific entry IDs were provided
    if (entryIds && Array.isArray(entryIds) && entryIds.length > 0) {
      console.log(`Processing specific entries: ${entryIds.join(', ')}`);
      
      // Select the appropriate text field based on processTranslated flag
      const textField = processTranslated ? 'refined text' : 'refined text';
      
      const { data: specificEntries, error: fetchSpecificError } = await authSupabase
        .from('Journal Entries')
        .select(`id, "${textField}"`)
        .in('id', entryIds);
      
      if (fetchSpecificError) {
        throw fetchSpecificError;
      }
      
      entries = specificEntries;
    } 
    // Otherwise, if userId is provided, get entries for that user
    else if (userId) {
      console.log('Processing journal entries for user:', userId);
      
      // Select the appropriate text field based on processTranslated flag
      const textField = processTranslated ? 'refined text' : 'refined text';
      
      const { data: userEntries, error: fetchError } = await supabase
        .from('Journal Entries')
        .select(`id, "${textField}"`)
        .eq('user_id', userId)
        .is('sentiment', null);
      
      if (fetchError) {
        throw fetchError;
      }
      
      entries = userEntries;
    } else {
      throw new Error('Either userId or entryIds must be provided');
    }

    console.log(`Found ${entries?.length || 0} entries to process`);
    let processedCount = 0;
    let errorCount = 0;

    // Process each entry
    for (const entry of entries || []) {
      try {
        // Get the appropriate text field based on processTranslated flag
        const textField = processTranslated ? 'refined text' : 'refined text';
        const text = entry[textField];
        
        if (!text) {
          console.log(`Skipping entry ${entry.id} - no ${textField} available`);
          continue;
        }

        console.log(`Processing entry ${entry.id} with text: "${text.substring(0, 50)}..."`);
        console.log(`Using UTF-8 encoding for proper multilingual text analysis`);
        
        const sentimentScore = await analyzeSentiment(text);
        
        // Update the database with the sentiment score (uses authenticated context)
        const { error: updateError } = await authSupabase
          .from('Journal Entries')
          .update({ sentiment: sentimentScore.toString() })
          .eq('id', entry.id);
        
        if (updateError) {
          console.error(`Error updating sentiment for entry ${entry.id}:`, updateError);
          errorCount++;
        } else {
          processedCount++;
          console.log(`Updated sentiment for entry ${entry.id}: ${sentimentScore}`);
          
          // Categorize the sentiment
          let sentimentCategory;
          if (sentimentScore >= 0.3) {
            sentimentCategory = "positive";
          } else if (sentimentScore >= -0.1) {
            sentimentCategory = "neutral";
          } else {
            sentimentCategory = "negative";
          }
          
          console.log(`Sentiment category for entry ${entry.id}: ${sentimentCategory}`);
        }
      } catch (error) {
        console.error(`Error processing entry ${entry.id}:`, error);
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        errors: errorCount,
        total: entries?.length || 0,
        processedTranslated: processTranslated
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

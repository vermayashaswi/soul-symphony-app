
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
      const googleNlApiKey = Deno.env.get('GOOGLE_API');
      const googleNlApiConfigured = !!googleNlApiKey;
      
      console.log(`Google API key from env: ${googleNlApiConfigured ? 'Found' : 'Not found'}`);
      if (googleNlApiKey) {
        console.log(`API key length: ${googleNlApiKey.length}, starts with: ${googleNlApiKey.substring(0, 5)}...`);
      }
      
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Regular sentiment analysis logic...
    const { text, entryId, processTranslated = false } = requestData;
    
    if (!text) {
      throw new Error("No text provided for analysis");
    }
    
    console.log(`Processing text for sentiment analysis${entryId ? ` (Entry ID: ${entryId})` : ''}:`, 
              text.length > 100 ? text.slice(0, 100) + '...' : text);
    console.log(`Processing translated content: ${processTranslated ? 'YES' : 'NO'}`);
    
    // Get the Google Natural Language API key directly from environment
    const apiKey = Deno.env.get('GOOGLE_API');
    
    if (!apiKey) {
      throw new Error("Google API key is not configured");
    }
    
    // Improved API key validation - less restrictive
    if (apiKey.length < 10) {
      console.error('Google NL API key appears invalid (too short)');
      throw new Error("Google API key appears to be invalid");
    }
    
    console.log('Analyzing sentiment using Google NL API with UTF-8 encoding...');
    console.log(`API key configured: ${apiKey.length} characters, starts with: ${apiKey.substring(0, 5)}...`);
    
    // Call the Google Natural Language API specifically for sentiment analysis
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
        encodingType: 'UTF8'  // Added UTF-8 encoding parameter
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Google NL API error:', error);
      
      // Try to parse the error for more details
      try {
        const errorJson = JSON.parse(error);
        console.error('Detailed API error:', errorJson);
        
        // Check for common errors
        if (errorJson.error && errorJson.error.status === 'INVALID_ARGUMENT') {
          console.error('Invalid argument error - check text format');
          throw new Error(`Google API error: Invalid argument - check text format and encoding`);
        } else if (errorJson.error && errorJson.error.status === 'PERMISSION_DENIED') {
          console.error('Permission denied - check API key permissions');
          throw new Error(`Google API error: Permission denied - check API key permissions`);
        } else if (errorJson.error && errorJson.error.status === 'UNAUTHENTICATED') {
          console.error('Unauthenticated - API key may be invalid');
          throw new Error(`Google API error: Authentication failed - check API key`);
        } else if (errorJson.error && errorJson.error.message) {
          throw new Error(`Google API error: ${errorJson.error.message}`);
        }
      } catch (e) {
        if (e.message && e.message.includes("Google API error:")) {
          throw e; // Re-throw our enhanced error message
        }
      }
      
      throw new Error(`Google API error: ${error}`);
    }

    const result = await response.json();
    const sentimentScore = result.documentSentiment?.score?.toString() || "0";
    
    console.log('Sentiment analysis result:', result);
    console.log('Sentiment score:', sentimentScore);
    
    // Categorize the sentiment according to the specified ranges
    let sentimentCategory;
    const score = parseFloat(sentimentScore);
    
    if (score >= 0.3) {
      sentimentCategory = "positive";
    } else if (score >= -0.1) {
      sentimentCategory = "neutral";
    } else {
      sentimentCategory = "negative";
    }
    
    console.log('Sentiment category:', sentimentCategory);
    
    // If an entry ID was provided, update the entry directly
    if (entryId && Deno.env.get('SUPABASE_URL') && Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        console.log(`Updating sentiment directly for entry ID: ${entryId}`);
        
        const { error: updateError } = await supabase
          .from('Journal Entries')
          .update({ sentiment: sentimentScore })
          .eq('id', entryId);
          
        if (updateError) {
          console.error('Error updating sentiment in database:', updateError);
        } else {
          console.log(`Successfully updated sentiment for entry ID: ${entryId}`);
        }
      } catch (updateError) {
        console.error('Error updating entry sentiment:', updateError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        sentiment: sentimentScore,
        category: sentimentCategory,
        success: true,
        processedTranslated: processTranslated
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


import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { getAuthenticatedContext, createAdminClient } from '../_shared/auth.ts';

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

    // FIXED: Enhanced sentiment analysis with entity extraction
    const { text, entryId, processTranslated = false, extractEntities = false } = requestData;
    
    if (!text) {
      throw new Error("No text provided for analysis");
    }
    
    console.log(`FIXED: Processing text for sentiment analysis${entryId ? ` (Entry ID: ${entryId})` : ''}:`, 
              text.length > 100 ? text.slice(0, 100) + '...' : text);
    console.log(`FIXED: Processing translated content: ${processTranslated ? 'YES' : 'NO'}`);
    console.log(`FIXED: Extract entities: ${extractEntities ? 'YES' : 'NO'}`);
    
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
    
    console.log('FIXED: Analyzing sentiment using Google NL API with UTF-8 encoding...');
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
    const sentimentScore = result.documentSentiment?.score?.toString() || null;
    
    console.log('FIXED: Sentiment analysis result:', result);
    console.log('FIXED: Sentiment score:', sentimentScore);
    
    // Categorize the sentiment according to the specified ranges
    let sentimentCategory = null;
    
    if (sentimentScore !== null) {
      const score = parseFloat(sentimentScore);
      
      if (score >= 0.3) {
        sentimentCategory = "positive";
      } else if (score >= -0.1) {
        sentimentCategory = "neutral";
      } else {
        sentimentCategory = "negative";
      }
    }
    
    console.log('FIXED: Sentiment category:', sentimentCategory);
    
    // FIXED: Entity extraction using Google NL API if requested
    let entities = null;
    if (extractEntities && entryId) {
      try {
        console.log('FIXED: Extracting entities using Google NL API...');
        
        const entityResponse = await fetch(`https://language.googleapis.com/v1/documents:analyzeEntities?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            document: {
              type: 'PLAIN_TEXT',
              content: text,
            },
            encodingType: 'UTF8'
          }),
        });

        if (entityResponse.ok) {
          const entityResult = await entityResponse.json();
          
          // Process entities into our format
          const extractedEntities = {};
          
          if (entityResult.entities && Array.isArray(entityResult.entities)) {
            entityResult.entities.forEach(entity => {
              const entityType = entity.type || 'OTHER';
              const entityName = entity.name;
              
              if (!extractedEntities[entityType]) {
                extractedEntities[entityType] = [];
              }
              
              if (!extractedEntities[entityType].includes(entityName)) {
                extractedEntities[entityType].push(entityName);
              }
            });
          }
          
          entities = extractedEntities;
          console.log('FIXED: Entities extracted:', entities);
        } else {
          console.error('FIXED: Entity extraction failed, but continuing with sentiment analysis');
        }
      } catch (entityError) {
        console.error('FIXED: Error extracting entities:', entityError);
        // Continue without entities
      }
    }
    
    // If an entry ID was provided, update the entry using authenticated context
    if (entryId) {
      try {
        // Get authenticated context for RLS compliance
        const { supabase: authSupabase } = await getAuthenticatedContext(req);
        
        console.log(`FIXED: Updating sentiment and entities for entry ID: ${entryId}`);
        
        // FIXED: Update both sentiment and entities if available
        const updateData: any = { sentiment: sentimentScore };
        if (entities) {
          updateData.entities = entities;
        }
        
        const { error: updateError } = await authSupabase
          .from('Journal Entries')
          .update(updateData)
          .eq('id', entryId);
          
        if (updateError) {
          console.error('FIXED: Error updating entry in database:', updateError);
        } else {
          console.log(`FIXED: Successfully updated entry ${entryId} with sentiment${entities ? ' and entities' : ''}`);
        }
      } catch (updateError) {
        console.error('FIXED: Error updating entry:', updateError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        sentiment: sentimentScore,
        category: sentimentCategory,
        entities: entities,
        success: true,
        processedTranslated: processTranslated,
        extractedEntities: extractEntities
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error("FIXED: Error in analyze-sentiment function:", error);
    
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

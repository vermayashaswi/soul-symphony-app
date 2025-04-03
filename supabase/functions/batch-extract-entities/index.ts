
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

// Get Google NL API key from Supabase secrets
const GOOGLE_NL_API_KEY = Deno.env.get('GOOGLE_API');

async function analyzeWithGoogleNL(text: string) {
  try {
    console.log('Analyzing text with Google NL API for entities:', text.slice(0, 100) + '...');
    
    if (!GOOGLE_NL_API_KEY) {
      console.error('Google NL API key not found in environment');
      throw new Error('Google API key is not configured in Supabase secrets');
    }
    
    console.log('Using Google NL API key from Supabase secrets');
    
    // Using the correct endpoint for entity extraction
    const response = await fetch(`https://language.googleapis.com/v1/documents:analyzeEntities?key=${GOOGLE_NL_API_KEY}`, {
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
      const errorText = await response.text();
      console.error('Error analyzing with Google NL API:', errorText);
      
      // Try to parse the error to check if it's a permission/quota error
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error && errorJson.error.status === "PERMISSION_DENIED") {
          return { error: "API access denied. The API key may not have access to the Natural Language API or has reached its quota." };
        }
      } catch (e) {
        // Ignore parsing error
      }
      
      return { error: `API error (${response.status}): ${errorText.substring(0, 100)}...` };
    }

    const result = await response.json();
    console.log('Google NL API analysis complete');
    
    // Process and format entities
    const formattedEntities = result.entities?.map(entity => ({
      type: mapEntityType(entity.type),
      name: entity.name
    })) || [];
    
    // Remove duplicate entities
    const uniqueEntities = removeDuplicateEntities(formattedEntities);
    
    console.log(`Extracted ${uniqueEntities.length} entities`);
    
    return { entities: uniqueEntities };
  } catch (error) {
    console.error('Error in analyzeWithGoogleNL:', error);
    return { error: error.message };
  }
}

function mapEntityType(googleEntityType: string): string {
  switch (googleEntityType) {
    case 'PERSON':
      return 'person';
    case 'LOCATION':
    case 'ADDRESS':
      return 'place';
    case 'ORGANIZATION':
    case 'CONSUMER_GOOD':
    case 'WORK_OF_ART':
      return 'organization';
    case 'EVENT':
      return 'event';
    case 'OTHER':
    default:
      return 'other';
  }
}

function removeDuplicateEntities(entities: Array<{type: string, name: string}>): Array<{type: string, name: string}> {
  const seen = new Set();
  return entities.filter(entity => {
    const key = `${entity.type}:${entity.name.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function processEntries(userId?: string, processAll: boolean = false, diagnosticMode: boolean = false) {
  try {
    console.log('Starting batch entity extraction process');
    const startTime = Date.now();
    
    // We're using the hardcoded API key so no need to check environment
    console.log('Using hardcoded Google NL API key');
    
    // Diagnostic information to return
    const diagnosticInfo: any = {
      startTime: new Date().toISOString(),
      processAll: processAll,
      userId: userId || 'not provided',
      supabaseClientInitialized: !!supabase,
      googleNLApiKeyConfigured: true,
      userIdFilter: !!userId
    };
    
    // Build the query
    let query = supabase
      .from('Journal Entries')
      .select('id, "refined text"');
    
    // If processAll is false, only process entries with null entities
    if (!processAll) {
      query = query.is('entities', null);
    }
    
    // Add user filter if provided and requested - now optional
    if (userId) {
      console.log(`Filtering entries for user ID: ${userId}`);
      query = query.eq('user_id', userId);
    } else {
      console.log('Processing entries for ALL users');
    }
    
    // Order by most recent first
    query = query.order('created_at', { ascending: false });

    // In diagnostic mode, limit to a few entries to avoid unnecessary processing
    if (diagnosticMode) {
      query = query.limit(5);
    }
    
    // Execute the query
    const { data: entries, error } = await query;
    
    diagnosticInfo.querySuccess = !error;
    diagnosticInfo.queryError = error ? error.message : null;
    diagnosticInfo.entriesFound = entries?.length || 0;
    
    if (error) {
      console.error('Error fetching entries:', error);
      return { 
        success: false, 
        error: error.message, 
        processed: 0, 
        total: 0,
        diagnosticInfo
      };
    }
    
    console.log(`Found ${entries?.length || 0} entries to process`);
    
    let processed = 0;
    let failed = 0;
    const processingDetails: any[] = [];
    const errors: any[] = [];
    
    // Exit early if no entries to process
    if (!entries || entries.length === 0) {
      console.log('No entries to process');
      return { 
        success: true, 
        processed: 0, 
        total: 0, 
        processingTime: "0 seconds",
        diagnosticInfo
      };
    }
    
    for (const entry of entries) {
      if (!entry["refined text"]) {
        console.log(`Skipping entry ${entry.id} - no refined text`);
        processingDetails.push({
          entryId: entry.id,
          skipped: true,
          reason: 'No refined text'
        });
        continue;
      }
      
      try {
        console.log(`Processing entry ${entry.id}`);
        
        // Extract entities using Google NL API
        const result = await analyzeWithGoogleNL(entry["refined text"]);
        
        const entryDetails: any = {
          entryId: entry.id,
          hasRefinedText: true,
          textLength: entry["refined text"].length,
          textSample: entry["refined text"].substring(0, 100) + '...'
        };
        
        // Handle API error
        if (result.error) {
          console.error(`API error for entry ${entry.id}:`, result.error);
          entryDetails.error = result.error;
          errors.push({
            entryId: entry.id,
            error: result.error
          });
          failed++;
          processingDetails.push(entryDetails);
          continue;
        }
        
        const entities = result.entities || [];
        
        entryDetails.entitiesExtracted = entities.length;
        entryDetails.entities = entities;
        entryDetails.entityTypes = entities.map(e => e.type);
        entryDetails.entityNames = entities.map(e => e.name);
        processingDetails.push(entryDetails);
        
        if (entities && entities.length > 0) {
          console.log(`Extracted ${entities.length} entities for entry ${entry.id}:`, JSON.stringify(entities));
        } else {
          console.log(`No entities found for entry ${entry.id}`);
        }
        
        // Only update if not in diagnostic mode
        if (!diagnosticMode) {
          const { error: updateError } = await supabase
            .from('Journal Entries')
            .update({ entities: entities })
            .eq('id', entry.id);
            
          if (updateError) {
            console.error(`Error updating entry ${entry.id}:`, updateError);
            entryDetails.updateError = updateError.message;
            failed++;
          } else {
            processed++;
            if (entities && entities.length > 0) {
              console.log(`Updated entry ${entry.id} with ${entities.length} entities`);
            } else {
              console.log(`Updated entry ${entry.id} with empty entities array`);
            }
          }
        } else {
          // In diagnostic mode, simulate success
          processed++;
        }
      } catch (entryError) {
        console.error(`Error processing entry ${entry.id}:`, entryError);
        processingDetails.push({
          entryId: entry.id,
          error: entryError.message
        });
        failed++;
      }
      
      // Add a small delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    diagnosticInfo.processingDetails = processingDetails;
    diagnosticInfo.errors = errors;
    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000;
    
    console.log(`Processed ${processed} entries in ${processingTime.toFixed(3)} seconds`);
    
    return { 
      success: true, 
      processed, 
      failed,
      total: entries?.length || 0,
      processingTime: `${processingTime.toFixed(3)} seconds`,
      diagnosticInfo,
      errors: errors.length > 0 ? errors.slice(0, 5) : []
    };
  } catch (error) {
    console.error('Fatal error in processEntries:', error);
    return { 
      success: false, 
      error: error.message, 
      processed: 0, 
      total: 0,
      diagnosticInfo: {
        error: error.message,
        stack: error.stack
      }
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the request body if any
    let userId = undefined;
    let processAll = true; // Default to processing all entries
    let diagnosticMode = false;
    
    try {
      if (req.method === 'POST') {
        const body = await req.json();
        userId = body.userId; // Make userId optional
        processAll = body.processAll === true || body.processAll === undefined; // Default to true
        diagnosticMode = body.diagnosticMode === true;
      }
    } catch (e) {
      console.log('No request body or invalid JSON:', e);
    }
    
    console.log('Request parameters:', { 
      userId, 
      processAll, 
      diagnosticMode
    });
    
    const result = await processEntries(userId, processAll, diagnosticMode);
    
    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('Error in batch-extract-entities function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

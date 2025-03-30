
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function extractEntities(text: string) {
  try {
    console.log(`[DEBUG] Starting entity extraction for text: "${text.substring(0, 100)}..."`);
    
    if (!openAIApiKey) {
      console.error('OpenAI API key is missing or empty');
      throw new Error('OpenAI API key is not configured');
    }
    
    // Using the exact same prompt format that worked for the transcribe-audio function
    // This is the key to ensuring consistent results
    const prompt = `
      Extract named entities from the following journal entry.
      
      Journal entry:
      ${text}
      
      For each entity found, return:
      - "type": One of: person, organization, location, event, product, technology
      - "name": The entity name exactly as mentioned in the text
      
      Return only a simple JSON array of found entities like:
      [
        {"type": "person", "name": "John"},
        {"type": "organization", "name": "Microsoft"},
        {"type": "location", "name": "New York"}
      ]
      
      If no entities are found, return an empty array: []
      
      Focus on extracting real named entities only - people, places, organizations, specific products, etc.
      Do not include common nouns, abstract concepts, or general terms.
    `;
    
    console.log(`[DEBUG] Sending request to OpenAI with model: gpt-4o-mini`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an entity extraction assistant. Extract named entities from journal entries following the exact format requested.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,  // Lower temperature for more consistent results
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ERROR] OpenAI API error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Failed to extract entities: ${errorText}`);
    }

    const result = await response.json();
    console.log(`[DEBUG] Raw response from OpenAI:`, JSON.stringify(result, null, 2));
    
    // Extract the content from the response
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      console.error('[ERROR] Invalid response structure from OpenAI');
      return [];
    }
    
    const entitiesText = result.choices[0].message.content;
    console.log(`[DEBUG] Entities response text:`, entitiesText);
    
    try {
      // Parse the JSON response
      const parsedContent = JSON.parse(entitiesText);
      
      // Handle different possible formats
      if (Array.isArray(parsedContent)) {
        console.log(`[DEBUG] Successfully extracted ${parsedContent.length} entities:`, JSON.stringify(parsedContent));
        return parsedContent;
      } else if (parsedContent && typeof parsedContent === 'object') {
        // If the response is an object with an entities property
        if (Array.isArray(parsedContent.entities)) {
          console.log(`[DEBUG] Successfully extracted ${parsedContent.entities.length} entities from .entities property:`, JSON.stringify(parsedContent.entities));
          return parsedContent.entities;
        }
        // If we received a single entity
        else if (parsedContent.type && parsedContent.name) {
          console.log(`[DEBUG] Extracted single entity:`, JSON.stringify([parsedContent]));
          return [parsedContent];
        }
      }
      
      console.log('[DEBUG] No recognized entity structure found, returning empty array');
      return [];
    } catch (err) {
      console.error('[ERROR] Error parsing entities JSON:', err);
      console.error('[ERROR] Raw entities text:', entitiesText);
      return [];
    }
  } catch (error) {
    console.error('[ERROR] Error in extractEntities:', error);
    return [];
  }
}

async function processEntries(userId?: string, processAll: boolean = false, diagnosticMode: boolean = false, testText?: string, testExtraction: boolean = false) {
  try {
    console.log('[DEBUG] processEntries function called with params:', { 
      userId, 
      processAll, 
      diagnosticMode, 
      testExtractionRequested: testExtraction && !!testText 
    });
    
    // Special case: If test extraction is requested, just process the test text
    if (testExtraction && testText) {
      console.log('[DEBUG] Running test extraction on provided text:', testText.substring(0, 100) + '...');
      const entities = await extractEntities(testText);
      
      const diagnosticInfo = {
        testText: testText.substring(0, 100) + '...',
        entitiesCount: entities.length,
        entities,
        openAiKeyAvailable: !!openAIApiKey,
        openAiKeyLength: openAIApiKey ? openAIApiKey.length : 0,
        supabaseClientInitialized: !!supabase
      };
      
      console.log('[DEBUG] Test extraction results:', JSON.stringify({
        success: true,
        entitiesFound: entities.length,
        entities,
      }));
      
      return {
        success: true,
        testMode: true,
        entities,
        diagnosticInfo
      };
    }
    
    console.log('[DEBUG] Starting batch entity extraction process');
    const startTime = Date.now();
    
    // Diagnostic information to return
    const diagnosticInfo: any = {
      startTime: new Date().toISOString(),
      processAll: processAll,
      userId: userId || 'not provided',
      supabaseClientInitialized: !!supabase,
      openAIKeyConfigured: !!openAIApiKey,
      openAIKeyLength: openAIApiKey ? openAIApiKey.length : 0,
      userIdFilter: !!userId,
      queryParams: {
        table: 'Journal Entries',
        isNullFilter: !processAll,
        orderBy: 'created_at',
        limit: diagnosticMode ? 5 : undefined
      }
    };
    
    // Build the query
    let query = supabase
      .from('Journal Entries')
      .select('id, "refined text"');
    
    // If processAll is false, only process entries with null entities
    if (!processAll) {
      query = query.is('entities', null);
    }
    
    // Add user filter if provided
    if (userId) {
      console.log(`[DEBUG] Filtering entries for user ID: ${userId}`);
      query = query.eq('user_id', userId);
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
      console.error('[ERROR] Error fetching entries:', error);
      return { 
        success: false, 
        error: error.message, 
        processed: 0, 
        total: 0,
        diagnosticInfo
      };
    }
    
    console.log(`[DEBUG] Found ${entries?.length || 0} entries to process`);
    
    let processed = 0;
    const processingDetails: any[] = [];
    
    // Exit early if no entries to process
    if (!entries || entries.length === 0) {
      console.log('[DEBUG] No entries to process');
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
        console.log(`[DEBUG] Skipping entry ${entry.id} - no refined text`);
        processingDetails.push({
          entryId: entry.id,
          skipped: true,
          reason: 'No refined text'
        });
        continue;
      }
      
      try {
        console.log(`[DEBUG] Processing entry ${entry.id}`);
        
        // For diagnostic mode, still call the actual API to test it
        const entities = await extractEntities(entry["refined text"]);
        
        const entryDetails = {
          entryId: entry.id,
          hasRefinedText: true,
          textLength: entry["refined text"].length,
          textSample: entry["refined text"].substring(0, 100) + '...',
          entitiesExtracted: entities.length,
          entities: entities,
          entityTypes: entities.map(e => e.type),
          entityNames: entities.map(e => e.name)
        };
        processingDetails.push(entryDetails);
        
        if (entities && entities.length > 0) {
          console.log(`[DEBUG] Extracted ${entities.length} entities for entry ${entry.id}:`, JSON.stringify(entities));
        } else {
          console.log(`[DEBUG] No entities found for entry ${entry.id}`);
        }
        
        // Only update if not in diagnostic mode or explicitly requested
        if (!diagnosticMode) {
          const { error: updateError } = await supabase
            .from('Journal Entries')
            .update({ entities: entities })
            .eq('id', entry.id);
            
          if (updateError) {
            console.error(`[ERROR] Error updating entry ${entry.id}:`, updateError);
            entryDetails.updateError = updateError.message;
          } else {
            processed++;
            if (entities && entities.length > 0) {
              console.log(`[DEBUG] Updated entry ${entry.id} with ${entities.length} entities`);
            } else {
              console.log(`[DEBUG] Updated entry ${entry.id} with empty entities array`);
            }
          }
        } else {
          // In diagnostic mode, simulate success
          processed++;
        }
      } catch (entryError) {
        console.error(`[ERROR] Error processing entry ${entry.id}:`, entryError);
        processingDetails.push({
          entryId: entry.id,
          error: entryError.message
        });
      }
      
      // Add a small delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    diagnosticInfo.processingDetails = processingDetails;
    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000;
    
    console.log(`[DEBUG] Processed ${processed} entries in ${processingTime.toFixed(3)} seconds`);
    
    return { 
      success: true, 
      processed, 
      total: entries?.length || 0,
      processingTime: `${processingTime.toFixed(3)} seconds`,
      diagnosticInfo
    };
  } catch (error) {
    console.error('[ERROR] Fatal error in processEntries:', error);
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
    let processAll = false;
    let diagnosticMode = false;
    let testText = undefined;
    let testExtraction = false;
    let debugEnv = false;
    
    try {
      if (req.method === 'POST') {
        const body = await req.json();
        userId = body.userId;
        processAll = body.processAll === true;
        diagnosticMode = body.diagnosticMode === true;
        testText = body.testText;
        testExtraction = body.testExtraction === true;
        debugEnv = body.debugEnv === true;
      }
    } catch (e) {
      console.log('[DEBUG] No request body or invalid JSON:', e);
    }
    
    console.log('[DEBUG] Request parameters:', { 
      userId, 
      processAll, 
      diagnosticMode, 
      testExtraction: testExtraction && !!testText,
      debugEnv
    });
    
    let result;
    
    // Special case to return environment diagnostics
    if (debugEnv) {
      result = {
        success: true,
        diagnostics: {
          environment: {
            openAIKeyConfigured: !!openAIApiKey,
            openAIKeyLength: openAIApiKey ? openAIApiKey.length : 0,
            supabaseUrlConfigured: !!supabaseUrl,
            supabaseUrlLength: supabaseUrl ? supabaseUrl.length : 0,
            supabaseServiceKeyConfigured: !!supabaseServiceKey,
            supabaseServiceKeyLength: supabaseServiceKey ? supabaseServiceKey.length : 0,
            supabaseClientInitialized: !!supabase
          }
        }
      };
    } else {
      result = await processEntries(userId, processAll, diagnosticMode, testText, testExtraction);
    }
    
    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('[ERROR] Error in batch-extract-entities function:', error);
    
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

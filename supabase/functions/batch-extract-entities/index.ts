
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
    console.log('Extracting entities from text:', text.substring(0, 100) + '...');
    
    if (!openAIApiKey) {
      console.error('OpenAI API key is missing or empty');
      throw new Error('OpenAI API key is not configured');
    }
    
    // Using the exact same prompt format that worked for the new entry
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
            content: `Extract named entities from the journal entry.
            
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
            Do not include common nouns, abstract concepts, or general terms.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error extracting entities:', errorText);
      throw new Error(`Failed to extract entities: ${errorText}`);
    }

    const result = await response.json();
    console.log('Raw response from OpenAI:', JSON.stringify(result, null, 2));
    
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      console.error('Invalid response structure from OpenAI');
      return [];
    }
    
    const entitiesText = result.choices[0].message.content;
    console.log('Entities response text:', entitiesText);
    
    try {
      // Parse the JSON response
      const parsedResponse = JSON.parse(entitiesText);
      
      if (Array.isArray(parsedResponse)) {
        // Direct array format: [{...}, {...}]
        console.log('Extracted entities from array:', parsedResponse);
        return parsedResponse;
      } else if (parsedResponse && typeof parsedResponse === 'object') {
        // If response has an array property
        for (const key in parsedResponse) {
          if (Array.isArray(parsedResponse[key])) {
            console.log(`Extracted entities from "${key}" property:`, parsedResponse[key]);
            return parsedResponse[key];
          }
        }
        
        // If the response is a single entity
        if (parsedResponse.type && parsedResponse.name) {
          console.log('Extracted single entity:', [parsedResponse]);
          return [parsedResponse];
        }
      }
      
      // If we get here, no valid entity structure was found
      console.log('No recognized entity structure found, returning empty array');
      return [];
    } catch (err) {
      console.error('Error parsing entities JSON:', err);
      console.error('Raw entities text:', entitiesText);
      return [];
    }
  } catch (error) {
    console.error('Error in extractEntities:', error);
    return [];
  }
}

async function processEntries(userId?: string, processAll: boolean = false, diagnosticMode: boolean = false, testText?: string, testExtraction: boolean = false) {
  try {
    // Special case: If test extraction is requested, just process the test text
    if (testExtraction && testText) {
      console.log('Running test extraction on provided text');
      const entities = await extractEntities(testText);
      return {
        success: true,
        testMode: true,
        entities,
        diagnosticInfo: {
          testText: testText.substring(0, 100) + '...',
          entitiesCount: entities.length
        }
      };
    }
    
    console.log('Starting batch entity extraction process');
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
      console.log(`Filtering entries for user ID: ${userId}`);
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
    const processingDetails: any[] = [];
    
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
        
        // For diagnostic mode, still call the actual API to test it
        const entities = await extractEntities(entry["refined text"]);
        
        const entryDetails = {
          entryId: entry.id,
          hasRefinedText: true,
          textLength: entry["refined text"].length,
          entitiesExtracted: entities.length,
          firstEntity: entities.length > 0 ? entities[0] : null,
          entityTypes: entities.map(e => e.type),
          entityNames: entities.map(e => e.name)
        };
        processingDetails.push(entryDetails);
        
        if (entities && entities.length > 0) {
          console.log(`Extracted ${entities.length} entities for entry ${entry.id}:`, JSON.stringify(entities));
        } else {
          console.log(`No entities found for entry ${entry.id}`);
        }
        
        // Only update if not in diagnostic mode or explicitly requested
        if (!diagnosticMode) {
          const { error: updateError } = await supabase
            .from('Journal Entries')
            .update({ entities: entities })
            .eq('id', entry.id);
            
          if (updateError) {
            console.error(`Error updating entry ${entry.id}:`, updateError);
            entryDetails.updateError = updateError.message;
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
      }
      
      // Add a small delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    diagnosticInfo.processingDetails = processingDetails;
    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000;
    
    console.log(`Processed ${processed} entries in ${processingTime.toFixed(3)} seconds`);
    
    return { 
      success: true, 
      processed, 
      total: entries?.length || 0,
      processingTime: `${processingTime.toFixed(3)} seconds`,
      diagnosticInfo
    };
  } catch (error) {
    console.error('Error in processEntries:', error);
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
    
    try {
      if (req.method === 'POST') {
        const body = await req.json();
        userId = body.userId;
        processAll = body.processAll === true;
        diagnosticMode = body.diagnosticMode === true;
        testText = body.testText;
        testExtraction = body.testExtraction === true;
      }
    } catch (e) {
      console.log('No request body or invalid JSON');
    }
    
    console.log('Request parameters:', { userId, processAll, diagnosticMode, testExtraction: testExtraction && !!testText });
    
    const result = await processEntries(userId, processAll, diagnosticMode, testText, testExtraction);
    
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

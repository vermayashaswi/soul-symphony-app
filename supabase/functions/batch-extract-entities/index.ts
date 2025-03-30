
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
    
    // Using a more specific prompt to extract entities in the correct format
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
            content: `You are an entity extraction system. Extract entities from journal entries in JSON format.
            
            For each entity you identify, provide:
            1. "type": The category (person, organization, location, project, event, product, technology)
            2. "name": The specific entity name
            
            Return ONLY a valid JSON array of objects like:
            [
              {"type": "person", "name": "John Doe"},
              {"type": "location", "name": "New York"}
            ]
            
            If no entities are found, return an empty array: []
            Do not add any explanatory text - respond with a valid JSON array only.`
          },
          {
            role: 'user',
            content: `Here is a journal entry of a person: "${text}". Extract all entities and return them as a JSON array.`
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
    console.log('Raw response from OpenAI:', result);
    
    const entitiesText = result.choices[0].message.content;
    console.log('Entities response text:', entitiesText);
    
    try {
      // Parse the JSON response
      const parsedResponse = JSON.parse(entitiesText);
      
      // If it's an object with an "entities" property, use that
      if (parsedResponse.entities) {
        console.log('Parsed entities from "entities" property:', JSON.stringify(parsedResponse.entities));
        return parsedResponse.entities;
      }
      
      // If it's an array directly, use that
      if (Array.isArray(parsedResponse)) {
        console.log('Parsed entities array:', JSON.stringify(parsedResponse));
        return parsedResponse;
      }
      
      // Fallback - should rarely happen with the improved prompt
      console.log('No entities structure found, returning empty array');
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

async function processEntries(userId?: string, processAll: boolean = false) {
  try {
    console.log('Starting batch entity extraction process');
    
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
    
    // Execute the query
    const { data: entries, error } = await query;
      
    if (error) {
      console.error('Error fetching entries:', error);
      return { success: false, error: error.message, processed: 0, total: 0 };
    }
    
    console.log(`Found ${entries?.length || 0} entries to process`);
    
    let processed = 0;
    
    // Exit early if no entries to process
    if (!entries || entries.length === 0) {
      return { success: true, processed: 0, total: 0, processingTime: "0 seconds" };
    }
    
    for (const entry of entries || []) {
      if (!entry["refined text"]) {
        console.log(`Skipping entry ${entry.id} - no refined text`);
        continue;
      }
      
      try {
        console.log(`Processing entry ${entry.id}`);
        const entities = await extractEntities(entry["refined text"]);
        
        if (entities && entities.length > 0) {
          console.log(`Extracted ${entities.length} entities for entry ${entry.id}:`, JSON.stringify(entities));
        } else {
          console.log(`No entities found for entry ${entry.id}`);
        }
        
        // Always update the entry, even with an empty array
        const { error: updateError } = await supabase
          .from('Journal Entries')
          .update({ entities: entities })
          .eq('id', entry.id);
          
        if (updateError) {
          console.error(`Error updating entry ${entry.id}:`, updateError);
        } else {
          processed++;
          if (entities && entities.length > 0) {
            console.log(`Updated entry ${entry.id} with ${entities.length} entities`);
          } else {
            console.log(`Updated entry ${entry.id} with empty entities array`);
          }
        }
      } catch (entryError) {
        console.error(`Error processing entry ${entry.id}:`, entryError);
      }
      
      // Add a small delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return { success: true, processed, total: entries?.length || 0 };
  } catch (error) {
    console.error('Error in processEntries:', error);
    return { success: false, error: error.message, processed: 0, total: 0 };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    console.log('Starting batch entity extraction process');
    
    // Get the request body if any
    let userId = undefined;
    let processAll = false;
    
    try {
      if (req.method === 'POST') {
        const body = await req.json();
        userId = body.userId;
        processAll = body.processAll === true;
      }
    } catch (e) {
      console.log('No request body or invalid JSON');
    }
    
    const result = await processEntries(userId, processAll);
    
    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000;
    
    console.log(`Processing completed in ${processingTime} seconds`);
    console.log(`Processed ${result.processed} entries`);
    
    return new Response(
      JSON.stringify({ 
        ...result, 
        processingTime: `${processingTime.toFixed(3)} seconds` 
      }),
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

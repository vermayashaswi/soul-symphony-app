
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
            content: `You are an entity extraction system. Your task is to extract named entities from the journal entry text.
            
            Analyze the journal entry carefully to identify:
            - People (specific individuals mentioned)
            - Organizations (companies, institutions, groups)
            - Locations (places, cities, countries)
            - Projects (work tasks, assignments)
            - Events (meetings, occasions, happenings)
            - Products (specific items or services)
            - Technologies (software, platforms, tools)
            
            Return ONLY a JSON object with this exact format: 
            {"entities": [{"type": "person", "name": "John Doe"}, {"type": "location", "name": "New York"}, etc.]}
            
            If no entities are found, return: {"entities": []}
            Do not add any explanations or text outside the JSON.`
          },
          {
            role: 'user',
            content: `Here is a journal entry of a person: "${text}". Extract all entities and return them in JSON format.`
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
    const entitiesText = result.choices[0].message.content;
    
    console.log('Raw entities response:', entitiesText);
    
    try {
      // Parse the JSON response
      const parsedResponse = JSON.parse(entitiesText);
      
      // Log the parsed response to help with debugging
      console.log('Parsed entities response:', JSON.stringify(parsedResponse));
      
      // Return the entities array, with a fallback to an empty array
      return parsedResponse.entities || [];
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

async function processEntries() {
  try {
    // Fetch all entries that don't have entities yet
    const { data: entries, error } = await supabase
      .from('Journal Entries')
      .select('id, "refined text"')
      .is('entities', null)
      .order('created_at', { ascending: false });
      
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
        
        console.log(`Extracted entities for entry ${entry.id}:`, JSON.stringify(entities));
        
        // Update the entry with the entities, even if it's an empty array
        const { error: updateError } = await supabase
          .from('Journal Entries')
          .update({ entities: entities })
          .eq('id', entry.id);
          
        if (updateError) {
          console.error(`Error updating entry ${entry.id}:`, updateError);
        } else {
          processed++;
          console.log(`Updated entry ${entry.id} with ${entities.length} entities`);
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
    
    const result = await processEntries();
    
    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000;
    
    console.log(`Processing completed in ${processingTime} seconds`);
    console.log(`Processed ${result.processed} entries`);
    
    return new Response(
      JSON.stringify({ 
        ...result, 
        processingTime: `${processingTime} seconds` 
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

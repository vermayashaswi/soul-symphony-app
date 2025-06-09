
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to extract entities from text using GPT instead of Google NL API
async function extractEntitiesWithGPT(text) {
  if (!openAIApiKey) {
    console.error("OpenAI API key not configured");
    return { error: "OpenAI API key not configured" };
  }

  try {
    console.log("Extracting entities from text using GPT:", text.substring(0, 50) + "...");
    
    const prompt = `
      Extract traditional entities from this journal entry text. Focus on specific, concrete entities:
      
      - PERSON: Names of people, family members, friends, colleagues (e.g., "John", "mom", "my boss")
      - PLACE: Locations, cities, countries, buildings, rooms (e.g., "New York", "office", "home")
      - ORGANIZATION: Companies, schools, teams, groups (e.g., "Google", "Harvard", "Red Cross")
      - THING: Specific objects, products, brands, books, movies (e.g., "iPhone", "Netflix", "coffee")
      
      Return as JSON with arrays for each type. Only include entities that are explicitly mentioned:
      
      {
        "PERSON": ["name1", "name2"],
        "PLACE": ["place1", "place2"], 
        "ORGANIZATION": ["org1"],
        "THING": ["item1", "item2"]
      }
      
      Text: ${text}
    `;

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
            content: 'You are an expert at extracting traditional named entities from text. Only extract concrete, specific entities that are explicitly mentioned. Return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("OpenAI API error:", errorData);
      return { error: errorData };
    }

    const result = await response.json();
    
    if (!result.choices || !result.choices[0]?.message?.content) {
      console.error("Invalid response structure from OpenAI");
      return { error: "Invalid response from OpenAI" };
    }

    const entities = JSON.parse(result.choices[0].message.content);
    console.log("Entity extraction successful using GPT, found entities:", entities);
    return { entities };
  } catch (error) {
    console.error("Error in GPT entity extraction:", error);
    return { error: error.message };
  }
}

// Function to process a batch of journal entries or specific entry IDs
async function processJournalEntries(entries, diagnosticMode = false) {
  const results = [];

  for (const entry of entries) {
    try {
      console.log(`Processing entry ID: ${entry.id}`);
      
      // Use "refined text" or "transcription text" field
      const textToProcess = entry["refined text"] || entry["transcription text"] || "";
      
      if (!textToProcess) {
        console.error(`No text content found for entry ID ${entry.id}`);
        results.push({ id: entry.id, success: false, error: "No text content found" });
        continue;
      }
      
      const { entities, error } = await extractEntitiesWithGPT(textToProcess);

      if (error) {
        console.error(`Error extracting entities for entry ID ${entry.id}:`, error);
        results.push({ id: entry.id, success: false, error: error });
        continue;
      }

      // Update the journal entry with extracted entities (traditional entities format)
      const { error: updateError } = await supabase
        .from('Journal Entries')
        .update({ entities: entities })
        .eq('id', entry.id);

      if (updateError) {
        console.error(`Error updating entry ID ${entry.id}:`, updateError);
        results.push({ id: entry.id, success: false, error: updateError.message });
        continue;
      }

      console.log(`Successfully processed entry ID: ${entry.id}`);
      
      // Count total entities across all types
      const totalEntityCount = Object.values(entities || {}).reduce((total, entityArray) => {
        return total + (Array.isArray(entityArray) ? entityArray.length : 0);
      }, 0);
      
      results.push({ id: entry.id, success: true, entityCount: totalEntityCount });

    } catch (error) {
      console.error(`Unexpected error processing entry ID ${entry.id}:`, error);
      results.push({ id: entry.id, success: false, error: error.message });
    }
  }

  return results;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      diagnosticMode = false, 
      checkApiKeyOnly = false, 
      processAll = false,
      entryIds = [] 
    } = await req.json();

    if (checkApiKeyOnly) {
      if (!openAIApiKey) {
        return new Response(
          JSON.stringify({
            message: "OPENAI_API_KEY is not configured.",
            configured: false
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      } else {
        return new Response(
          JSON.stringify({
            message: "OPENAI_API_KEY is configured.",
            configured: true
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
    }

    console.log("Starting batch entity extraction with GPT...");
    
    let entries = [];
    
    // Check if we have specific entry IDs to process
    if (entryIds && entryIds.length > 0) {
      console.log(`Processing specific entries: ${entryIds.join(', ')}`);
      
      const { data: specificEntries, error: fetchSpecificError } = await supabase
        .from('Journal Entries')
        .select('id, "refined text", "transcription text"')
        .in('id', entryIds);
        
      if (fetchSpecificError) {
        console.error("Error fetching specific journal entries:", fetchSpecificError);
        return new Response(JSON.stringify({ error: 'Failed to fetch specific journal entries', details: fetchSpecificError }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
      
      entries = specificEntries || [];
    } else {
      // Use the correct field names in the query for batch processing
      const query = supabase
        .from('Journal Entries')
        .select('id, "refined text", "transcription text"')
        .is('entities', null)
        .limit(50);
        
      const { data: batchEntries, error: fetchError } = await query;
  
      if (fetchError) {
        console.error("Error fetching journal entries:", fetchError);
        return new Response(JSON.stringify({ error: 'Failed to fetch journal entries', details: fetchError }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
      
      entries = batchEntries || [];
    }

    if (!entries || entries.length === 0) {
      console.log("No entries found to process.");
      return new Response(JSON.stringify({ message: 'No entries found to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Fetched ${entries.length} entries for processing.`);

    // Process the entries
    const results = await processJournalEntries(entries, diagnosticMode);

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    console.log(`Batch processing completed. Success: ${successCount}, Errors: ${errorCount}`);

    // Diagnostic mode response
    if (diagnosticMode) {
      return new Response(
        JSON.stringify({
          message: `Batch processing completed using GPT. Success: ${successCount}, Errors: ${errorCount}`,
          results: results
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      // Standard response
      return new Response(
        JSON.stringify({ message: `Batch processing completed using GPT. Success: ${successCount}, Errors: ${errorCount}` }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

  } catch (error) {
    console.error("Unexpected error in batch entity extraction:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

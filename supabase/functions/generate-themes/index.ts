
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

async function extract_themes_and_entities(text: string) {
  try {
    console.log(`Starting theme and entity extraction for text: "${text.substring(0, 100)}..."`);
    
    if (!openAIApiKey) {
      console.error('OpenAI API key is missing or empty');
      throw new Error('OpenAI API key is not configured');
    }
    
    const prompt = `
      Analyze the following journal entry and extract:
      
      1. The main themes or topics discussed (maximum 5 themes)
      2. Named entities mentioned in the text
      
      For themes, return simple phrases or keywords that capture the essence of what the journal entry is about.
      
      For entities, identify:
      - "type": One of: person, organization, place, product, event
      - "name": The entity name exactly as mentioned in the text
      
      Return the results as a JSON object with two properties:
      - "themes": An array of strings representing the main themes
      - "entities": An array of objects, each with "type" and "name" properties
      
      Example response format:
      {
        "themes": ["work stress", "family time", "personal growth"],
        "entities": [
          {"type": "person", "name": "John"},
          {"type": "organization", "name": "Microsoft"},
          {"type": "place", "name": "New York"}
        ]
      }
      
      Only include clearly mentioned entities. If no entities are found, return an empty array.
      
      Journal entry:
      ${text}
    `;
    
    console.log(`Sending request to OpenAI with model: gpt-4o-mini`);
    
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
            content: 'You are a theme extraction and entity recognition assistant. Extract themes and named entities from journal entries following the exact format requested.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,  // Lower temperature for more consistent results
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Failed to extract themes and entities: ${errorText}`);
    }

    const result = await response.json();
    console.log(`Raw response from OpenAI:`, JSON.stringify(result, null, 2));
    
    // Extract the content from the response
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      console.error('Invalid response structure from OpenAI');
      return { themes: [], entities: [] };
    }
    
    const contentText = result.choices[0].message.content;
    console.log(`Content response text:`, contentText);
    
    try {
      // Parse the JSON response
      const parsedContent = JSON.parse(contentText);
      
      // Extract themes
      const themes = parsedContent.themes || [];
      console.log(`Extracted themes:`, themes);
      
      // Extract entities
      const entities = parsedContent.entities || [];
      console.log(`Extracted entities:`, entities);
      
      return {
        themes,
        entities
      };
    } catch (err) {
      console.error('Error parsing JSON:', err);
      console.error('Raw content text:', contentText);
      return { themes: [], entities: [] };
    }
  } catch (error) {
    console.error('Error in extract_themes_and_entities:', error);
    return { themes: [], entities: [] };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, entryId } = await req.json();
    
    if (!text) {
      throw new Error('No text provided for theme extraction');
    }
    
    console.log(`Received request to extract themes for entry ${entryId || 'unknown'}`);
    
    const { themes, entities } = await extract_themes_and_entities(text);
    
    // If an entry ID was provided, update the database
    if (entryId) {
      console.log(`Updating entry ${entryId} with themes and entities`);
      
      const updates: any = {};
      
      if (themes && themes.length > 0) {
        updates.master_themes = themes;
      }
      
      if (entities && entities.length > 0) {
        updates.entities = entities;
      }
      
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('Journal Entries')
          .update(updates)
          .eq('id', entryId);
          
        if (error) {
          console.error(`Error updating entry ${entryId}:`, error);
        } else {
          console.log(`Successfully updated entry ${entryId} with themes and entities`);
        }
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        themes,
        entities
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in generate-themes function:', error);
    
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

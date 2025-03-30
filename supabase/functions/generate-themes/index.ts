
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;

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
    const { text, entryId } = await req.json();
    
    if (!text) {
      return new Response(
        JSON.stringify({ error: 'No text provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Generating themes and entities for entry ${entryId}`);
    
    // Extract themes and entities using OpenAI
    const { themes, entities } = await extractThemesAndEntities(text);
    console.log('Generated themes:', themes);
    console.log('Extracted entities:', entities);
    
    // If entryId is provided, update the database
    if (entryId) {
      await updateEntryThemesAndEntities(entryId, themes, entities);
    }
    
    return new Response(
      JSON.stringify({ themes, entities }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-themes function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function extractThemesAndEntities(text: string): Promise<{ themes: string[], entities: { type: string, name: string }[] }> {
  const prompt = `
    Analyze the following journal entry and:
    
    1. Extract exactly 5-7 important emotional themes or concepts.
    2. Identify entities mentioned (people, organizations, places, etc.).
    
    Return the results as a JSON object with two properties:
    - "themes": An array of strings, with each theme being a single word or very short phrase (max 2 words).
    - "entities": An array of objects, each with "type" and "name" properties.
    
    For themes:
    - Keep themes short (1-2 words)
    - Capitalize the first letter of each theme
    - Return only the most important themes from the journal entry
    - Focus on emotional states, personal growth concepts, or psychological themes
    
    For entities:
    - Entity types should be one of: person, organization, place, product, event
    - Entity names should be the exact name mentioned in the text
    - Only include clearly mentioned entities
    
    Example response format:
    {
      "themes": ["Happiness", "Growth", "Family", "Work", "Health"],
      "entities": [
        {"type": "person", "name": "John"},
        {"type": "organization", "name": "Microsoft"},
        {"type": "place", "name": "Central Park"}
      ]
    }
    
    Journal entry:
    ${text}
  `;
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You analyze journal entries to extract themes and entities. Always respond with a valid JSON object.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    console.log("OpenAI response:", data);
    
    const content = data.choices?.[0]?.message?.content || '';
    
    try {
      // Attempt to clean and parse JSON from the response
      const cleanedContent = content.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanedContent);
      
      return {
        themes: Array.isArray(parsed.themes) ? parsed.themes : [],
        entities: Array.isArray(parsed.entities) ? parsed.entities : []
      };
    } catch (parseError) {
      console.error('Error parsing themes and entities:', parseError);
      // Fallback for themes if JSON parsing fails
      const themesMatches = content.match(/\["([^"]+)"(?:,\s*"([^"]+)")*\]/);
      const themes = themesMatches 
        ? themesMatches[0].split(/,\s*/).map(s => s.replace(/[\[\]"]/g, ''))
        : ["Reflection", "Insight", "Emotion"];
        
      return { themes, entities: [] };
    }
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    throw error;
  }
}

async function updateEntryThemesAndEntities(
  entryId: number, 
  themes: string[], 
  entities: { type: string, name: string }[]
): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { error } = await supabase
      .from('Journal Entries')
      .update({ 
        master_themes: themes,
        entities: entities
      })
      .eq('id', entryId);
      
    if (error) {
      console.error('Error updating entry themes and entities:', error);
      throw error;
    }
    
    console.log(`Updated themes and entities for entry ${entryId}`);
  } catch (error) {
    console.error('Error in updateEntryThemesAndEntities:', error);
    throw error;
  }
}

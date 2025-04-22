
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

async function getKnownEmotions(): Promise<string[]> {
  // Query the emotions table for emotion names
  try {
    const { data, error } = await supabase
      .from('emotions')
      .select('name');
    if (error) {
      console.error('[generate-themes] Error fetching emotions:', error);
      // Reasonable fallback
      return [
        "joy", "sadness", "anger", "fear", "surprise", "disgust", "trust", "anticipation", "shame", "guilt", "curiosity", "anxiety", "pride", "gratitude", "calm", "boredom", "stress", "love"
      ];
    }
    if (!data || !Array.isArray(data)) {
      return [];
    }
    // Map to string, lowercased
    return data.map(e => typeof e.name === "string" ? e.name.toLowerCase() : "").filter(Boolean);
  } catch (err) {
    console.error('[generate-themes] Exception fetching emotions:', err);
    return [];
  }
}

async function extract_themes_and_entities(text: string, knownEmotions: string[]) {
  try {
    if (!openAIApiKey) {
      console.error('OpenAI API key is missing or empty');
      return {
        themes: ['Theme 1', 'Theme 2', 'Theme 3'],
        entities: [],
        entityemotion: {}
      };
    }

    // Prompt for combined extraction: themes, entities, entityemotion
    const prompt = `
      Analyze the following journal entry and:
      1. Extract the main themes or topics (max 5) described succinctly, as before.
      2. Detect key entities or topics discussed (like love, relationship, life, work, money, parents, organizations, philosophy, etc). Give 3-10 such entities. Entities should be categories/labels, not specific people names, and capture any concepts, aspects, relationships, or social constructs present in the text.
      3. For each entity, select the top 3 strongest matching emotions from this list: [${knownEmotions.join(', ')}]
         - Provide the strength/score of each detected emotion for the entity (between 0 and 1, rounded to 1 decimal).
         - Only include emotions that are clearly relevant for the entity.
      Format your response as compact JSON with these keys:
      {
        "themes": [...],
        "entities": [...],
        "entityemotion": {
          "entity1": { "emotion1": score, "emotion2": score, ... },
          "entity2": { ... }
        }
      }
      For example:
      {
        "themes": ["work stress", "personal growth"],
        "entities": ["relationship", "workplace", "life"],
        "entityemotion": {
          "relationship": { "anxiety": 0.7, "joy": 0.2 },
          "workplace": { "stress": 0.8, "boredom": 0.5 }
        }
      }

      Only output valid JSON. Do not explain.
      
      Journal entry:
      ${text}
    `;

    // Use gpt-4o-mini for fast/cheap extraction
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
            content: 'You are an advanced assistant that extracts journal themes, entities, and core emotions for each entity. Always return only a well-formatted JSON object as specified in the user request.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} ${response.statusText}`, errorText);
      // Fallback
      return {
        themes: ['Personal', 'Experience'],
        entities: [],
        entityemotion: {}
      };
    }

    const result = await response.json();
    console.log(`Raw response from OpenAI:`, JSON.stringify(result, null, 2));
    if (!result.choices || !result.choices[0]?.message?.content) {
      console.error('Invalid response structure from OpenAI');
      return {
        themes: [],
        entities: [],
        entityemotion: {}
      };
    }

    let contentText = result.choices[0].message.content;
    try {
      const parsed = JSON.parse(contentText);
      // Defensive defaults:
      return {
        themes: Array.isArray(parsed.themes) ? parsed.themes : [],
        entities: Array.isArray(parsed.entities) ? parsed.entities : [],
        entityemotion: typeof parsed.entityemotion === "object" && parsed.entityemotion !== null ? parsed.entityemotion : {}
      };
    } catch (err) {
      console.error('[generate-themes] Error parsing JSON:', err, contentText);
      // Return fallback structure if parsing fails
      return {
        themes: [],
        entities: [],
        entityemotion: {}
      };
    }
  } catch (error) {
    console.error('Error in extract_themes_and_entities:', error);
    return {
      themes: [],
      entities: [],
      entityemotion: {}
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    const { text, entryId, fromEdit = false } = requestData;
    let textToProcess = text;
    let entryIdToUpdate = entryId;

    // If no direct text, fetch entry text by ID
    if (!textToProcess && entryIdToUpdate) {
      const { data: entryData, error: entryError } = await supabase
        .from('Journal Entries')
        .select('"refined text"')
        .eq('id', entryIdToUpdate)
        .single();
      if (entryError) {
        throw new Error(`Failed to fetch entry: ${entryError.message}`);
      }
      if (!entryData || !entryData["refined text"]) {
        throw new Error('Entry has no text content to process');
      }
      textToProcess = entryData["refined text"];
    }

    if (!textToProcess) {
      throw new Error('No text provided for theme extraction');
    }

    // Fetch available emotions from Supabase
    const knownEmotionList = await getKnownEmotions();

    // Get extraction results (themes, entities, entityemotion)
    const { themes, entities, entityemotion } = await extract_themes_and_entities(textToProcess, knownEmotionList);

    // Prepare updates
    const updates = {};
    if (themes && Array.isArray(themes)) {
      updates["master_themes"] = themes.length ? themes : ['Personal', 'Reflection', 'Experience'];
    }
    if (entities && Array.isArray(entities)) {
      updates["entities"] = entities;
    }
    if (entityemotion && typeof entityemotion === "object") {
      updates["entityemotion"] = entityemotion;
    }

    if (entryIdToUpdate && Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('Journal Entries')
        .update(updates)
        .eq('id', entryIdToUpdate);
      if (error) {
        console.error(`[generate-themes] Error updating entry ${entryIdToUpdate}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        themes,
        entities,
        entityemotion
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // Error fallback
    console.error('[generate-themes] Error:', error);
    return new Response(
      JSON.stringify({
        success: true,
        themes: [],
        entities: [],
        entityemotion: {}
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

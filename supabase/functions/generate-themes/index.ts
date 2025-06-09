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

const allowedCategories = [
  "Self & Identity",
  "Body & Health",
  "Mental Health",
  "Romantic Relationships",
  "Family",
  "Friendships & Social Circle",
  "Sexuality & Gender",
  "Career & Workplace",
  "Money & Finances",
  "Education & Learning",
  "Habits & Routines",
  "Sleep & Rest",
  "Creativity & Hobbies",
  "Spirituality & Beliefs",
  "Technology & Social Media",
  "Environment & Living Space",
  "Time & Productivity",
  "Travel & Movement",
  "Loss & Grief",
  "Purpose & Fulfillment",
  "Conflict & Trauma",
  "Celebration & Achievement"
];

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

async function extract_themes_categories_and_entities(text: string, knownEmotions: string[]) {
  try {
    if (!openAIApiKey) {
      console.error('OpenAI API key is missing or empty');
      return {
        themes: ['Theme 1', 'Theme 2', 'Theme 3'],
        categories: [],
        entities: [],
        entityemotion: {}
      };
    }

    // Updated prompt to extract both categories (themes) and traditional entities
    const prompt = `
      Analyze the following journal entry and extract:
      
      1. Main themes/topics (max 5) - descriptive phrases about what the entry discusses
      2. Categories from ONLY this list (select all relevant, max 10):
         [${allowedCategories.map(cat => `"${cat}"`).join(', ')}]
      3. Traditional entities - people, places, organizations, specific things mentioned:
         - PERSON: Names of people, family members, friends, colleagues
         - PLACE: Locations, cities, countries, buildings, rooms
         - ORGANIZATION: Companies, schools, teams, groups
         - THING: Specific objects, products, brands, books, movies
      4. For each selected category, the top 3 strongest emotions from: [${knownEmotions.join(', ')}]
         - Provide emotion strength (0.0-1.0, 1 decimal place)
         - Only include clearly relevant emotions
      
      Format as valid JSON:
      {
        "themes": ["descriptive theme 1", "descriptive theme 2"],
        "categories": ["Category 1", "Category 2"],
        "entities": {
          "PERSON": ["person name 1", "person name 2"],
          "PLACE": ["place 1", "place 2"],
          "ORGANIZATION": ["org 1"],
          "THING": ["item 1", "item 2"]
        },
        "entityemotion": {
          "Category 1": { "emotion1": 0.8, "emotion2": 0.5 },
          "Category 2": { "emotion1": 0.7 }
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
            content: 'You are an expert at analyzing journal entries and extracting themes, categories, entities, and emotions. Always return only well-formatted JSON as specified.'
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
        categories: [],
        entities: {},
        entityemotion: {}
      };
    }

    const result = await response.json();
    console.log(`Raw response from OpenAI:`, JSON.stringify(result, null, 2));
    if (!result.choices || !result.choices[0]?.message?.content) {
      console.error('Invalid response structure from OpenAI');
      return {
        themes: [],
        categories: [],
        entities: {},
        entityemotion: {}
      };
    }

    let contentText = result.choices[0].message.content;
    try {
      const parsed = JSON.parse(contentText);
      // Defensive defaults and proper mapping:
      return {
        themes: Array.isArray(parsed.themes) ? parsed.themes : [],
        categories: Array.isArray(parsed.categories) ? parsed.categories : [], // This will go to master_themes
        entities: typeof parsed.entities === "object" && parsed.entities !== null ? parsed.entities : {}, // This will go to entities
        entityemotion: typeof parsed.entityemotion === "object" && parsed.entityemotion !== null ? parsed.entityemotion : {}
      };
    } catch (err) {
      console.error('[generate-themes] Error parsing JSON:', err, contentText);
      // Return fallback structure if parsing fails
      return {
        themes: [],
        categories: [],
        entities: {},
        entityemotion: {}
      };
    }
  } catch (error) {
    console.error('Error in extract_themes_categories_and_entities:', error);
    return {
      themes: [],
      categories: [],
      entities: {},
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

    // Get extraction results (themes, categories, entities, entityemotion)
    const { themes, categories, entities, entityemotion } = await extract_themes_categories_and_entities(textToProcess, knownEmotionList);

    // Prepare updates with CORRECT mapping
    const updates = {};
    if (themes && Array.isArray(themes)) {
      // Keep themes as descriptive themes (not used in DB currently but could be useful)
      console.log('[generate-themes] Extracted themes:', themes);
    }
    if (categories && Array.isArray(categories)) {
      // FIXED: Categories go to master_themes (not entities)
      updates["master_themes"] = categories.length ? categories : ['Personal', 'Reflection', 'Experience'];
    }
    if (entities && typeof entities === "object") {
      // FIXED: Traditional entities go to entities field
      updates["entities"] = entities;
    }
    if (entityemotion && typeof entityemotion === "object") {
      updates["entityemotion"] = entityemotion;
    }

    if (entryIdToUpdate && Object.keys(updates).length > 0) {
      console.log('[generate-themes] Updating entry with:', updates);
      const { error } = await supabase
        .from('Journal Entries')
        .update(updates)
        .eq('id', entryIdToUpdate);
      if (error) {
        console.error(`[generate-themes] Error updating entry ${entryIdToUpdate}:`, error);
      } else {
        console.log(`[generate-themes] Successfully updated entry ${entryIdToUpdate}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        themes,
        categories, // These are the master_themes
        entities, // These are traditional entities
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
        categories: [],
        entities: {},
        entityemotion: {}
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

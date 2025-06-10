
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

async function extract_themes_and_entities(text: string, knownEmotions: string[]) {
  try {
    if (!openAIApiKey) {
      console.error('OpenAI API key is missing or empty');
      return {
        themes: ['Theme 1', 'Theme 2', 'Theme 3'],
        categories: [],
        entityemotion: {}
      };
    }

    console.log('[generate-themes] Starting theme and category extraction');

    // CORRECTED: Updated prompt to generate themes and categories separately, no entities
    const prompt = `
      Analyze the following journal entry and:
      1. Extract the main themes or topics (max 5) described succinctly.
      2. From ONLY the following list of Categories, select all that are relevant to this journal entry (list of up to 10 maximum). Do NOT make up new categories, pick only from the list provided below:
         Categories:
         [${allowedCategories.map(cat => `"${cat}"`).join(', ')}]
      3. For each selected category, select the top 3 strongest matching emotions from this list: [${knownEmotions.join(', ')}]
         - Provide the strength/score of each detected emotion for the category (between 0 and 1, rounded to 1 decimal).
         - Only include emotions that are clearly relevant for the category.
      Format your response as compact valid JSON with these keys:
      {
        "themes": [...],
        "categories": [...], 
        "entityemotion": {
          "Category 1": { "emotion1": score, "emotion2": score, ... },
          "Category 2": { ... }
        }
      }
      For example:
      {
        "themes": ["work stress", "personal growth"],
        "categories": ["Career & Workplace", "Self & Identity"],
        "entityemotion": {
          "Career & Workplace": { "stress": 0.8, "boredom": 0.5 },
          "Self & Identity": { "anxiety": 0.7, "joy": 0.2 }
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
            content: 'You are an advanced assistant that extracts journal themes and categories with emotional associations. Always return only a well-formatted JSON object as specified in the user request.'
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
        entityemotion: {}
      };
    }

    const result = await response.json();
    console.log(`[generate-themes] Raw response from OpenAI:`, JSON.stringify(result, null, 2));
    if (!result.choices || !result.choices[0]?.message?.content) {
      console.error('Invalid response structure from OpenAI');
      return {
        themes: [],
        categories: [],
        entityemotion: {}
      };
    }

    let contentText = result.choices[0].message.content;
    try {
      const parsed = JSON.parse(contentText);
      // CORRECTED: Return categories separately from themes
      return {
        themes: Array.isArray(parsed.themes) ? parsed.themes : [],
        categories: Array.isArray(parsed.categories) ? parsed.categories : [],
        entityemotion: typeof parsed.entityemotion === "object" && parsed.entityemotion !== null ? parsed.entityemotion : {}
      };
    } catch (err) {
      console.error('[generate-themes] Error parsing JSON:', err, contentText);
      // Return fallback structure if parsing fails
      return {
        themes: [],
        categories: [],
        entityemotion: {}
      };
    }
  } catch (error) {
    console.error('Error in extract_themes_and_entities:', error);
    return {
      themes: [],
      categories: [],
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

    console.log('[generate-themes] Processing request:', {
      hasText: !!textToProcess,
      entryId: entryIdToUpdate,
      fromEdit
    });

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

    // Get extraction results (themes, categories, entityemotion)
    const { themes, categories, entityemotion } = await extract_themes_and_entities(textToProcess, knownEmotionList);

    console.log('[generate-themes] Extraction results:', {
      themes: themes,
      categories: categories,
      entityemotionKeys: Object.keys(entityemotion)
    });

    // CORRECTED: Prepare updates - themes go to master_themes, categories go to entities (as per current usage)
    const updates = {};
    if (themes && Array.isArray(themes)) {
      updates["master_themes"] = themes.length ? themes : ['Personal', 'Reflection', 'Experience'];
    }
    if (categories && Array.isArray(categories)) {
      // Store categories in entities column for now (maintaining backward compatibility)
      updates["entities"] = categories;
    }
    if (entityemotion && typeof entityemotion === "object") {
      updates["entityemotion"] = entityemotion;
    }

    console.log('[generate-themes] Database updates:', updates);

    if (entryIdToUpdate && Object.keys(updates).length > 0) {
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
        entities: categories, // Return categories as entities for backward compatibility
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

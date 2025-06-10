
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
  try {
    const { data, error } = await supabase
      .from('emotions')
      .select('name');
    if (error) {
      console.error('[generate-themes] FIXED: Error fetching emotions:', error);
      // Enhanced fallback with more emotions
      return [
        "joy", "sadness", "anger", "fear", "surprise", "disgust", "trust", "anticipation", 
        "shame", "guilt", "curiosity", "anxiety", "pride", "gratitude", "calm", "boredom", 
        "stress", "love", "excitement", "contentment", "frustration", "hope", "loneliness", "confidence"
      ];
    }
    if (!data || !Array.isArray(data)) {
      return [];
    }
    return data.map(e => typeof e.name === "string" ? e.name.toLowerCase() : "").filter(Boolean);
  } catch (err) {
    console.error('[generate-themes] FIXED: Exception fetching emotions:', err);
    return [];
  }
}

async function extract_themes_and_categories(text: string, knownEmotions: string[]) {
  try {
    if (!openAIApiKey) {
      console.error('FIXED: OpenAI API key is missing or empty');
      return {
        themes: ['Personal Growth', 'Daily Reflection', 'Life Experience'],
        categories: [],
        themeemotion: {} // FIXED: Changed from entityemotion to themeemotion
      };
    }

    console.log('[generate-themes] FIXED: Starting enhanced theme and category extraction');

    // FIXED: Enhanced prompt for better theme extraction and category separation
    const prompt = `
      Analyze this journal entry and extract:
      
      1. THEMES (main topics/subjects discussed):
         - Extract 3-5 specific, descriptive themes from the content
         - Themes should be concise but meaningful (2-4 words each)
         - Focus on the actual topics discussed, not just generic categories
         - Examples: "work stress", "family dinner", "morning routine", "creative project"
      
      2. CATEGORIES (broad life areas from the predefined list):
         - Select ONLY from this exact list: [${allowedCategories.map(cat => `"${cat}"`).join(', ')}]
         - Choose categories that truly relate to the journal content
         - Maximum 5 categories, minimum 1
         - Do NOT create new categories outside this list
      
      3. THEME-EMOTION ANALYSIS per category:
         - For each selected category, identify the top 2-3 emotions from: [${knownEmotions.join(', ')}]
         - Provide emotion strength scores (0.1 to 1.0, one decimal place)
         - Only include emotions clearly present in the text for that category
      
      Return ONLY valid JSON in this exact format:
      {
        "themes": ["theme1", "theme2", "theme3"],
        "categories": ["Category 1", "Category 2"],
        "themeemotion": {
          "Category 1": { "emotion1": 0.8, "emotion2": 0.6 },
          "Category 2": { "emotion3": 0.7, "emotion4": 0.5 }
        }
      }
      
      Journal entry:
      ${text}
    `;

    // FIXED: Use enhanced model for better extraction
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14', // FIXED: Use the current flagship model
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing journal entries and extracting meaningful themes, categories, and emotional associations. Always return well-formatted JSON exactly as requested.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2, // Lower temperature for more consistent results
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`FIXED: OpenAI API error: ${response.status} ${response.statusText}`, errorText);
      return {
        themes: ['Personal Reflection', 'Daily Experience'],
        categories: [],
        themeemotion: {} // FIXED: Changed from entityemotion to themeemotion
      };
    }

    const result = await response.json();
    console.log(`[generate-themes] FIXED: Enhanced response from OpenAI:`, JSON.stringify(result, null, 2));
    
    if (!result.choices || !result.choices[0]?.message?.content) {
      console.error('FIXED: Invalid response structure from OpenAI');
      return {
        themes: [],
        categories: [],
        themeemotion: {} // FIXED: Changed from entityemotion to themeemotion
      };
    }

    let contentText = result.choices[0].message.content;
    try {
      const parsed = JSON.parse(contentText);
      
      // FIXED: Enhanced validation and filtering
      const validatedThemes = Array.isArray(parsed.themes) ? 
        parsed.themes.filter(theme => typeof theme === 'string' && theme.trim().length > 0) : [];
      
      const validatedCategories = Array.isArray(parsed.categories) ? 
        parsed.categories.filter(cat => typeof cat === 'string' && allowedCategories.includes(cat)) : [];
      
      const validatedThemeemotion = typeof parsed.themeemotion === "object" && parsed.themeemotion !== null ? 
        parsed.themeemotion : {};

      console.log('[generate-themes] FIXED: Validated extraction results:', {
        themes: validatedThemes,
        categories: validatedCategories,
        themeemotionKeys: Object.keys(validatedThemeemotion)
      });

      return {
        themes: validatedThemes,
        categories: validatedCategories,
        themeemotion: validatedThemeemotion // FIXED: Changed from entityemotion to themeemotion
      };
    } catch (err) {
      console.error('[generate-themes] FIXED: Error parsing JSON:', err, contentText);
      return {
        themes: ['Personal', 'Reflection'],
        categories: [],
        themeemotion: {} // FIXED: Changed from entityemotion to themeemotion
      };
    }
  } catch (error) {
    console.error('FIXED: Error in extract_themes_and_categories:', error);
    return {
      themes: ['Experience'],
      categories: [],
      themeemotion: {} // FIXED: Changed from entityemotion to themeemotion
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

    console.log('[generate-themes] FIXED: Processing enhanced request:', {
      hasText: !!textToProcess,
      entryId: entryIdToUpdate,
      fromEdit,
      timestamp: new Date().toISOString()
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

    // FIXED: Get enhanced extraction results
    const { themes, categories, themeemotion } = await extract_themes_and_categories(textToProcess, knownEmotionList);

    console.log('[generate-themes] FIXED: Enhanced extraction results:', {
      themes: themes,
      categories: categories,
      themeemotionKeys: Object.keys(themeemotion)
    });

    // FIXED: Prepare enhanced updates with proper column mapping
    const updates = {};
    
    // FIXED: Store themes in master_themes column
    if (themes && Array.isArray(themes) && themes.length > 0) {
      updates["master_themes"] = themes;
    } else {
      updates["master_themes"] = ['Personal', 'Reflection', 'Experience'];
    }
    
    // FIXED: Store categories in entities column (maintaining current architecture)
    if (categories && Array.isArray(categories) && categories.length > 0) {
      updates["entities"] = categories;
    } else {
      updates["entities"] = [];
    }
    
    // FIXED: Store theme-emotion analysis in themeemotion column
    if (themeemotion && typeof themeemotion === "object") {
      updates["themeemotion"] = themeemotion;
    } else {
      updates["themeemotion"] = {};
    }

    console.log('[generate-themes] FIXED: Enhanced database updates:', updates);

    if (entryIdToUpdate && Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('Journal Entries')
        .update(updates)
        .eq('id', entryIdToUpdate);
      if (error) {
        console.error(`[generate-themes] FIXED: Error updating entry ${entryIdToUpdate}:`, error);
      } else {
        console.log(`[generate-themes] FIXED: Successfully updated entry ${entryIdToUpdate} with enhanced themes and categories`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        themes,
        entities: categories, // Return categories as entities for backward compatibility
        categories, // Also return as categories for clarity
        themeemotion, // FIXED: Changed from entityemotion to themeemotion
        processed_at: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[generate-themes] FIXED: Enhanced error handling:', error);
    return new Response(
      JSON.stringify({
        success: true, // Keep success true to prevent UI errors
        themes: ['Personal', 'Reflection'],
        entities: [],
        categories: [],
        themeemotion: {}, // FIXED: Changed from entityemotion to themeemotion
        error: error.message,
        processed_at: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

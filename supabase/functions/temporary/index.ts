
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

// Fetch list of emotions from Supabase "emotions" table (fallback: generic emotions)
async function getKnownEmotions() {
  try {
    const { data, error } = await supabase.from('emotions').select('name');
    if (error) {
      console.error('Error fetching emotions list:', error);
      return [
        "joy", "sadness", "anger", "fear", "surprise", "disgust", "trust", "anticipation", "shame", "guilt", "curiosity", "anxiety", "pride", "gratitude", "calm", "boredom", "stress", "love"
      ];
    }
    return data.map(e => typeof e.name === "string" ? e.name.toLowerCase() : "").filter(Boolean);
  } catch (err) {
    console.error('Exception in getKnownEmotions:', err);
    return [];
  }
}

async function analyzeText(text, knownEmotions) {
  const prompt = `
Analyze the following journal entry and:
1. From ONLY the following list of Categories, select all that are relevant to this journal entry (list up to 10 max):
   Categories: [${allowedCategories.map((c) => `"${c}"`).join(', ')}]
2. For each selected category, select the top 3 strongest matching emotions from this list: [${knownEmotions.join(', ')}]
   - Provide the strength/score of each detected emotion for the category (between 0 and 1, rounded to 1 decimal).
   - Only include emotions that are clearly relevant for the category.
Return JSON (no explanations): 
{
  "categories": [...],
  "entityemotion": {
    "Category 1": { "emotion1": score, "emotion2": score, ... },
    "Category 2": { ... }
  }
}
Only valid JSON, no explanations.

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
          {
            role: 'system',
            content: 'Extract relevant categories (from provided list) and core emotions with strength per category for a journal entry. Output ONLY compact JSON as described by the user.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.25,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      console.error(`OpenAI API error: ${response.status}`);
      return { categories: [], entityemotion: {} };
    }

    try {
      const result = await response.json();
      console.log("OpenAI response:", JSON.stringify(result).substring(0, 200) + "...");
      
      let parsed;
      if (result.choices && result.choices[0]?.message?.content) {
        parsed = JSON.parse(result.choices[0].message.content);
      } else {
        parsed = result;
      }

      return {
        categories: Array.isArray(parsed.categories) ? parsed.categories : [],
        entityemotion: typeof parsed.entityemotion === "object" && parsed.entityemotion !== null ? parsed.entityemotion : {},
      };
    } catch (err) {
      console.error('Error parsing GPT response:', err);
      return { categories: [], entityemotion: {} };
    }
  } catch (err) {
    console.error('Error calling OpenAI API:', err);
    return { categories: [], entityemotion: {} };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting temporary function to process journal entries");
    
    // Handle authentication - extract headers from request
    const authHeader = req.headers.get('Authorization');
    const clientInfoHeader = req.headers.get('x-client-info');
    
    // Log received headers for debugging
    console.log("Auth header received:", authHeader ? "Yes" : "No");
    console.log("Client info header received:", clientInfoHeader ? "Yes" : "No");

    // Create a new Supabase client using the user's auth token
    let userSupabase = supabase;
    if (authHeader) {
      userSupabase = createClient(supabaseUrl, supabaseServiceKey, {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      });
    } else {
      console.log("Warning: No auth header present, using service role key");
    }
    
    // UPDATE: Get all Journal Entries, not just where entityemotion is null
    const { data: entries, error } = await userSupabase
      .from('Journal Entries')
      .select('id, "refined text", "transcription text"')
      .limit(25); // for practical reasons, process max 25 at a time

    if (error) {
      console.error("Database error fetching entries:", error);
      return new Response(
        JSON.stringify({ 
          error: 'Database error fetching entries', 
          detail: error.message,
          updated: 0 
        }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!entries || !entries.length) {
      console.log("No entries found to process");
      return new Response(
        JSON.stringify({ 
          message: 'No entries found to process',
          updated: 0 
        }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${entries.length} entries to process`);
    const knownEmotions = await getKnownEmotions();
    console.log(`Using ${knownEmotions.length} known emotions for analysis`);

    let updated = 0;
    let failed = 0;
    for (const entry of entries) {
      const text = entry["refined text"] || entry["transcription text"];
      if (!text) {
        console.log(`Entry ${entry.id} has no text content, skipping`);
        continue;
      }

      try {
        // Analyze this entry
        console.log(`Processing entry ${entry.id} (text length: ${text.length})`);
        const { categories, entityemotion } = await analyzeText(text, knownEmotions);
        console.log(`Analysis complete for entry ${entry.id}: ${categories.length} categories found`);

        // Update the entry in database
        const { error: updateErr } = await userSupabase
          .from('Journal Entries')
          .update({
            entities: categories,
            entityemotion: entityemotion
          })
          .eq('id', entry.id);

        if (updateErr) {
          console.error(`Error updating entry ${entry.id}:`, updateErr);
          failed++;
        } else {
          console.log(`Successfully updated entry ${entry.id}`);
          updated++;
        }
      } catch (processErr) {
        console.error(`Error processing entry ${entry.id}:`, processErr);
        failed++;
      }
    }

    console.log(`Processing complete. Updated: ${updated}, Failed: ${failed}`);
    return new Response(
      JSON.stringify({
        updated,
        failed,
        total: entries.length,
        message: `Processing complete. Updated: ${updated}, Failed: ${failed}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Global error in edge function:', err);
    return new Response(
      JSON.stringify({ 
        error: 'Edge function error', 
        detail: err.message,
        updated: 0 
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

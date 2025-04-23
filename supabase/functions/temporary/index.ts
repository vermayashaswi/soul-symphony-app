
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/utils.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Only these allowed categories should ever be assigned - STRICTLY ENFORCED
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

// Fetch ALL emotions from Supabase "emotions" table with enhanced error handling
async function getKnownEmotions() {
  try {
    console.log('Fetching emotions from the database...');
    
    // Fetch all emotions from the table
    const { data, error } = await supabase.from('emotions').select('name');
    
    if (error) {
      console.error('Error fetching emotions list:', error);
      throw new Error(`Failed to fetch emotions: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      console.error('No emotions found in the database!');
      throw new Error('Emotions table appears to be empty');
    }
    
    // Map the emotion names to lowercase for consistency
    const emotions = data.map(e => typeof e.name === "string" ? e.name.toLowerCase() : "").filter(Boolean);
    
    console.log(`Successfully fetched ${emotions.length} emotions from database`);
    console.log('Sample of emotions:', emotions.slice(0, 5).join(', ') + '...');
    
    return emotions;
  } catch (err) {
    console.error('Exception in getKnownEmotions:', err);
    throw err; // Re-throw to handle at the caller level
  }
}

async function analyzeText(text, knownEmotions) {
  if (!knownEmotions || knownEmotions.length === 0) {
    throw new Error('No emotions available for analysis');
  }
  
  console.log(`Analyzing text with ${knownEmotions.length} known emotions`);
  
  const prompt = `
Analyze the following journal entry and:

1. From STRICTLY ONLY the following list of Categories, select all that are relevant to this journal entry (list up to 10 max):
   Categories: [${allowedCategories.map((c) => `"${c}"`).join(', ')}]

2. For each selected category (which must ONLY be from the list above), select the top 3 strongest matching emotions from this EXACT list of emotions: [${knownEmotions.join(', ')}]
   - Provide the strength/score of each detected emotion for the category (between 0 and 1, rounded to 1 decimal).
   - Only include emotions that are clearly relevant for the category.
   - NEVER include any emotions that are not in the provided list.
   - NEVER create your own categories outside the given list.

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
    console.log('Calling OpenAI API for text analysis...');
    
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
            content: 'Extract relevant categories (strictly from provided list) and core emotions (strictly from provided list) with strength per category for a journal entry. Output ONLY compact JSON as described by the user. Never include categories or emotions outside the provided lists.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.25,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      console.error(`OpenAI API error: ${response.status}`);
      throw new Error(`OpenAI API returned status ${response.status}`);
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

      // Verify only allowed categories are included
      const sanitizedCategories = Array.isArray(parsed.categories) 
        ? parsed.categories.filter(category => allowedCategories.includes(category))
        : [];

      // Verify only known emotions are included for each category
      const sanitizedEntityEmotion = {};
      
      if (typeof parsed.entityemotion === "object" && parsed.entityemotion !== null) {
        for (const category in parsed.entityemotion) {
          // Only process allowed categories
          if (allowedCategories.includes(category)) {
            sanitizedEntityEmotion[category] = {};
            
            // Only include known emotions
            for (const emotion in parsed.entityemotion[category]) {
              if (knownEmotions.includes(emotion.toLowerCase())) {
                sanitizedEntityEmotion[category][emotion] = parsed.entityemotion[category][emotion];
              } else {
                console.warn(`Removed invalid emotion "${emotion}" for category "${category}"`);
              }
            }
          } else {
            console.warn(`Removed invalid category "${category}"`);
          }
        }
      }

      console.log(`Sanitized: ${sanitizedCategories.length} categories, with strict validation`);
      
      return {
        categories: sanitizedCategories,
        entityemotion: sanitizedEntityEmotion,
      };
    } catch (err) {
      console.error('Error parsing GPT response:', err);
      throw new Error(`Failed to parse OpenAI response: ${err.message}`);
    }
  } catch (err) {
    console.error('Error calling OpenAI API:', err);
    throw new Error(`Failed to call OpenAI API: ${err.message}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting force-reprocess function for ALL journal entries");
    const authHeader = req.headers.get('Authorization');
    const clientInfoHeader = req.headers.get('x-client-info');

    // Auth-aware Supabase client
    let userSupabase = supabase;
    if (authHeader) {
      userSupabase = createClient(supabaseUrl, supabaseServiceKey, {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      });
    }

    // Fetch ALL journal entries
    const { data: entries, error } = await userSupabase
      .from('Journal Entries')
      .select('id, "refined text", "transcription text"')
      .limit(1000);

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
    
    let knownEmotions;
    try {
      // Get the complete list of emotions
      knownEmotions = await getKnownEmotions();
      console.log(`Using ${knownEmotions.length} known emotions for analysis`);
      
      if (knownEmotions.length < 20) {
        console.error("WARNING: Found fewer emotions than expected. This might indicate a database issue.");
      }
    } catch (emotionsErr) {
      console.error('Error fetching emotions:', emotionsErr);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch emotions', 
          detail: emotionsErr.message,
          updated: 0 
        }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        
        // Update the entry in database - no need to filter categories again as we've already sanitized them
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
    console.error('Global error in force-reprocess function:', err);
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

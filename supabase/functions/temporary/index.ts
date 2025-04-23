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
    
    // Retry logic for emotion fetching
    const maxRetries = 3;
    let retryCount = 0;
    let data = null;
    let error = null;
    
    while (retryCount < maxRetries && !data) {
      // Fetch all emotions from the table with a longer timeout
      const result = await supabase
        .from('emotions')
        .select('name');
      
      if (result.error) {
        console.error(`Attempt ${retryCount + 1}: Error fetching emotions list:`, result.error);
        error = result.error;
        retryCount++;
        
        if (retryCount < maxRetries) {
          console.log(`Retrying in 1 second... (${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } else {
        data = result.data;
        break;
      }
    }
    
    if (!data || data.length === 0) {
      console.error('No emotions found in the database after multiple attempts!');
      throw new Error('Emotions table appears to be empty or inaccessible');
    }
    
    // Map the emotion names to lowercase for consistency
    const emotions = data.map(e => typeof e.name === "string" ? e.name.toLowerCase().trim() : "").filter(Boolean);
    
    console.log(`Successfully fetched ${emotions.length} emotions from database`);
    console.log('Sample of emotions:', emotions.slice(0, 10).join(', ') + '...');
    
    if (emotions.length < 30) {
      console.warn(`WARNING: Only fetched ${emotions.length} emotions, expected at least 46!`);
    }
    
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
  
  // Debug check to ensure we have all emotions
  if (knownEmotions.length < 30) {
    console.warn('WARNING: Known emotions list appears incomplete. Expected at least 46, but got:', knownEmotions.length);
    console.warn('First 10 emotions:', knownEmotions.slice(0, 10));
  }
  
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
    console.log(`Text length: ${text.length} characters`);
    
    // Add retry logic for OpenAI API calls
    const maxRetries = 3;
    let retryCount = 0;
    let openAIResponse = null;
    let responseError = null;
    
    while (retryCount < maxRetries && !openAIResponse) {
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
          responseError = new Error(`OpenAI API returned status ${response.status}`);
          retryCount++;
          
          if (retryCount < maxRetries) {
            console.log(`Retrying OpenAI call in 2 seconds... (${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } else {
          openAIResponse = await response.json();
          break;
        }
      } catch (err) {
        console.error(`Retry ${retryCount + 1}: Error calling OpenAI:`, err);
        responseError = err;
        retryCount++;
        
        if (retryCount < maxRetries) {
          console.log(`Retrying OpenAI call in 2 seconds... (${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!openAIResponse) {
      throw responseError || new Error('Failed to get response from OpenAI after multiple attempts');
    }

    console.log("OpenAI response received:", JSON.stringify(openAIResponse).substring(0, 200) + "...");
    
    let parsed;
    if (openAIResponse.choices && openAIResponse.choices[0]?.message?.content) {
      try {
        parsed = JSON.parse(openAIResponse.choices[0].message.content);
        console.log("Successfully parsed OpenAI response");
      } catch (parseErr) {
        console.error('Error parsing OpenAI response:', parseErr);
        console.log('Raw content:', openAIResponse.choices[0].message.content);
        throw new Error(`Failed to parse OpenAI response: ${parseErr.message}`);
      }
    } else {
      console.error('Unexpected OpenAI response structure:', openAIResponse);
      throw new Error('OpenAI response missing expected content');
    }

    // Verify only allowed categories are included with detailed logging
    let sanitizedCategories = [];
    if (Array.isArray(parsed.categories)) {
      sanitizedCategories = parsed.categories.filter(category => {
        const isAllowed = allowedCategories.includes(category);
        if (!isAllowed) {
          console.warn(`Removed invalid category "${category}" - not in allowed list`);
        }
        return isAllowed;
      });
      
      console.log(`Categories before sanitization: ${parsed.categories.length}, after: ${sanitizedCategories.length}`);
    } else {
      console.warn(`Invalid categories format received:`, parsed.categories);
    }

    // Verify only known emotions are included for each category with detailed logging
    const sanitizedEntityEmotion = {};
    const knownEmotionsSet = new Set(knownEmotions.map(e => e.toLowerCase()));
    
    if (typeof parsed.entityemotion === "object" && parsed.entityemotion !== null) {
      let totalEmotions = 0;
      let validEmotions = 0;
      
      for (const category in parsed.entityemotion) {
        // Only process allowed categories
        if (allowedCategories.includes(category)) {
          sanitizedEntityEmotion[category] = {};
          
          // Only include known emotions
          for (const emotion in parsed.entityemotion[category]) {
            totalEmotions++;
            const normalizedEmotion = emotion.toLowerCase();
            
            if (knownEmotionsSet.has(normalizedEmotion)) {
              sanitizedEntityEmotion[category][emotion] = parsed.entityemotion[category][emotion];
              validEmotions++;
            } else {
              console.warn(`Removed invalid emotion "${emotion}" for category "${category}" - not in known emotions list`);
            }
          }
          
          // If no valid emotions remain for this category, remove the category
          if (Object.keys(sanitizedEntityEmotion[category]).length === 0) {
            console.warn(`Removing category "${category}" as it has no valid emotions after sanitization`);
            delete sanitizedEntityEmotion[category];
          }
        } else {
          console.warn(`Removed invalid category "${category}" from entityemotion - not in allowed list`);
        }
      }
      
      console.log(`Emotions sanitization: ${validEmotions}/${totalEmotions} emotions were valid`);
    } else {
      console.warn(`Invalid entityemotion format received:`, parsed.entityemotion);
    }

    console.log(`Sanitized: ${sanitizedCategories.length} categories and ${Object.keys(sanitizedEntityEmotion).length} category-emotion sets`);
    
    // Final validation check - if we ended up with nothing valid, reject this result
    if (sanitizedCategories.length === 0 || Object.keys(sanitizedEntityEmotion).length === 0) {
      console.error('Sanitization resulted in empty data - no valid categories or emotions');
      throw new Error('Analysis failed to produce any valid categories or emotions after sanitization');
    }
    
    return {
      categories: sanitizedCategories,
      entityemotion: sanitizedEntityEmotion,
    };
  } catch (err) {
    console.error('Error in analyzeText:', err);
    throw new Error(`Failed in text analysis: ${err.message}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "POST") {
    // Check for "make_null" action in the body
    try {
      const body = await req.json();
      if (body && body.action === "make_null" && body.entryId) {
        console.log(`Received make_null request for entryId: ${body.entryId}`);

        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { error } = await supabase
          .from('Journal Entries')
          .update({
            entities: null,
            entityemotion: null
          })
          .eq('id', body.entryId);

        if (error) {
          console.error("Error setting entities/entityemotion to null:", error);
          return new Response(
            JSON.stringify({ error: "Failed to set columns as null", detail: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
          );
        }

        console.log(`Successfully set fields as null for entryId: ${body.entryId}`);
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (e) {
      // Fall through / log error
      console.error("Error in make_null handler:", e);
    }
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

    // Pre-fetch emotions once to avoid repeated calls
    let knownEmotions;
    try {
      knownEmotions = await getKnownEmotions();
      console.log(`Using ${knownEmotions.length} known emotions for analysis`);
      
      if (knownEmotions.length < 30) {
        console.error("WARNING: Found fewer emotions than expected. This might indicate a database issue.");
        
        // Let's try to debug by listing some table information
        const { data: tablesData, error: tablesError } = await userSupabase
          .from('emotions')
          .select('id, name')
          .limit(50);
          
        if (tablesError) {
          console.error('Error when trying to debug emotions table:', tablesError);
        } else {
          console.log(`Debug - emotions table sample (${tablesData?.length || 0} rows):`, tablesData);
        }
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

    // Fetch ALL journal entries with pagination to handle large datasets
    const pageSize = 25;
    let allEntries = [];
    let lastId = 0;
    let hasMore = true;
    
    while (hasMore) {
      console.log(`Fetching page of entries starting from ID > ${lastId}...`);
      
      const { data: entries, error } = await userSupabase
        .from('Journal Entries')
        .select('id, "refined text", "transcription text"')
        .order('id', { ascending: true })
        .gt('id', lastId)
        .limit(pageSize);
      
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
      
      if (!entries || entries.length === 0) {
        hasMore = false;
        break;
      }
      
      console.log(`Fetched ${entries.length} entries`);
      allEntries = allEntries.concat(entries);
      lastId = entries[entries.length - 1].id;
      
      // If we got fewer entries than the page size, we've reached the end
      if (entries.length < pageSize) {
        hasMore = false;
      }
    }
    
    console.log(`Found ${allEntries.length} total entries to process`);
    
    if (allEntries.length === 0) {
      console.log("No entries found to process");
      return new Response(
        JSON.stringify({ 
          message: 'No entries found to process',
          updated: 0 
        }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let updated = 0;
    let failed = 0;
    
    // Process entries in batches to avoid overwhelming the server
    const batchSize = 5;
    for (let i = 0; i < allEntries.length; i += batchSize) {
      const batch = allEntries.slice(i, i + batchSize);
      console.log(`Processing batch ${i/batchSize + 1} of ${Math.ceil(allEntries.length/batchSize)} (${batch.length} entries)`);
      
      // Process each entry in the batch
      const results = await Promise.allSettled(
        batch.map(async (entry) => {
          const text = entry["refined text"] || entry["transcription text"];
          if (!text) {
            console.log(`Entry ${entry.id} has no text content, skipping`);
            return { status: 'skipped', id: entry.id, reason: 'no text' };
          }

          try {
            // Analyze this entry
            console.log(`Processing entry ${entry.id} (text length: ${text.length})`);
            const { categories, entityemotion } = await analyzeText(text, knownEmotions);
            console.log(`Analysis complete for entry ${entry.id}: ${categories.length} categories found`);
            
            // Debug log the results
            console.log(`Categories for entry ${entry.id}:`, categories);
            console.log(`EntityEmotion sample for entry ${entry.id}:`, 
              Object.keys(entityemotion).slice(0, 2).map(cat => 
                `${cat}: ${JSON.stringify(Object.keys(entityemotion[cat]).slice(0, 3))}`
              )
            );
            
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
              return { status: 'failed', id: entry.id, error: updateErr };
            } else {
              console.log(`Successfully updated entry ${entry.id}`);
              return { status: 'success', id: entry.id };
            }
          } catch (processErr) {
            console.error(`Error processing entry ${entry.id}:`, processErr);
            return { status: 'failed', id: entry.id, error: processErr };
          }
        })
      );
      
      // Count successes and failures
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          if (result.value.status === 'success') {
            updated++;
          } else if (result.value.status === 'failed') {
            failed++;
          }
        } else {
          failed++;
        }
      });
      
      console.log(`Batch complete. Running totals - Updated: ${updated}, Failed: ${failed}`);
      
      // Add a small delay between batches to avoid rate limits
      if (i + batchSize < allEntries.length) {
        console.log('Pausing briefly before next batch...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`Processing complete. Updated: ${updated}, Failed: ${failed}`);
    return new Response(
      JSON.stringify({
        updated,
        failed,
        total: allEntries.length,
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

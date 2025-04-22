
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
  try {
    const { data, error } = await supabase
      .from('emotions')
      .select('name');
    if (error) {
      console.error('[temporary-process-entries] Error fetching emotions:', error);
      return [
        "joy", "sadness", "anger", "fear", "surprise", "disgust", "trust", "anticipation", "shame", "guilt", "curiosity", "anxiety", "pride", "gratitude", "calm", "boredom", "stress", "love"
      ];
    }
    if (!data || !Array.isArray(data)) {
      return [];
    }
    return data.map(e => typeof e.name === "string" ? e.name.toLowerCase() : "").filter(Boolean);
  } catch (err) {
    console.error('[temporary-process-entries] Exception fetching emotions:', err);
    return [];
  }
}

async function processEntry(entryId: number, text: string, knownEmotions: string[]) {
  try {
    if (!openAIApiKey) {
      console.error('OpenAI API key is missing or empty');
      return { success: false, error: 'OpenAI API key missing' };
    }

    const prompt = `
      Analyze the following journal entry and:
      1. Detect key entities or topics discussed (like love, relationship, life, work, money, parents, organizations, philosophy, etc). Give 3-10 such entities. Entities should be categories/labels, not specific people names, and capture any concepts, aspects, relationships, or social constructs present in the text.
      2. For each entity, select the top 3 strongest matching emotions from this list: [${knownEmotions.join(', ')}]
         - Provide the strength/score of each detected emotion for the entity (between 0 and 1, rounded to 1 decimal).
         - Only include emotions that are clearly relevant for the entity.
      Format your response as compact JSON with these keys:
      {
        "entities": [...],
        "entityemotion": {
          "entity1": { "emotion1": score, "emotion2": score, ... },
          "entity2": { ... }
        }
      }
      For example:
      {
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
            content: 'You are an advanced assistant that extracts entities and core emotions for each entity from journal entries. Always return only a well-formatted JSON object as specified in the request.'
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
      return { success: false, error: 'OpenAI API error' };
    }

    const result = await response.json();
    if (!result.choices || !result.choices[0]?.message?.content) {
      console.error('Invalid response structure from OpenAI');
      return { success: false, error: 'Invalid OpenAI response' };
    }

    let contentText = result.choices[0].message.content;
    try {
      const parsed = JSON.parse(contentText);
      
      // Update the entry with the analyzed entities and emotions
      const { error } = await supabase
        .from('Journal Entries')
        .update({
          entities: Array.isArray(parsed.entities) ? parsed.entities : [],
          entityemotion: typeof parsed.entityemotion === "object" && parsed.entityemotion !== null ? parsed.entityemotion : {}
        })
        .eq('id', entryId);
      
      if (error) {
        console.error(`Error updating entry ${entryId}:`, error);
        return { success: false, error: 'Database update error' };
      }
      
      return { success: true, entryId };
    } catch (err) {
      console.error('[temporary-process-entries] Error parsing JSON:', err, contentText);
      return { success: false, error: 'JSON parsing error' };
    }
  } catch (error) {
    console.error('Error processing entry:', error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Fetch known emotions
    const knownEmotions = await getKnownEmotions();
    
    // Fetch all journal entries that don't have entityemotion data
    const { data: entries, error } = await supabase
      .from('Journal Entries')
      .select('id, "refined text"')
      .is('entityemotion', null)
      .order('id', { ascending: true });
    
    if (error) {
      throw new Error(`Failed to fetch entries: ${error.message}`);
    }
    
    if (!entries || entries.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No entries to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Processing ${entries.length} entries`);
    
    const results = [];
    const totalEntries = entries.length;
    let successCount = 0;
    
    // Process entries sequentially to avoid rate limiting
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const entryId = entry.id;
      const entryText = entry["refined text"];
      
      if (!entryText) {
        results.push({ id: entryId, success: false, error: 'No text content' });
        continue;
      }
      
      console.log(`[${i+1}/${totalEntries}] Processing entry ${entryId}`);
      const result = await processEntry(entryId, entryText, knownEmotions);
      
      if (result.success) {
        successCount++;
      }
      
      results.push({ id: entryId, ...result });
      
      // Add a small delay between API calls to avoid rate limiting
      if (i < entries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        totalProcessed: totalEntries,
        successCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[temporary-process-entries] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

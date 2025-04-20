
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.24.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, days = 7 } = await req.json();
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Fetch recent journal entries
    const { data: entries, error: entriesError } = await supabase
      .from('Journal Entries')
      .select('id, "refined text", "transcription text", entities, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });
      
    if (entriesError) {
      console.error('Error fetching entries:', entriesError);
      return new Response(JSON.stringify({ error: 'Failed to fetch journal entries' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Process entities from all entries with improved handling
    const entitiesMap = new Map();
    let foundAnyEntities = false;

    console.log(`Processing ${entries.length} entries for entities`);
    
    entries.forEach(entry => {
      if (entry.entities) {
        console.log(`Found entities in entry ${entry.id}: `, typeof entry.entities, Array.isArray(entry.entities) ? 'array' : 'not array');
        
        // Handle different formats of entities
        let entityList = [];
        
        if (Array.isArray(entry.entities)) {
          entityList = entry.entities;
          console.log(`Entry ${entry.id} has array entities of length ${entityList.length}`);
        } else if (typeof entry.entities === 'string') {
          try {
            entityList = JSON.parse(entry.entities);
            console.log(`Entry ${entry.id} has string entities that parsed to:`, typeof entityList);
          } catch (e) {
            console.log(`Entry ${entry.id} has string entities that failed to parse, using as comma-separated`);
            entityList = entry.entities.split(',').map(e => e.trim()).filter(e => e);
          }
        } else if (typeof entry.entities === 'object') {
          entityList = Array.isArray(entry.entities) ? entry.entities : [entry.entities];
          console.log(`Entry ${entry.id} has object entities`);
        }
        
        // Process each entity
        if (entityList && entityList.length > 0) {
          foundAnyEntities = true;
          entityList.forEach(entity => {
            let entityName = '';
            let entityType = 'unknown';
            
            if (typeof entity === 'string') {
              entityName = entity.trim();
            } else if (entity && typeof entity === 'object') {
              if (entity.name) {
                entityName = entity.name.trim();
                entityType = entity.type || 'unknown';
              } else if (entity.text || entity.text?.content) {
                entityName = (entity.text?.content || entity.text).trim();
                entityType = entity.type || 'unknown';
              }
            }
            
            if (entityName && entityName.length > 1) {  // Filter out single character entities
              const key = entityName.toLowerCase();
              if (!entitiesMap.has(key)) {
                entitiesMap.set(key, { 
                  count: 0, 
                  type: entityType
                });
              }
              entitiesMap.get(key).count += 1;
            }
          });
        }
      }
    });
    
    console.log(`Found ${entitiesMap.size} unique entities from ${entries.length} entries`);
    
    // Get top entities
    const topEntities = Array.from(entitiesMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([name, data]) => ({ name, count: data.count, type: data.type }));
    
    // If no entries or entities found, return early
    if (!entries.length) {
      return new Response(JSON.stringify({ 
        summary: null,
        topEntities: [],
        hasEntries: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If we have entries but no entities, let's check if we need to process them with batch-extract-entities
    if (entries.length > 0 && !foundAnyEntities) {
      console.log("No entities found, but entries exist. We should trigger entity extraction.");
      
      // Get entry IDs that don't have entities
      const entryIds = entries.filter(e => !e.entities).map(e => e.id);
      
      if (entryIds.length > 0) {
        console.log(`Triggering entity extraction for ${entryIds.length} entries`);
        
        try {
          // Call the batch-extract-entities function
          const extractResponse = await fetch(`${supabaseUrl}/functions/v1/batch-extract-entities`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              entryIds: entryIds,
              diagnosticMode: true
            }),
          });
          
          if (extractResponse.ok) {
            console.log("Successfully triggered entity extraction");
            // We'll still proceed with the current response, but next time entities should be available
          } else {
            console.error("Failed to trigger entity extraction:", await extractResponse.text());
          }
        } catch (extractError) {
          console.error("Error triggering entity extraction:", extractError);
        }
      }
    }
    
    // Combine all journal texts for summary
    const journalTexts = entries.map(entry => 
      entry["refined text"] || entry["transcription text"] || ""
    ).join("\n\n");
    
    // Generate summary using OpenAI
    const prompt = `Analyze these journal entries from the last ${days} days and generate a brief summary in less than 30 words: \n\n${journalTexts}`;
    
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an empathetic personal journal assistant. Create very brief, insightful summaries.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.7,
      }),
    });
    
    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error("OpenAI error:", errorText);
      throw new Error(`OpenAI API error: ${openAIResponse.status} ${errorText}`);
    }
    
    const aiData = await openAIResponse.json();
    const summary = aiData.choices[0].message.content.trim();
    
    return new Response(JSON.stringify({ 
      summary,
      topEntities,
      hasEntries: true,
      entryCount: entries.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in journal-summary function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

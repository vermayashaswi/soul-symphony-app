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
  console.log('[journal-summary] Function called');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Add timeout protection
  const FUNCTION_TIMEOUT = 15000; // 15 seconds
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Function timeout after 15 seconds')), FUNCTION_TIMEOUT);
  });

  try {
    const processingPromise = (async () => {
      console.log('[journal-summary] Processing request');
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
        return new Response(JSON.stringify({ 
          summary: "Unable to fetch journal entries at this time.",
          topEntities: [],
          hasEntries: false,
          error: 'Failed to fetch journal entries'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Process entities from all entries
      const entitiesMap = new Map();
      entries?.forEach(entry => {
        if (entry.entities && Array.isArray(entry.entities)) {
          entry.entities.forEach(entity => {
            if (entity && entity.name) {
              const key = entity.name.toLowerCase();
              if (!entitiesMap.has(key)) {
                entitiesMap.set(key, { count: 0, type: entity.type });
              }
              entitiesMap.get(key).count += 1;
            }
          });
        }
      });
      
      // Get top entities
      const topEntities = Array.from(entitiesMap.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([name, data]) => ({ name, count: data.count, type: data.type }));
      
      // If no entries found, return early
      if (!entries?.length) {
        console.log('[journal-summary] No entries found for user:', userId);
        return new Response(JSON.stringify({ 
          summary: "No journal entries found for the specified period.",
          topEntities: [],
          hasEntries: false
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Combine all journal texts
      const journalTexts = entries.map(entry => 
        entry["refined text"] || entry["transcription text"] || ""
      ).join("\n\n");
      
      // If we have journal entries, generate summary using OpenAI
      const prompt = `Analyze these journal entries from the last ${days} days and generate a brief summary in less than 30 words: \n\n${journalTexts}`;
      
      let summary = "Unable to generate summary at this time.";
      
      try {
        console.log('[journal-summary] Calling OpenAI API');
        if (!openAIApiKey) {
          throw new Error('OpenAI API key not configured');
        }
        
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
        summary = aiData.choices[0].message.content.trim();
        console.log('[journal-summary] OpenAI summary generated successfully');
      } catch (openAIError) {
        console.error('[journal-summary] OpenAI failed, using fallback:', openAIError);
        summary = `Reflecting on ${entries.length} journal entries from the past ${days} days. Your journey continues with valuable insights.`;
      }
      
      return new Response(JSON.stringify({ 
        summary,
        topEntities,
        hasEntries: true,
        entryCount: entries.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    })();

    // Race between processing and timeout
    const result = await Promise.race([processingPromise, timeoutPromise]);
    console.log('[journal-summary] Function completed successfully');
    return result;
  } catch (error) {
    console.error('[journal-summary] Error in function:', error);
    
    // Always return a valid response even on error
    return new Response(JSON.stringify({ 
      summary: "Journal summary temporarily unavailable.",
      topEntities: [],
      hasEntries: false,
      error: error.message
    }), {
      status: 200, // Return 200 to prevent blocking
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { text, entryId } = await req.json();
    
    if (!text) {
      return new Response(
        JSON.stringify({ error: 'No text provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Generating themes for entry ${entryId}`);
    
    // Extract themes using OpenAI
    const themes = await extractThemes(text);
    console.log('Generated themes:', themes);
    
    // If entryId is provided, update the database
    if (entryId) {
      await updateEntryThemes(entryId, themes);
    }
    
    return new Response(
      JSON.stringify({ themes }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-themes function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function extractThemes(text: string): Promise<string[]> {
  const prompt = `
    Extract the 5 most important emotional themes or concepts from the following journal entry.
    Return them as a JSON array of strings, with each string being a single word or very short phrase (max 2-3 words).
    Focus on emotional states, personal growth concepts, or psychological themes.
    
    For example: ["gratitude", "work stress", "family connection", "personal growth", "anxiety"]
    
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
          { role: 'system', content: 'You analyze journal entries and extract key emotional themes. Always respond with a valid JSON array of strings.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    console.log("OpenAI response:", data);
    
    const content = data.choices?.[0]?.message?.content || '';
    
    try {
      // Attempt to clean and parse JSON from the response
      const cleanedContent = content.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Error parsing themes:', parseError);
      // Fallback: try to extract using regex if JSON parsing fails
      const matches = content.match(/\["([^"]+)"(?:,\s*"([^"]+)")*\]/);
      if (matches) {
        return matches[0].split(/,\s*/).map(s => s.replace(/[\[\]"]/g, ''));
      }
      // Last resort fallback
      return ["emotion", "feeling", "reflection", "thought", "insight"];
    }
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    throw error;
  }
}

async function updateEntryThemes(entryId: number, themes: string[]): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { error } = await supabase
      .from('Journal Entries')
      .update({ master_themes: themes })
      .eq('id', entryId);
      
    if (error) {
      console.error('Error updating entry themes:', error);
      throw error;
    }
    
    console.log(`Updated themes for entry ${entryId}`);
  } catch (error) {
    console.error('Error in updateEntryThemes:', error);
    throw error;
  }
}

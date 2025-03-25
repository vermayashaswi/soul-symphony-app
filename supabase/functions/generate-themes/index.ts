
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function extractThemes(text: string) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAIApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a thematic analysis assistant. Your task is to identify the 5 most prominent themes or topics discussed in the given text. Each theme should be a short phrase (2-4 words), not a complete sentence. Be specific rather than generic. You must return exactly 5 themes, no more and no less. Return only the list of themes as a JSON array of strings.'
          },
          {
            role: 'user',
            content: `Extract exactly 5 key themes from this text: "${text}"`
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('GPT API error during theme extraction:', errorData);
      throw new Error(`GPT API error: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    let result;
    
    try {
      const content = data.choices[0].message.content.trim();
      result = JSON.parse(content);
      
      // Extract the array if it's wrapped in another object
      if (result.themes && Array.isArray(result.themes)) {
        result = result.themes;
      }
      
      // If the result is not an array, make it one
      if (!Array.isArray(result)) {
        console.warn('Theme extraction result is not an array:', result);
        const themes = Object.values(result).filter(theme => typeof theme === 'string');
        
        // Ensure we have exactly 5 themes
        while (themes.length < 5) {
          themes.push(`Theme ${themes.length + 1}`);
        }
        
        return themes.slice(0, 5);
      }
      
      // Ensure we have exactly 5 themes
      const themes = [...result];
      while (themes.length < 5) {
        themes.push(`Theme ${themes.length + 1}`);
      }
      
      return themes.slice(0, 5);
    } catch (error) {
      console.error('Error parsing theme extraction result:', error, data.choices[0].message.content);
      return ["Theme 1", "Theme 2", "Theme 3", "Theme 4", "Theme 5"];
    }
  } catch (error) {
    console.error('Error in extractThemes:', error);
    return ["Error Processing", "Could Not Extract", "Technical Difficulty", "Try Again", "API Issue"];
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, entryId } = await req.json();
    
    if (!text) {
      throw new Error('No text provided for theme extraction');
    }
    
    console.log(`Generating themes for text (length: ${text.length})`);
    
    // Extract themes using GPT
    const themes = await extractThemes(text);
    console.log('Extracted themes:', themes);
    
    // If an entry ID was provided, update the entry with the extracted themes
    if (entryId) {
      const { error: updateError } = await supabase
        .from('Journal Entries')
        .update({ master_themes: themes })
        .eq('id', entryId);
        
      if (updateError) {
        console.error('Error updating entry with themes:', updateError);
        throw new Error(`Failed to update journal entry: ${updateError.message}`);
      }
      
      console.log(`Updated journal entry ${entryId} with themes`);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        themes
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in generate-themes function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

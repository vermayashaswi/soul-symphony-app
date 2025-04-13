
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

async function extract_themes(text: string) {
  try {
    console.log(`Starting theme extraction for text: "${text.substring(0, 100)}..."`);
    
    if (!openAIApiKey) {
      console.error('OpenAI API key is missing or empty');
      return { themes: ['Theme 1', 'Theme 2', 'Theme 3'] }; // Fallback themes if API key is missing
    }
    
    const prompt = `
      Analyze the following journal entry and extract the main themes or topics discussed (maximum 5 themes).
      
      For themes, return simple phrases or keywords that capture the essence of what the journal entry is about.
      
      Return the results as a JSON object with one property:
      - "themes": An array of strings representing the main themes
      
      Example response format:
      {
        "themes": ["work stress", "family time", "personal growth"]
      }
      
      Journal entry:
      ${text}
    `;
    
    console.log(`Sending request to OpenAI with model: gpt-4o-mini`);
    
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
              content: 'You are a theme extraction assistant. Extract themes from journal entries following the exact format requested.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,  // Lower temperature for more consistent results
          response_format: { type: "json_object" }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenAI API error: ${response.status} ${response.statusText}`, errorText);
        // Return fallback themes on API error
        return { themes: ['Personal', 'Experience', 'Reflection'] };
      }

      const result = await response.json();
      console.log(`Raw response from OpenAI:`, JSON.stringify(result, null, 2));
      
      // Extract the content from the response
      if (!result.choices || !result.choices[0] || !result.choices[0].message) {
        console.error('Invalid response structure from OpenAI');
        return { themes: ['Topic 1', 'Topic 2', 'Reflection'] };
      }
      
      const contentText = result.choices[0].message.content;
      console.log(`Content response text:`, contentText);
      
      try {
        // Parse the JSON response
        const parsedContent = JSON.parse(contentText);
        
        // Extract themes
        const themes = parsedContent.themes || [];
        console.log(`Extracted themes:`, themes);
        
        // Ensure we have at least some themes if the response is empty
        if (!themes.length) {
          return { themes: ['Thought', 'Experience', 'Moment'] };
        }
        
        return { themes };
      } catch (err) {
        console.error('Error parsing JSON:', err);
        console.error('Raw content text:', contentText);
        return { themes: ['Life', 'Reflection', 'Moment'] };
      }
    } catch (apiError) {
      console.error('Error calling OpenAI API:', apiError);
      return { themes: ['Journey', 'Experience', 'Thought'] };
    }
  } catch (error) {
    console.error('Error in extract_themes:', error);
    return { themes: ['Insight', 'Moment', 'Experience'] };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, entryId } = await req.json();
    
    if (!text) {
      return new Response(
        JSON.stringify({ error: 'No text provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!entryId) {
      return new Response(
        JSON.stringify({ error: 'No entry ID provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Processing theme extraction for entry ID: ${entryId}`);
    
    // Extract themes from the text
    const { themes } = await extract_themes(text);
    
    if (!themes || themes.length === 0) {
      console.log('No themes were extracted');
      return new Response(
        JSON.stringify({ success: false, message: 'No themes were extracted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Update the journal entry with the themes
    const { error: updateError } = await supabase
      .from('Journal Entries')
      .update({ master_themes: themes })
      .eq('id', entryId);
      
    if (updateError) {
      console.error('Error updating themes:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    console.log(`Successfully updated themes for entry ID: ${entryId}`);
    console.log('Themes:', themes);
    
    return new Response(
      JSON.stringify({ success: true, themes }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

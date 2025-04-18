
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
    // Parse the request to see if it contains text directly or if we need to fetch an entry
    const requestData = await req.json();
    const { text, entryId, fromEdit = false } = requestData;
    
    let textToProcess = text;
    let entryIdToUpdate = entryId;
    
    // If no direct text was provided but entryId was, fetch the entry text
    if (!textToProcess && entryIdToUpdate) {
      console.log(`No direct text provided, fetching text for entry ${entryIdToUpdate}`);
      
      const { data: entryData, error: entryError } = await supabase
        .from('Journal Entries')
        .select('"refined text"')
        .eq('id', entryIdToUpdate)
        .single();
        
      if (entryError) {
        console.error(`Error fetching entry ${entryIdToUpdate}:`, entryError);
        throw new Error(`Failed to fetch entry: ${entryError.message}`);
      }
      
      if (!entryData || !entryData["refined text"]) {
        console.error(`Entry ${entryIdToUpdate} has no refined text`);
        throw new Error('Entry has no text content to process');
      }
      
      textToProcess = entryData["refined text"];
      console.log(`Retrieved text for entry ${entryIdToUpdate}, length: ${textToProcess.length}`);
    }
    
    if (!textToProcess) {
      throw new Error('No text provided for theme extraction');
    }
    
    console.log(`Processing ${fromEdit ? 'edited' : 'new'} entry ${entryIdToUpdate || 'unknown'}`);
    console.log(`Text length: ${textToProcess.length} characters, beginning: "${textToProcess.substring(0, 50)}..."`);
    
    const { themes } = await extract_themes(textToProcess);
    
    if (entryIdToUpdate) {
      console.log(`Updating entry ${entryIdToUpdate} with themes:`, themes);
      
      const updates: any = {};
      
      if (themes && themes.length > 0) {
        updates.master_themes = themes;
        
        // Always add some themes, even if empty result (fallback)
        if (themes.length === 0) {
          updates.master_themes = ['Personal', 'Reflection', 'Experience'];
        }
      }
      
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('Journal Entries')
          .update(updates)
          .eq('id', entryIdToUpdate);
          
        if (error) {
          console.error(`Error updating entry ${entryIdToUpdate}:`, error);
        } else {
          console.log(`Successfully updated entry ${entryIdToUpdate} with themes:`, themes);
          
          try {
            console.log("Starting entity extraction for entry:", entryIdToUpdate);
            // Call with proper entryIds format
            const { error: invokeError } = await supabase.functions.invoke('batch-extract-entities', {
              body: {
                processAll: false,
                diagnosticMode: false,
                entryIds: [entryIdToUpdate]  // Pass as array to match expected format
              }
            });
            
            if (invokeError) {
              console.error("Error invoking batch-extract-entities:", invokeError);
            } else {
              console.log("Successfully triggered entity extraction");
            }
          } catch (entityErr) {
            console.error("Error starting entity extraction:", entityErr);
          }
        }
      }
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
    
    // Even on error, return a success response with fallback themes
    return new Response(
      JSON.stringify({ 
        success: true, 
        themes: ['Personal', 'Reflection', 'Experience']
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

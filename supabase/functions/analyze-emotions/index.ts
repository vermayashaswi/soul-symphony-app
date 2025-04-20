
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

async function analyzeEmotions(text: string) {
  try {
    console.log('Analyzing emotions for text:', text.slice(0, 100) + '...');
    
    if (!openAIApiKey) {
      console.error('OpenAI API key is missing or empty');
      return { emotions: { "Unknown": 0.5 } }; // Provide a default instead of empty object
    }
    
    // Get emotions data from database
    const { data: emotionsData, error: emotionsError } = await supabase
      .from('emotions')
      .select('name, description')
      .order('id', { ascending: true });
      
    if (emotionsError) {
      console.error('Error fetching emotions from database:', emotionsError);
      return { emotions: { "Joy": 0.3, "Sadness": 0.2 } }; // Fallback emotions
    }
    
    // Create a list of emotions for the prompt
    const emotionsList = emotionsData.map(e => `- ${e.name}: ${e.description}`).join('\n');
    
    // If text is too short, return default emotions
    if (text.trim().length < 5) {
      console.warn('Text too short for emotion analysis:', text);
      return { emotions: { "Neutral": 0.5 } };
    }
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openAIApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an emotion analysis assistant. You will analyze text and identify emotions expressed in it.
            Analyze the text and select up to 5 of the most prominent emotions from this list:
            ${emotionsList}
            
            For each emotion you identify, provide an intensity score from 0.1 to 1.0 (with 1.0 being the strongest).
            Always provide at least one emotion, even if the text seems neutral (use a lower intensity score in that case).
            
            Format your response as JSON without explanations, like this example:
            {"Joy": 0.8, "Gratitude": 0.6, "Curiosity": 0.4, "Contentment": 0.3, "Hope": 0.2}`
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent results
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      return { emotions: { "Neutral": 0.5, "Curiosity": 0.3 } }; // Fallback
    }
    
    const result = await response.json();
    
    // Validate the response structure
    if (!result.choices || !result.choices[0] || !result.choices[0].message || !result.choices[0].message.content) {
      console.error("Invalid response structure from OpenAI:", result);
      return { emotions: { "Confusion": 0.4 } }; // Fallback
    }
    
    let emotionsObject: Record<string, number> = {};
    
    try {
      // Parse the response content as JSON
      const parsedContent = JSON.parse(result.choices[0].message.content);
      
      // Check if we got at least one emotion
      if (Object.keys(parsedContent).length === 0) {
        console.warn("OpenAI returned empty emotions object");
        emotionsObject = { "Neutral": 0.5 };
      } else {
        emotionsObject = parsedContent;
      }
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      emotionsObject = { "Error": 0.5, "Confusion": 0.3 };
    }
    
    console.log("Emotions analyzed successfully:", emotionsObject);
    
    return { emotions: emotionsObject };
  } catch (error) {
    console.error('Error in analyzeEmotions:', error);
    return { emotions: { "Neutral": 0.5 } }; // Always return something, never empty
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    const { text, entryId } = requestData;
    
    if (!text) {
      throw new Error('No text provided for emotion analysis');
    }
    
    console.log(`Processing emotion analysis for entry ${entryId}`);
    console.log(`Text length: ${text.length} characters, beginning: "${text.substring(0, 50)}..."`);
    
    const { emotions } = await analyzeEmotions(text);
    
    if (entryId) {
      console.log(`Updating entry ${entryId} with emotions:`, emotions);
      
      // First, get existing entities to make sure we don't overwrite them
      const { data: existingData, error: fetchError } = await supabase
        .from('Journal Entries')
        .select('entities')
        .eq('id', entryId)
        .single();
        
      if (fetchError) {
        console.error(`Error fetching existing data for entry ${entryId}:`, fetchError);
      }
      
      // Format entities if they exist
      let formattedEntities = null;
      if (existingData?.entities) {
        try {
          if (Array.isArray(existingData.entities)) {
            formattedEntities = existingData.entities.map(entity => ({
              type: entity.type || 'other',
              name: entity.name || 'unknown',
              text: entity.text
            }));
          }
        } catch (err) {
          console.error(`Error formatting entities for entry ${entryId}:`, err);
          formattedEntities = existingData.entities;
        }
      }
      
      // Update the entry with emotions and properly formatted entities
      const updateData: Record<string, any> = { emotions };
      if (formattedEntities !== null) {
        updateData.entities = formattedEntities;
      }
      
      const { error } = await supabase
        .from('Journal Entries')
        .update(updateData)
        .eq('id', entryId);
        
      if (error) {
        console.error(`Error updating entry ${entryId}:`, error);
      } else {
        console.log(`Successfully updated entry ${entryId} with emotions:`, emotions);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        emotions
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in analyze-emotions function:', error);
    
    // Even on error, return a success response with fallback emotions
    return new Response(
      JSON.stringify({
        success: true,
        emotions: { "Neutral": 0.5 }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

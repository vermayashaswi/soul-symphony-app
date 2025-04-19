
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
      return { emotions: {} }; 
    }
    
    // Get emotions data from database
    const { data: emotionsData, error: emotionsError } = await supabase
      .from('emotions')
      .select('name, description')
      .order('id', { ascending: true });
      
    if (emotionsError) {
      console.error('Error fetching emotions from database:', emotionsError);
      return { emotions: {} };
    }
    
    // Create a list of emotions for the prompt
    const emotionsList = emotionsData.map(e => `- ${e.name}: ${e.description}`).join('\n');
    
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
            Analyze the text and select up to 3 of the most prominent emotions from this list:
            ${emotionsList}
            
            For each emotion you identify, provide an intensity score from 0.1 to 1.0 (with 1.0 being the strongest).
            Format your response as JSON without explanations, like this example:
            [{"name": "Joy", "intensity": 0.8}, {"name": "Gratitude", "intensity": 0.6}]`
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      return { emotions: {} };
    }
    
    const result = await response.json();
    const emotions = JSON.parse(result.choices[0].message.content);
    
    console.log("Emotions analyzed successfully:", emotions);
    
    // Convert array to object format for storage
    const emotionsObject: Record<string, number> = {};
    emotions.forEach((emotion: { name: string, intensity: number }) => {
      emotionsObject[emotion.name] = emotion.intensity;
    });
    
    return { emotions: emotionsObject };
  } catch (error) {
    console.error('Error in analyzeEmotions:', error);
    return { emotions: {} };
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
        console.log(`Successfully updated entry ${entryId} with emotions`);
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
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});


import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

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
    // Get the API key from environment variables
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API');
    
    if (!GOOGLE_API_KEY) {
      console.error('Missing Google API key in environment variables');
      throw new Error('Missing Google API key');
    }

    console.log('Starting translation with provided API key');
    
    // Parse request body
    const { text, sourceLanguage, targetLanguage = 'hi', entryId } = await req.json();

    if (!text || !entryId) {
      throw new Error('Missing required parameters: text and entryId are required');
    }

    console.log(`Translating text for entry ${entryId}: "${text.substring(0, 50)}..." from ${sourceLanguage || 'auto-detect'} to ${targetLanguage}`);

    // First detect the language if sourceLanguage is not provided
    let detectedLanguage = sourceLanguage;
    if (!sourceLanguage) {
      const detectUrl = `https://translation.googleapis.com/language/translate/v2/detect?key=${GOOGLE_API_KEY}`;
      console.log(`Detecting language with URL: ${detectUrl}`);
      
      const detectResponse = await fetch(detectUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text })
      });

      if (!detectResponse.ok) {
        const errorData = await detectResponse.text();
        console.error(`Language detection failed with status ${detectResponse.status}: ${errorData}`);
        throw new Error(`Language detection failed: ${detectResponse.statusText}`);
      }

      const detectData = await detectResponse.json();
      console.log('Detect API response:', JSON.stringify(detectData));
      
      if (!detectData.data || !detectData.data.detections || !detectData.data.detections[0] || !detectData.data.detections[0][0]) {
        console.error('Invalid detection response format:', JSON.stringify(detectData));
        throw new Error('Invalid detection response format');
      }
      
      detectedLanguage = detectData.data.detections[0][0].language;
      console.log(`Detected language: ${detectedLanguage}`);
    }

    // Then translate the text
    const translateUrl = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_API_KEY}`;
    console.log(`Sending translation request to: ${translateUrl}`);
    console.log(`Request parameters: from ${detectedLanguage} to ${targetLanguage}`);
    
    const translateResponse = await fetch(translateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: detectedLanguage,
        target: targetLanguage,
        format: 'text'
      })
    });

    if (!translateResponse.ok) {
      const errorData = await translateResponse.text();
      console.error(`Translation failed with status ${translateResponse.status}: ${errorData}`);
      throw new Error(`Translation failed: ${translateResponse.statusText}`);
    }

    const translateData = await translateResponse.json();
    console.log('Translation API response:', JSON.stringify(translateData));
    
    // Check if the response has the expected structure
    if (!translateData.data || !translateData.data.translations || !translateData.data.translations[0]) {
      console.error('Invalid translation response format:', JSON.stringify(translateData));
      throw new Error('Invalid translation response format');
    }
    
    const translatedText = translateData.data.translations[0].translatedText;
    console.log(`Translated text: "${translatedText.substring(0, 50)}..."`);

    // Update the database with the translation - UPDATED TO USE NEW SCHEMA WITHOUT _hi REFERENCES
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Connecting to Supabase to update entry');
    
    // Store the translation in the translation_text field and update metadata
    let updateFields = {
      "original_language": detectedLanguage,
      "translation_status": "completed",
      "translation_text": translatedText // Store translation in a generic field
    };

    console.log(`Updating entry ${entryId} with translated text and fields:`, updateFields);
    const { error: updateError } = await supabase
      .from('Journal Entries')
      .update(updateFields)
      .eq('id', entryId);

    if (updateError) {
      console.error(`Database update error: ${updateError.message}`, updateError);
      throw updateError;
    }

    console.log(`Successfully updated entry ${entryId}`);
    return new Response(
      JSON.stringify({
        translatedText,
        detectedLanguage,
        success: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in translate-text function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        name: error.name
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

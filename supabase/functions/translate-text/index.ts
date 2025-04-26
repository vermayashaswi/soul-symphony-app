
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
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API');
    
    if (!GOOGLE_API_KEY) {
      throw new Error('Missing Google API key');
    }

    const { text, sourceLanguage, targetLanguage = 'hi', entryId } = await req.json();

    if (!text || !entryId) {
      throw new Error('Missing required parameters');
    }

    // First detect the language if sourceLanguage is not provided
    let detectedLanguage = sourceLanguage;
    if (!sourceLanguage) {
      const detectResponse = await fetch(
        `https://translation.googleapis.com/language/translate/v2/detect?key=${GOOGLE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: text })
        }
      );

      const detectData = await detectResponse.json();
      detectedLanguage = detectData.data.detections[0][0].language;
    }

    // Then translate the text
    const translateResponse = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: detectedLanguage,
          target: targetLanguage,
          format: 'text'
        })
      }
    );

    const translateData = await translateResponse.json();
    const translatedText = translateData.data.translations[0].translatedText;

    // Update the database with the translation
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let updateFields = {};
    if (detectedLanguage === 'en') {
      updateFields = {
        "refined text_hi": translatedText,
        "original_language": detectedLanguage,
        "translation_status": "completed"
      };
    } else if (detectedLanguage === 'hi') {
      updateFields = {
        "refined text": translatedText,
        "original_language": detectedLanguage,
        "translation_status": "completed"
      };
    }

    const { error: updateError } = await supabase
      .from('Journal Entries')
      .update(updateFields)
      .eq('id', entryId);

    if (updateError) {
      throw updateError;
    }

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
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

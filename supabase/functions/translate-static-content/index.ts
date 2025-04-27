
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
    
    // Parse request body
    const { texts, targetLanguage = 'hi', sourceLanguage = 'en' } = await req.json();

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      throw new Error('Missing required parameter: texts (array)');
    }

    console.log(`Translating ${texts.length} text items to ${targetLanguage}`);

    // Translate the texts
    const translateUrl = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_API_KEY}`;
    console.log(`Sending translation request to: ${translateUrl}`);
    
    const translateResponse = await fetch(translateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: texts,
        source: sourceLanguage,
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
    
    // Check if the response has the expected structure
    if (!translateData.data || !translateData.data.translations) {
      console.error('Invalid translation response format:', JSON.stringify(translateData));
      throw new Error('Invalid translation response format');
    }
    
    const translations = translateData.data.translations.map((item, index) => ({
      original: texts[index],
      translated: item.translatedText
    }));

    console.log(`Successfully translated ${translations.length} items`);
    
    return new Response(
      JSON.stringify({
        translations,
        success: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[translate-static-content] Error:', error);
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

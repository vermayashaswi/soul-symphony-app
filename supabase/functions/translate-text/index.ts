
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handler for CORS preflight requests
function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
}

// Create Supabase client
function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
  return createClient(supabaseUrl, supabaseKey);
}

// Main function handler
serve(async (req: Request) => {
  // Handle CORS preflight request
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  
  // Get the Google Translate API key
  const apiKey = Deno.env.get('GOOGLE_API');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Translation API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    const { text, texts, sourceLanguage, targetLanguage, entryId } = await req.json();
    
    // Handle batch translation
    if (texts) {
      const translatedTexts = await Promise.all(
        texts.map((t: string) => translateSingle(t, sourceLanguage || 'en', targetLanguage, apiKey))
      );
      
      return new Response(
        JSON.stringify({ translatedTexts }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Handle single text translation
    if (!text) {
      return new Response(
        JSON.stringify({ error: 'No text provided for translation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Don't translate if source and target languages are the same
    if (sourceLanguage === targetLanguage) {
      return new Response(
        JSON.stringify({ translatedText: text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Translating text: "${text.substring(0, 30)}..." from ${sourceLanguage || 'auto'} to ${targetLanguage}`);
    
    // Translate the text
    const translatedText = await translateSingle(text, sourceLanguage, targetLanguage, apiKey);
    
    // Only update database if entryId is provided
    if (entryId) {
      try {
        const supabase = createSupabaseClient();
        
        // Update translation in the database
        const { error } = await supabase
          .from('Journal Entries')
          .update({ 
            [`translated_${targetLanguage}`]: translatedText,
            translation_status: 'completed'  
          })
          .eq('id', entryId);
        
        if (error) {
          console.error('Error updating translation in database:', error);
        }
      } catch (dbError) {
        console.error('[translate-text] Database error:', dbError);
      }
    } else {
      console.log('[translate-text] No entryId provided, skipping database update');
    }
    
    return new Response(
      JSON.stringify({ translatedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in translate-text function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Function to translate a single text
async function translateSingle(text: string, sourceLanguage: string | undefined, targetLanguage: string, apiKey: string): Promise<string> {
  // Skip if source equals target language
  if (sourceLanguage === targetLanguage) {
    return text;
  }

  // Skip empty text
  if (!text || text.trim() === '') {
    return text;
  }

  console.log(`Translating text: "${text.substring(0, 30)}..." from ${sourceLanguage || 'en'} to ${targetLanguage}`);
  console.log("Starting translation with provided API key");
  
  // Set up API URL
  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
  console.log(`Sending translation request to: ${url}`);
  
  // Set up request
  const requestBody: any = {
    q: text,
    target: targetLanguage,
  };
  
  // Add source language if provided
  if (sourceLanguage && sourceLanguage !== 'auto') {
    requestBody.source = sourceLanguage;
  }
  
  console.log(`Request parameters: from ${sourceLanguage || 'auto'} to ${targetLanguage}`);
  
  // Call Google Translate API
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Translation API error (${response.status}): ${errorText}`);
  }
  
  // Parse response
  const data = await response.json();
  console.log(`Translation API response: ${JSON.stringify(data)}`);
  
  if (!data.data || !data.data.translations || !data.data.translations[0]) {
    throw new Error('Invalid translation API response');
  }
  
  // Get translated text
  const translatedText = data.data.translations[0].translatedText;
  console.log(`Raw translated text: "${translatedText}"`);
  
  // Clean up the result - remove language tags that might be appended
  const cleanedText = cleanTranslationResult(translatedText);
  console.log(`Cleaned translated text: "${cleanedText}"`);
  
  return cleanedText;
}

// Helper function to clean translation results
function cleanTranslationResult(result: string): string {
  if (!result) return '';
  
  // Remove language code suffix like "(hi)" or "[hi]" that might be appended
  const languageCodeRegex = /\s*[\(\[]([a-z]{2})[\)\]]\s*$/i;
  return result.replace(languageCodeRegex, '');
}

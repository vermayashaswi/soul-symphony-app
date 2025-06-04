
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
    const { text, sourceLanguage, targetLanguage = 'hi', entryId, cleanResult = true, useDetectedLanguages = true } = await req.json();

    if (!text) {
      throw new Error('Missing required parameter: text is required');
    }

    console.log(`Translating text: "${text.substring(0, 50)}..." from ${sourceLanguage || 'auto-detect'} to ${targetLanguage}${entryId ? ` for entry ${entryId}` : ''}`);

    // Initialize Supabase if entryId is provided to fetch detected languages
    let detectedLanguagesFromDB = [];
    let finalSourceLanguage = sourceLanguage;

    if (entryId && useDetectedLanguages) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        console.log(`[translate-text] Fetching detected languages for entry ${entryId}`);
        
        const { data: entryData, error: fetchError } = await supabase
          .from('Journal Entries')
          .select('languages')
          .eq('id', entryId)
          .single();

        if (!fetchError && entryData && entryData.languages) {
          detectedLanguagesFromDB = Array.isArray(entryData.languages) ? entryData.languages : [];
          console.log(`[translate-text] Found detected languages: ${JSON.stringify(detectedLanguagesFromDB)}`);
          
          // Use the primary detected language if no source language was specified
          if (!sourceLanguage && detectedLanguagesFromDB.length > 0) {
            finalSourceLanguage = detectedLanguagesFromDB[0];
            console.log(`[translate-text] Using primary detected language: ${finalSourceLanguage}`);
          }
        } else {
          console.log(`[translate-text] No detected languages found for entry ${entryId}`);
        }
      } catch (dbError) {
        console.error(`[translate-text] Error fetching detected languages:`, dbError);
        // Continue with original flow if database lookup fails
      }
    }

    // Language detection (if needed)
    let detectedLanguage = finalSourceLanguage;
    if (!detectedLanguage) {
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
      console.log(`Detected language via Google API: ${detectedLanguage}`);
    }

    // Validate detected language against database languages for consistency
    if (detectedLanguagesFromDB.length > 0 && !detectedLanguagesFromDB.includes(detectedLanguage)) {
      console.log(`[translate-text] Warning: Detected language ${detectedLanguage} not in stored languages ${JSON.stringify(detectedLanguagesFromDB)}`);
      console.log(`[translate-text] Using stored primary language: ${detectedLanguagesFromDB[0]}`);
      detectedLanguage = detectedLanguagesFromDB[0];
    }

    // Check if translation is needed
    if (detectedLanguage === targetLanguage) {
      console.log(`[translate-text] Source and target languages are the same (${targetLanguage}), skipping translation`);
      
      // Still update the database with language information if entryId is provided
      if (entryId) {
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const supabase = createClient(supabaseUrl, supabaseKey);
          
          const updateFields = {
            "original_language": detectedLanguage,
            "translation_text": text // Use original text as "translation"
          };
          
          const { error: updateError } = await supabase
            .from('Journal Entries')
            .update(updateFields)
            .eq('id', entryId);
            
          if (updateError) {
            console.error(`[translate-text] Database update error:`, updateError);
          } else {
            console.log(`[translate-text] Updated entry ${entryId} with same-language info`);
          }
        } catch (dbError) {
          console.error(`[translate-text] Database operation error:`, dbError);
        }
      }
      
      return new Response(
        JSON.stringify({
          translatedText: text,
          detectedLanguage: detectedLanguage,
          success: true,
          skippedTranslation: true,
          detectedLanguagesFromDB: detectedLanguagesFromDB
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Perform translation
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
        format: 'text' // Ensure we're using text format, not HTML
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
    
    let translatedText = translateData.data.translations[0].translatedText;
    console.log(`Raw translated text: "${translatedText.substring(0, 50)}..."`);
    
    // Clean the translation result if requested
    if (cleanResult) {
      // Remove language code suffix like "(hi)" or "[hi]" that might be appended
      const languageCodeRegex = /\s*[\(\[]([a-z]{2})[\)\]]\s*$/i;
      translatedText = translatedText.replace(languageCodeRegex, '').trim();
      console.log(`Cleaned translated text: "${translatedText.substring(0, 50)}..."`);
    }

    // Update the database with the translation and language information
    if (entryId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
    
        console.log(`[translate-text] Updating entry ${entryId} with translation`);
    
        const updateFields = {
          "original_language": detectedLanguage,
          "translation_text": translatedText
        };
    
        console.log('[translate-text] Update fields:', JSON.stringify(updateFields, null, 2));
    
        const { error: updateError } = await supabase
          .from('Journal Entries')
          .update(updateFields)
          .eq('id', entryId);
    
        if (updateError) {
          console.error(`[translate-text] Database update error:`, updateError);
          // Don't throw here, just log the error and continue
        } else {
          console.log(`[translate-text] Successfully updated entry ${entryId}`);
          
          // Now trigger the post-processing functions for this entry
          try {
            console.log(`[translate-text] Triggering post-processing for entry ${entryId}`);
            
            // Trigger entity extraction
            const entityPromise = supabase.functions.invoke('batch-extract-entities', {
              body: {
                entryIds: [entryId],
                diagnosticMode: true
              }
            });
            
            // Trigger sentiment analysis
            const sentimentPromise = supabase.functions.invoke('analyze-sentiment', {
              body: { text: translatedText, entryId }
            });
            
            // Trigger themes extraction
            const themePromise = supabase.functions.invoke('generate-themes', {
              body: { entryId, fromEdit: false }
            });
            
            // Execute these in the background
            if (typeof EdgeRuntime !== 'undefined' && 'waitUntil' in EdgeRuntime) {
              EdgeRuntime.waitUntil(Promise.all([entityPromise, sentimentPromise, themePromise]));
            } else {
              Promise.all([entityPromise, sentimentPromise, themePromise]).catch(err => {
                console.error(`[translate-text] Error in post-processing:`, err);
              });
            }
            
            console.log(`[translate-text] Post-processing successfully triggered`);
          } catch (postError) {
            console.error(`[translate-text] Error triggering post-processing:`, postError);
            // Don't throw this error as it shouldn't affect the response
          }
        }
      } catch (dbError) {
        console.error(`[translate-text] Database operation error:`, dbError);
        // Don't throw here, just log the error and continue
      }
    } else {
      console.log('[translate-text] No entryId provided, skipping database update');
    }
    
    return new Response(
      JSON.stringify({
        translatedText,
        detectedLanguage,
        success: true,
        detectedLanguagesFromDB: detectedLanguagesFromDB,
        usedDetectedLanguages: useDetectedLanguages && detectedLanguagesFromDB.length > 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[translate-text] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        name: error.name,
        originalText: req.json?.text || null
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

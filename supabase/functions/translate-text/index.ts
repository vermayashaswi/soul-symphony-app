
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to wait for a specific amount of time
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
    const { 
      text, 
      texts, 
      sourceLanguage, 
      targetLanguage = 'hi', 
      entryId, 
      cleanResult = true,
      maxRetries = 3
    } = await req.json();

    // Handle batch translation for multiple texts
    if (texts && Array.isArray(texts)) {
      return await handleBatchTranslation(
        texts, 
        targetLanguage, 
        GOOGLE_API_KEY, 
        cleanResult,
        maxRetries
      );
    }

    // Handle single text translation
    if (!text) {
      throw new Error('Missing required parameter: text is required');
    }

    console.log(`Translating text: "${text.substring(0, 50)}..." from ${sourceLanguage || 'auto-detect'} to ${targetLanguage}${entryId ? ` for entry ${entryId}` : ''}`);

    // Implement retry logic for translation
    let attempts = 0;
    let translationResult = null;
    let detectedLanguage = sourceLanguage;
    let lastError = null;

    while (attempts < maxRetries) {
      try {
        // First detect the language if sourceLanguage is not provided
        if (!detectedLanguage) {
          const detectResult = await detectLanguage(text, GOOGLE_API_KEY);
          detectedLanguage = detectResult;
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
            format: 'text' // Ensure we're using text format, not HTML
          })
        });

        if (!translateResponse.ok) {
          const errorData = await translateResponse.text();
          console.error(`Translation failed with status ${translateResponse.status}: ${errorData}`);
          throw new Error(`Translation failed: ${translateResponse.statusText}`);
        }

        const translateData = await translateResponse.json();
        
        // Check if the response has the expected structure
        if (!translateData.data || !translateData.data.translations || !translateData.data.translations[0]) {
          console.error('Invalid translation response format:', JSON.stringify(translateData));
          throw new Error('Invalid translation response format');
        }
        
        translationResult = translateData.data.translations[0].translatedText;
        console.log(`Raw translated text: "${translationResult.substring(0, 50)}..."`);
        
        // Clean the translation result if requested
        if (cleanResult) {
          // Remove language code suffix like "(hi)" or "[hi]" that might be appended
          const languageCodeRegex = /\s*[\(\[]([a-z]{2})[\)\]]\s*$/i;
          translationResult = translationResult.replace(languageCodeRegex, '').trim();
          console.log(`Cleaned translated text: "${translationResult.substring(0, 50)}..."`);
        }
        
        // Success! Break the retry loop
        break;
      } catch (error) {
        attempts++;
        lastError = error;
        console.error(`Translation attempt ${attempts} failed: ${error.message}`);
        
        if (attempts < maxRetries) {
          // Wait before retrying with exponential backoff
          const backoffTime = 1000 * Math.pow(2, attempts - 1);
          console.log(`Waiting ${backoffTime}ms before retry ${attempts + 1}/${maxRetries}`);
          await sleep(backoffTime);
        }
      }
    }

    // If we've exhausted all retries and still failed, throw the last error
    if (!translationResult) {
      throw lastError || new Error(`Failed to translate after ${maxRetries} attempts`);
    }

    // Update the database with the translation only if entryId is provided
    if (entryId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
    
        console.log(`[translate-text] Updating entry ${entryId} with translation`);
    
        const updateFields = {
          "original_language": detectedLanguage,
          "translation_text": translationResult
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
              body: { text: translationResult, entryId }
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
        translatedText: translationResult,
        detectedLanguage,
        success: true
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

// Helper function to detect language
async function detectLanguage(text: string, apiKey: string): Promise<string> {
  const detectUrl = `https://translation.googleapis.com/language/translate/v2/detect?key=${apiKey}`;
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
  
  if (!detectData.data || !detectData.data.detections || !detectData.data.detections[0] || !detectData.data.detections[0][0]) {
    console.error('Invalid detection response format:', JSON.stringify(detectData));
    throw new Error('Invalid detection response format');
  }
  
  return detectData.data.detections[0][0].language;
}

// Helper function to handle batch translation
async function handleBatchTranslation(
  texts: string[], 
  targetLanguage: string, 
  apiKey: string, 
  cleanResult: boolean,
  maxRetries: number
): Promise<Response> {
  console.log(`[translate-text] Batch translating ${texts.length} texts to ${targetLanguage}`);
  
  // Filter out empty texts
  const validTexts = texts.filter(text => text && text.trim() !== '');
  
  if (validTexts.length === 0) {
    return new Response(
      JSON.stringify({
        translatedTexts: [],
        success: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
  
  // Split into smaller batches to avoid rate limits (max 10 texts per batch)
  const batchSize = 10;
  const batches = [];
  
  for (let i = 0; i < validTexts.length; i += batchSize) {
    batches.push(validTexts.slice(i, i + batchSize));
  }
  
  console.log(`[translate-text] Split into ${batches.length} batches of max ${batchSize} texts each`);
  
  const translatedTexts: string[] = new Array(validTexts.length).fill('');
  
  // Process each batch
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`[translate-text] Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} texts`);
    
    let attempts = 0;
    let batchSuccess = false;
    
    while (attempts < maxRetries && !batchSuccess) {
      try {
        const translateUrl = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
        console.log(`[translate-text] Sending batch translation request to: ${translateUrl}`);
        
        const translateResponse = await fetch(translateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: batch,
            source: 'en', // Always use English as source for consistency
            target: targetLanguage,
            format: 'text'
          })
        });

        if (!translateResponse.ok) {
          const errorData = await translateResponse.text();
          console.error(`[translate-text] Batch translation failed with status ${translateResponse.status}: ${errorData}`);
          throw new Error(`Batch translation failed: ${translateResponse.statusText}`);
        }

        const translateData = await translateResponse.json();
        
        // Check if the response has the expected structure
        if (!translateData.data || !translateData.data.translations || !Array.isArray(translateData.data.translations)) {
          console.error('[translate-text] Invalid batch translation response format:', JSON.stringify(translateData));
          throw new Error('Invalid batch translation response format');
        }
        
        // Process the translations
        const batchResults = translateData.data.translations.map((item: any) => {
          let text = item.translatedText;
          
          if (cleanResult && text) {
            // Remove language code suffix
            const languageCodeRegex = /\s*[\(\[]([a-z]{2})[\)\]]\s*$/i;
            text = text.replace(languageCodeRegex, '').trim();
          }
          
          return text;
        });
        
        // Merge the batch results into the full results array
        const startIndex = batchIndex * batchSize;
        batchResults.forEach((text: string, i: number) => {
          translatedTexts[startIndex + i] = text;
        });
        
        batchSuccess = true;
        console.log(`[translate-text] Successfully translated batch ${batchIndex + 1}/${batches.length}`);
      } catch (error) {
        attempts++;
        console.error(`[translate-text] Batch translation attempt ${attempts} failed: ${error.message}`);
        
        if (attempts < maxRetries) {
          // Wait before retrying with exponential backoff
          const backoffTime = 1000 * Math.pow(2, attempts - 1);
          console.log(`[translate-text] Waiting ${backoffTime}ms before retry ${attempts + 1}/${maxRetries}`);
          await sleep(backoffTime);
        } else {
          // On final failure, use original texts for this batch
          console.error(`[translate-text] All ${maxRetries} attempts failed for batch ${batchIndex + 1}`);
          const startIndex = batchIndex * batchSize;
          batch.forEach((text, i) => {
            translatedTexts[startIndex + i] = text; // Use original text as fallback
          });
        }
      }
    }
  }
  
  console.log(`[translate-text] Completed batch translation of ${validTexts.length} texts`);
  
  return new Response(
    JSON.stringify({
      translatedTexts,
      success: true,
      originalCount: texts.length,
      validCount: validTexts.length
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

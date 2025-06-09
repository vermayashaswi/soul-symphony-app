
// Import necessary Deno modules
import { encode as base64Encode } from "https://deno.land/std@0.132.0/encoding/base64.ts";

/**
 * Transcribe audio using OpenAI's Whisper API with enhanced error handling and language detection
 * @param audioBlob - The audio blob to transcribe
 * @param fileType - The audio file type (webm, mp4, wav, etc.)
 * @param apiKey - The OpenAI API key
 * @param language - The language code or 'auto' for auto-detection
 * @returns Transcribed text and detected languages
 */
export async function transcribeAudioWithWhisper(
  audioBlob: Blob,
  fileType: string,
  apiKey: string,
  language: string = 'auto'
): Promise<{ text: string; detectedLanguages: string[] }> {
  try {
    // Determine the appropriate filename extension based on audio type
    const fileExtension = fileType === 'webm' ? 'webm' : 
                         fileType === 'mp4' ? 'm4a' :
                         fileType === 'wav' ? 'wav' : 'ogg';
    
    // Prepare the audio file with an appropriate name for the OpenAI API
    const filename = `audio.${fileExtension}`;
    console.log("[Transcription] Using filename:", filename);
    
    // Convert the blob to an ArrayBuffer
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBytes = new Uint8Array(arrayBuffer);
    
    console.log("[Transcription] Preparing audio for OpenAI:", {
      blobSize: audioBlob.size,
      blobType: audioBlob.type,
      fileExtension
    });
    
    // Create form data to send to the OpenAI API
    const formData = new FormData();
    formData.append("file", new Blob([audioBytes], { type: audioBlob.type }), filename);
    formData.append("model", "whisper-1"); // FIXED: Use correct Whisper model
    
    // Only add language parameter if it's not 'auto' and is a valid language code
    if (language !== 'auto' && language.length === 2) {
      formData.append("language", language);
    }
    
    // FIXED: Use 'json' response format instead of 'verbose_json'
    formData.append("response_format", "json");
    
    console.log("[Transcription] Sending request to OpenAI with:", {
      fileSize: audioBlob.size,
      fileType: audioBlob.type,
      fileExtension,
      hasApiKey: !!apiKey,
      model: "whisper-1",
      autoLanguageDetection: language === 'auto',
      responseFormat: "json"
    });
    
    // Call the OpenAI API for transcription with retry logic
    let response;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`
          },
          body: formData
        });
        
        if (response.ok) {
          break; // Success, exit retry loop
        }
        
        const errorText = await response.text();
        console.error(`[Transcription] OpenAI API error (attempt ${attempts + 1}):`, errorText);
        
        // If it's a client error (4xx), don't retry
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`OpenAI API client error: ${errorText}`);
        }
        
        // For server errors (5xx), retry after a delay
        if (attempts < maxAttempts - 1) {
          const delay = Math.pow(2, attempts) * 1000; // Exponential backoff
          console.log(`[Transcription] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        attempts++;
      } catch (fetchError) {
        console.error(`[Transcription] Network error (attempt ${attempts + 1}):`, fetchError);
        attempts++;
        
        if (attempts < maxAttempts) {
          const delay = Math.pow(2, attempts) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw new Error(`Network error after ${maxAttempts} attempts: ${fetchError.message}`);
        }
      }
    }
    
    if (!response || !response.ok) {
      throw new Error(`Failed to transcribe audio after ${maxAttempts} attempts`);
    }
    
    // Parse the response
    const result = await response.json();
    
    // Get the transcribed text from the result
    const transcribedText = result.text || "";
    
    if (!transcribedText || transcribedText.trim().length === 0) {
      throw new Error("Transcription returned empty result");
    }
    
    // Enhanced language detection from transcribed text
    const detectedLanguages = detectLanguageFromText(transcribedText);
    
    console.log("[Transcription] Success:", {
      textLength: transcribedText.length,
      sampleText: transcribedText.substring(0, 50) + "...",
      model: "whisper-1",
      detectedLanguage: detectedLanguages[0] || 'unknown',
      allDetectedLanguages: detectedLanguages
    });
    
    return {
      text: transcribedText,
      detectedLanguages
    };
  } catch (error) {
    console.error("[Transcription] Error:", error);
    throw new Error(`Transcription failed: ${error.message}`);
  }
}

/**
 * Enhanced language detection from text patterns with better accuracy
 */
function detectLanguageFromText(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return ['unknown'];
  }
  
  const detectedLanguages: string[] = [];
  const normalizedText = text.toLowerCase();
  
  // Enhanced patterns for different languages with better detection
  const languagePatterns = {
    // Script-based detection (most reliable)
    'hi': /[\u0900-\u097F]/,        // Devanagari script (Hindi)
    'bn': /[\u0980-\u09FF]/,        // Bengali script
    'te': /[\u0C00-\u0C7F]/,        // Telugu script
    'ta': /[\u0B80-\u0BFF]/,        // Tamil script
    'gu': /[\u0A80-\u0AFF]/,        // Gujarati script
    'kn': /[\u0C80-\u0CFF]/,        // Kannada script
    'ml': /[\u0D00-\u0D7F]/,        // Malayalam script
    'or': /[\u0B00-\u0B7F]/,        // Oriya script
    'pa': /[\u0A00-\u0A7F]/,        // Gurmukhi script (Punjabi)
    'mr': /[\u0900-\u097F]/,        // Marathi (also uses Devanagari)
    'zh': /[\u4e00-\u9fff]/,        // Chinese characters
    'ja': /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/, // Japanese
    'ko': /[\uac00-\ud7af]/,        // Korean
    'ar': /[\u0600-\u06FF]/,        // Arabic script
    'ru': /[\u0400-\u04FF]/,        // Cyrillic script
    
    // Word-based detection for Latin script languages
    'fr': /\b(le|la|les|un|une|des|je|tu|il|elle|nous|vous|ils|elles|et|ou|mais|donc|car|ni|or|avec|dans|pour|sur|par|sans|sous|entre|vers|chez|depuis|pendant|avant|après|très|plus|moins|bien|mal|tout|tous|toute|toutes|même|autre|autres|cette|cette|celui|celle|ceux|celles)\b/gi,
    'es': /\b(el|la|los|las|un|una|y|o|pero|que|de|en|es|por|para|con|sin|sobre|bajo|entre|hasta|desde|durante|según|como|cuando|donde|mientras|aunque|porque|si|no|sí|muy|más|menos|bien|mal|todo|toda|todos|todas|esto|esta|este|eso|esa|ese|aquel|aquella|aquellos|aquellas)\b/gi,
    'de': /\b(der|die|das|ein|eine|und|oder|aber|dass|von|zu|mit|auf|für|durch|über|unter|zwischen|während|wegen|trotz|ohne|gegen|um|nach|vor|bei|seit|bis|als|wenn|weil|obwohl|damit|so|sehr|mehr|weniger|gut|schlecht|alle|alles|dieser|diese|dieses|jener|jene|jenes)\b/gi,
    'it': /\b(il|la|lo|gli|le|un|una|e|o|ma|che|di|in|è|per|con|su|da|tra|fra|durante|secondo|come|quando|dove|mentre|anche|se|non|sì|molto|più|meno|bene|male|tutto|tutta|tutti|tutte|questo|questa|quello|quella|quelli|quelle)\b/gi,
    'pt': /\b(o|a|os|as|um|uma|e|ou|mas|que|de|em|é|por|para|com|sem|sobre|sob|entre|até|desde|durante|segundo|como|quando|onde|enquanto|também|se|não|sim|muito|mais|menos|bem|mal|todo|toda|todos|todas|este|esta|esse|essa|aquele|aquela)\b/gi,
    'nl': /\b(de|het|een|en|of|maar|dat|van|in|is|voor|met|op|door|over|onder|tussen|tijdens|volgens|als|wanneer|waar|terwijl|ook|als|niet|ja|zeer|meer|minder|goed|slecht|alle|alles|deze|dit|die|dat|zo|heel|erg)\b/gi,
    'sv': /\b(en|ett|och|eller|men|att|av|i|är|för|med|på|genom|över|under|mellan|under|enligt|som|när|var|medan|också|om|inte|ja|mycket|mer|mindre|bra|dålig|alla|allt|denna|detta|den|det|så|väldigt)\b/gi,
    'no': /\b(en|et|og|eller|men|at|av|i|er|for|med|på|gjennom|over|under|mellom|i|løpet|av|ifølge|som|når|hvor|mens|også|hvis|ikke|ja|veldig|mer|mindre|bra|dårlig|alle|alt|denne|dette|den|det|så|meget)\b/gi
  };
  
  // Check for script-based languages first (most reliable)
  for (const [lang, pattern] of Object.entries(languagePatterns)) {
    if (pattern.test(text)) {
      detectedLanguages.push(lang);
    }
  }
  
  // If no specific language detected and it's Latin script, try English detection
  if (detectedLanguages.length === 0) {
    const englishIndicators = /\b(the|and|or|but|that|of|in|is|for|with|on|by|from|as|at|to|a|an|this|that|these|those|i|you|he|she|it|we|they|me|him|her|us|them|my|your|his|hers|its|our|their|be|have|do|will|would|could|should|may|might|can|must|shall|very|more|most|less|least|good|bad|well|better|best|worse|worst|all|some|any|no|not|yes)\b/gi;
    
    const englishMatches = (normalizedText.match(englishIndicators) || []).length;
    const totalWords = normalizedText.split(/\s+/).length;
    
    // If more than 20% of words are English indicators, consider it English
    if (totalWords > 0 && (englishMatches / totalWords) > 0.2) {
      detectedLanguages.push('en');
    } else {
      // Check if it's basic Latin characters
      const latinPattern = /^[a-zA-Z0-9\s.,!?;:'"()\-]+$/;
      if (latinPattern.test(text.trim())) {
        detectedLanguages.push('en'); // Default to English for Latin script
      } else {
        detectedLanguages.push('unknown');
      }
    }
  }
  
  return detectedLanguages.length > 0 ? detectedLanguages : ['unknown'];
}

/**
 * Translates and refines text using GPT-4.1 with enhanced error handling
 */
export async function translateAndRefineText(
  text: string, 
  apiKey: string,
  detectedLanguages: string[]
): Promise<{ refinedText: string; }> {
  try {
    console.log("[AI] Starting text refinement:", text.substring(0, 50) + "...");
    console.log("[AI] Detected languages:", detectedLanguages);
    
    // Check if the detected language indicates non-English content
    const isNonEnglish = detectedLanguages[0] !== 'en' && detectedLanguages[0] !== 'unknown';
    const detectedLanguagesInfo = detectedLanguages.join(', ');
    
    // Enhanced system messages for better translation and refinement
    const systemMessage = isNonEnglish 
      ? `You are a professional multilingual translator. Translate the following text into natural, fluent English while preserving the original meaning, tone, and emotional context. Do not add explanations or interpretations. The detected language is: ${detectedLanguagesInfo}.`
      : `You are an expert transcription editor. Improve the grammar, punctuation, and sentence structure of the following English text while preserving the original meaning and tone. Remove only obvious filler words (um, uh, like) where they don't affect meaning. Keep the speaker's natural style and intent.`;
    
    // Retry logic for AI processing
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4.1-2025-04-14", // FIXED: Use correct GPT model
            messages: [
              {
                role: "system",
                content: systemMessage
              },
              {
                role: "user",
                content: text
              }
            ],
            max_tokens: 1500,
            temperature: 0.3 // Lower temperature for more consistent results
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[AI] OpenAI API error (attempt ${attempts + 1}):`, errorText);
          
          // Don't retry on client errors
          if (response.status >= 400 && response.status < 500) {
            throw new Error(`OpenAI API client error: ${errorText}`);
          }
          
          // Retry on server errors
          if (attempts < maxAttempts - 1) {
            const delay = Math.pow(2, attempts) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            attempts++;
            continue;
          }
          
          throw new Error(`OpenAI API error: ${errorText}`);
        }
        
        const result = await response.json();
        const refinedText = result.choices?.[0]?.message?.content || text;
        
        console.log("[AI] Text refined successfully, new length:", refinedText.length);
        console.log("[AI] Original text sample:", text.substring(0, 50));
        console.log("[AI] Refined text sample:", refinedText.substring(0, 50));
        console.log("[AI] Used detected language(s):", detectedLanguagesInfo);
        
        return { refinedText };
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          console.error("[AI] Text refinement failed after all attempts:", error);
          return { refinedText: text }; // Return original text on failure
        }
        
        const delay = Math.pow(2, attempts - 1) * 1000;
        console.log(`[AI] Retrying text refinement in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return { refinedText: text };
  } catch (error) {
    console.error("[AI] Text refinement error:", error);
    return { refinedText: text }; // Return original text on error
  }
}

/**
 * Analyze emotions in text using OpenAI's GPT-4.1 with enhanced error handling
 */
export async function analyzeEmotions(
  text: string,
  emotionsData: Array<{ name: string; description: string }>,
  apiKey: string
): Promise<Record<string, number>> {
  try {
    console.log("[AI] Analyzing emotions in text:", text.substring(0, 50) + "....");
    
    if (!emotionsData || emotionsData.length === 0) {
      console.warn("[AI] No emotions data provided");
      return { Neutral: 0.5 };
    }
    
    // Create a prompt with available emotions
    const emotionOptions = emotionsData
      .map(e => `${e.name}: ${e.description}`)
      .join("\n");
    
    const systemPrompt = `You are an expert at detecting emotions in text. Analyze the following text and assign scores to the emotions below:

${emotionOptions}

Rules:
- Only return emotions that are clearly present in the text
- Use a scale of 0.0 to 1.0, where 0.0 means not present and 1.0 means strongly present
- Be conservative with high scores (0.8+) - reserve them for very clear emotional expressions
- Return ONLY a valid JSON object with emotion names as keys and scores as values
- Do not include explanations or additional text`;
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-2025-04-14", // FIXED: Use correct GPT model
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: text
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI] Emotion analysis API error:", errorText);
      return { Neutral: 0.5 };
    }
    
    const result = await response.json();
    const emotionsResult = JSON.parse(result.choices[0].message.content);
    
    // Validate the result
    if (typeof emotionsResult !== 'object' || emotionsResult === null) {
      console.warn("[AI] Invalid emotions result format");
      return { Neutral: 0.5 };
    }
    
    console.log("[AI] Emotions analyzed successfully:", emotionsResult);
    
    return emotionsResult;
  } catch (error) {
    console.error("[AI] Emotion analysis error:", error);
    return { Neutral: 0.5 };
  }
}

/**
 * Generate embedding for text using OpenAI's embedding API with error handling
 */
export async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  try {
    console.log("[AI] Generating embedding for text:", text.substring(0, 50) + "....");
    
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI] Embedding API error:", errorText);
      throw new Error(`OpenAI Embedding API error: ${errorText}`);
    }
    
    const result = await response.json();
    const embedding = result.data[0].embedding;
    
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error("Invalid embedding format received from API");
    }
    
    console.log("[AI] Embedding generated successfully, dimensions:", embedding.length);
    
    return embedding;
  } catch (error) {
    console.error("[AI] Embedding error:", error);
    throw error;
  }
}


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
    'fr': /\b(le|la|les|un|une|des|je|tu|il|elle|nous|vous|ils|elles|et|ou|mais|donc|car|ni|or|avec|dans|pour|sur|par|sans|sous|entre|vers|chez|depuis|pendant|avant|après|très|plus|moins|bien|mal|tout|tous|toute|toutes|même|autre|autres|cette|celui|celle|ceux|celles)\b/gi,
    'es': /\b(el|la|los|las|un|una|y|o|pero|que|de|en|es|por|para|con|sin|sobre|bajo|entre|hasta|desde|durante|según|como|cuando|donde|mientras|aunque|porque|si|no|sí|muy|más|menos|bien|mal|todo|toda|todos|todas|esto|esta|este|eso|esa|ese|aquel|aquella|aquellos|aquellas)\b/gi,
    'de': /\b(der|die|das|ein|eine|und|oder|aber|dass|von|zu|mit|auf|für|durch|über|unter|zwischen|während|wegen|trotz|ohne|gegen|um|nach|vor|bei|seit|bis|als|wenn|weil|obwohl|damit|so|sehr|mehr|weniger|gut|schlecht|alle|alles|dieser|diese|dieses|jener|jene|jenes)\b/gi,
    'it': /\b(il|la|lo|gli|le|un|una|e|o|ma|che|di|in|è|per|con|su|da|tra|fra|durante|secondo|come|quando|dove|mentre|anche|se|non|sì|molto|più|meno|bene|male|tutto|tutti|questa|questo|quello|quella|quelli|quelle)\b/gi,
    
    // Portuguese detection
    'pt': /\b(o|a|os|as|um|uma|e|ou|mas|que|de|em|é|para|com|por|sem|sobre|sob|entre|até|desde|durante|segundo|como|quando|onde|enquanto|embora|porque|se|não|sim|muito|mais|menos|bem|mal|todo|toda|todos|todas|este|esta|isto|esse|essa|isso|aquele|aquela|aquilo)\b/gi,
    
    // Dutch detection
    'nl': /\b(de|het|een|en|of|maar|dat|van|in|is|voor|met|op|door|zonder|over|onder|tussen|tot|sinds|tijdens|volgens|zoals|wanneer|waar|terwijl|hoewel|omdat|als|niet|ja|zeer|meer|minder|goed|slecht|alle|alles|deze|dit|die|dat|degene|degenen)\b/gi,
    
    // English (default fallback for Latin script)
    'en': /\b(the|a|an|and|or|but|that|of|in|is|for|with|on|by|without|over|under|between|to|since|during|according|like|when|where|while|although|because|if|not|yes|very|more|less|good|bad|all|this|that|these|those|who|which)\b/gi
  };
  
  // Check each language pattern
  for (const [lang, pattern] of Object.entries(languagePatterns)) {
    if (pattern.test(normalizedText)) {
      detectedLanguages.push(lang);
    }
  }
  
  // If no languages detected, default to English for Latin script
  if (detectedLanguages.length === 0) {
    detectedLanguages.push('en');
  }
  
  // Sort by likely accuracy (script-based first, then common languages)
  const scriptBasedLangs = ['hi', 'bn', 'te', 'ta', 'gu', 'kn', 'ml', 'or', 'pa', 'mr', 'zh', 'ja', 'ko', 'ar', 'ru'];
  detectedLanguages.sort((a, b) => {
    const aIsScript = scriptBasedLangs.includes(a);
    const bIsScript = scriptBasedLangs.includes(b);
    if (aIsScript && !bIsScript) return -1;
    if (!aIsScript && bIsScript) return 1;
    return 0;
  });
  
  return detectedLanguages.slice(0, 3); // Return top 3 detected languages
}

/**
 * Translate and refine text using OpenAI GPT with enhanced processing
 * @param text - The text to translate and refine
 * @param apiKey - The OpenAI API key
 * @param detectedLanguages - Array of detected languages
 * @returns Refined text
 */
export async function translateAndRefineText(
  text: string,
  apiKey: string,
  detectedLanguages: string[] = ['en']
): Promise<{ refinedText: string }> {
  try {
    const primaryLanguage = detectedLanguages[0] || 'en';
    
    console.log("[Text Processing] Starting translation and refinement:", {
      textLength: text.length,
      primaryLanguage,
      allLanguages: detectedLanguages
    });
    
    // Enhanced prompt for better text processing
    const prompt = `You are an expert text processor specializing in voice transcription refinement. 

Your task is to improve the following voice transcription by:
1. Correcting obvious speech-to-text errors (wrong words, missing punctuation)
2. Adding proper punctuation and formatting
3. Maintaining the original meaning and speaker's voice
4. Keeping the same language as the original (detected: ${primaryLanguage})
5. Preserving emotional tone and personal expressions
6. NOT translating unless the text is clearly in a different language than intended

Original transcription:
"${text}"

Please return only the refined text without any additional commentary or explanation.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a text refinement specialist. Return only the refined text without any additional commentary."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: Math.min(4000, text.length * 2)
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Text Processing] OpenAI API error:", errorText);
      // Return original text if refinement fails
      return { refinedText: text };
    }

    const result = await response.json();
    const refinedText = result.choices?.[0]?.message?.content?.trim() || text;

    console.log("[Text Processing] Refinement completed:", {
      originalLength: text.length,
      refinedLength: refinedText.length,
      originalSample: text.substring(0, 50),
      refinedSample: refinedText.substring(0, 50)
    });

    return { refinedText };
  } catch (error) {
    console.error("[Text Processing] Error in text refinement:", error);
    // Return original text if there's an error
    return { refinedText: text };
  }
}

/**
 * Analyze emotions in text using OpenAI with available emotions from database
 * @param text - The text to analyze
 * @param availableEmotions - Array of emotion objects from database
 * @param apiKey - The OpenAI API key
 * @returns Emotion analysis results
 */
export async function analyzeEmotions(
  text: string,
  availableEmotions: any[],
  apiKey: string
): Promise<Record<string, number>> {
  try {
    if (!availableEmotions || availableEmotions.length === 0) {
      console.warn("[Emotion Analysis] No emotions available from database");
      return {};
    }

    const emotionNames = availableEmotions.map(e => e.name).join(', ');
    
    console.log("[Emotion Analysis] Starting analysis with emotions:", emotionNames);

    const prompt = `Analyze the emotional content of the following text and return scores (0.0 to 1.0) for relevant emotions.

Available emotions: ${emotionNames}

Text to analyze: "${text}"

Return a JSON object with emotion names as keys and numerical scores (0.0 to 1.0) as values. Only include emotions that are clearly present in the text with a score of at least 0.1.

Example format:
{
  "joy": 0.8,
  "excitement": 0.6,
  "gratitude": 0.4
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an emotion analysis expert. Return only valid JSON with emotion scores."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Emotion Analysis] OpenAI API error:", errorText);
      return {};
    }

    const result = await response.json();
    const emotionsText = result.choices?.[0]?.message?.content;
    
    if (!emotionsText) {
      console.warn("[Emotion Analysis] No emotion analysis content returned");
      return {};
    }

    try {
      const emotions = JSON.parse(emotionsText);
      console.log("[Emotion Analysis] Analysis completed:", emotions);
      return emotions;
    } catch (parseError) {
      console.error("[Emotion Analysis] Failed to parse emotion results:", parseError);
      return {};
    }
  } catch (error) {
    console.error("[Emotion Analysis] Error in emotion analysis:", error);
    return {};
  }
}

/**
 * Generate embedding for text using OpenAI's text-embedding-ada-002 model
 * @param text - The text to generate embedding for
 * @param apiKey - The OpenAI API key
 * @returns Embedding vector
 */
export async function generateEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
  try {
    console.log("[Embedding] Generating embedding for text length:", text.length);

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "text-embedding-ada-002",
        input: text.substring(0, 8000) // Limit to avoid token limits
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Embedding] OpenAI API error:", errorText);
      throw new Error(`Embedding generation failed: ${errorText}`);
    }

    const result = await response.json();
    const embedding = result.data?.[0]?.embedding;

    if (!embedding || !Array.isArray(embedding)) {
      throw new Error("Invalid embedding response format");
    }

    console.log("[Embedding] Embedding generated successfully, dimensions:", embedding.length);
    return embedding;
  } catch (error) {
    console.error("[Embedding] Error generating embedding:", error);
    throw error;
  }
}

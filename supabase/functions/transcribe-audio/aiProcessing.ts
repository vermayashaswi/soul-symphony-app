
// Import necessary Deno modules
import { encode as base64Encode } from "https://deno.land/std@0.132.0/encoding/base64.ts";

// Import the official OpenAI SDK
import OpenAI from "https://esm.sh/openai@4.63.0";

/**
 * Transcribe audio using OpenAI's Whisper API with enhanced error handling and retry logic
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
    console.log("[Transcription] Starting enhanced Whisper transcription with retry logic");
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey,
    });
    
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
    
    // Create a File object from the audio data
    const audioFile = new File([audioBytes], filename, { type: audioBlob.type });
    
    // Enhanced retry logic with multiple model attempts
    const models = ["whisper-1"]; // Use only the reliable model
    let lastError: Error | null = null;
    
    for (const model of models) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`[Transcription] Attempt ${attempt}/3 with model: ${model}`);
          
          // Prepare transcription parameters
          const transcriptionParams: any = {
            file: audioFile,
            model: model,
            response_format: "json"
          };
          
          // Only add language parameter if it's not 'auto'
          if (language !== 'auto') {
            transcriptionParams.language = language;
          }
          
          console.log(`[Transcription] Sending request to OpenAI with model ${model}:`, {
            fileSize: audioBlob.size,
            fileType: audioBlob.type,
            fileExtension,
            hasApiKey: !!apiKey,
            model: model,
            responseFormat: "json",
            autoLanguageDetection: language === 'auto',
            attempt: attempt
          });
          
          // Call the OpenAI API for transcription using the official SDK
          const transcription = await openai.audio.transcriptions.create(transcriptionParams);
          
          // Get the transcribed text from the result
          const transcribedText = transcription.text || "";
          
          if (!transcribedText || transcribedText.trim().length === 0) {
            throw new Error('Transcription returned empty result');
          }
          
          // Analyze the text content for language patterns
          const detectedLanguages = detectLanguagePatterns(transcribedText);
          
          console.log(`[Transcription] Success with model ${model} on attempt ${attempt}:`, {
            textLength: transcribedText.length,
            sampleText: transcribedText.substring(0, 100) + "...",
            model: model,
            detectedLanguages: detectedLanguages.length > 0 ? detectedLanguages : ["unknown"]
          });
          
          return {
            text: transcribedText,
            detectedLanguages: detectedLanguages.length > 0 ? detectedLanguages : ["unknown"]
          };
          
        } catch (error: any) {
          lastError = error;
          console.error(`[Transcription] Attempt ${attempt}/3 failed with model ${model}:`, {
            error: error.message,
            status: error.status,
            type: error.type,
            code: error.code
          });
          
          // Check if this is a server error that might be temporary
          const isRetryableError = error.status >= 500 || 
                                  error.code === 'request_timeout' ||
                                  error.message?.includes('timeout') ||
                                  error.message?.includes('server error') ||
                                  error.message?.includes('internal error');
          
          if (!isRetryableError) {
            console.log(`[Transcription] Non-retryable error with model ${model}, stopping retries`);
            break;
          }
          
          if (attempt < 3) {
            const waitTime = Math.pow(2, attempt - 1) * 2000; // 2s, 4s exponential backoff
            console.log(`[Transcription] Retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
    }
    
    // If we get here, all attempts failed
    throw lastError || new Error('All transcription attempts failed');
    
  } catch (error) {
    console.error("[Transcription] All transcription attempts failed:", error);
    throw error;
  }
}

/**
 * Enhanced: Detect language patterns in text content
 */
function detectLanguagePatterns(text: string): string[] {
  const languages: string[] = [];
  
  // Simple pattern detection (can be enhanced)
  const patterns = {
    'es': /\b(el|la|los|las|un|una|y|o|de|en|con|por|para|que|es|son)\b/gi,
    'fr': /\b(le|la|les|un|une|et|ou|de|en|avec|pour|que|est|sont)\b/gi,
    'de': /\b(der|die|das|ein|eine|und|oder|von|in|mit|für|dass|ist|sind)\b/gi,
    'it': /\b(il|la|i|le|un|una|e|o|di|in|con|per|che|è|sono)\b/gi,
    'pt': /\b(o|a|os|as|um|uma|e|ou|de|em|com|para|que|é|são)\b/gi,
    'ru': /[а-яё]/gi,
    'ar': /[\u0600-\u06FF]/gi,
    'zh': /[\u4e00-\u9fff]/gi,
    'ja': /[\u3040-\u309f\u30a0-\u30ff]/gi,
    'ko': /[\uac00-\ud7af]/gi,
    'hi': /[\u0900-\u097f]/gi,
    'ur': /[\u0600-\u06FF]/gi // Urdu uses Arabic script
  };
  
  for (const [lang, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) {
      languages.push(lang);
    }
  }
  
  // If no specific language detected, default to English
  if (languages.length === 0) {
    languages.push('en');
  }
  
  return languages;
}

/**
 * Enhanced: Translates and refines text with improved error handling
 */
export async function translateAndRefineText(
  text: string, 
  apiKey: string,
  detectedLanguages: string[]
): Promise<{ refinedText: string; preservedLanguages: string[] }> {
  try {
    console.log("[AI] Starting enhanced text refinement with retry logic:", text.substring(0, 100) + "...");
    console.log("[AI] Input detected languages:", detectedLanguages);
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey,
    });
    
    // Check if the detected language indicates non-English content
    const isNonEnglish = !detectedLanguages.includes('en') && detectedLanguages[0] !== 'en';
    const detectedLanguagesInfo = detectedLanguages.join(', ');
    
    // Enhanced prompt for mixed-language handling
    const systemMessage = isNonEnglish 
      ? `You are a multilingual translator and text refinement specialist. 
         
         Your task is to:
         1. If the text is primarily in a non-English language (${detectedLanguagesInfo}), translate it to natural, fluent English
         2. Preserve any mixed-language content by noting the original languages
         3. Improve grammar and clarity while maintaining the original meaning and tone
         4. Do not add any explanation, interpretation, or additional context
         
         Return your response as a JSON object with this exact format:
         {
           "refined_text": "the translated/refined text in English",
           "preserved_languages": ["list", "of", "detected", "languages"]
         }
         
         The original languages detected were: ${detectedLanguagesInfo}.`
      : `You are a text refinement specialist for English content.
         
         Your task is to:
         1. Improve the grammar and sentence structure of the English text
         2. Remove filler words only where it doesn't affect the speaker's intent
         3. Keep tone and phrasing as close to the original as possible
         4. Do not change the meaning or add new information
         
         Return your response as a JSON object with this exact format:
         {
           "refined_text": "the improved English text",
           "preserved_languages": ["en"]
         }`;

    // Retry logic for text refinement
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[AI] Text refinement attempt ${attempt}/2`);
        
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
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
          temperature: 0.3,
          response_format: { type: "json_object" }
        });
        
        const result = completion.choices[0]?.message?.content;
        
        if (!result) {
          throw new Error('No response from OpenAI');
        }
        
        try {
          const parsedResult = JSON.parse(result);
          const refinedText = parsedResult.refined_text || text;
          const preservedLanguages = parsedResult.preserved_languages || detectedLanguages;
          
          console.log("[AI] Text refined successfully:", {
            originalLength: text.length,
            refinedLength: refinedText.length,
            originalSample: text.substring(0, 100),
            refinedSample: refinedText.substring(0, 100),
            preservedLanguages: preservedLanguages
          });
          
          return { 
            refinedText,
            preservedLanguages 
          };
        } catch (parseError) {
          console.error("[AI] Failed to parse JSON response:", parseError);
          // Fallback to original approach
          const refinedText = result || text;
          return { 
            refinedText,
            preservedLanguages: detectedLanguages 
          };
        }
        
      } catch (error: any) {
        lastError = error;
        console.error(`[AI] Text refinement attempt ${attempt}/2 failed:`, error.message);
        
        // Check if this is a retryable error
        const isRetryableError = error.status >= 500 || 
                                error.message?.includes('timeout') ||
                                error.message?.includes('server error');
        
        if (!isRetryableError || attempt === 2) {
          break;
        }
        
        // Wait before retry
        const waitTime = 2000; // 2 second wait
        console.log(`[AI] Retrying text refinement in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    console.error("[AI] Text refinement failed after all attempts:", lastError?.message);
    return { 
      refinedText: text,
      preservedLanguages: detectedLanguages 
    };
    
  } catch (error) {
    console.error("[AI] Text refinement error:", error);
    return { 
      refinedText: text,
      preservedLanguages: detectedLanguages 
    };
  }
}

/**
 * Analyze emotions in text using OpenAI's GPT-4 with retry logic
 */
export async function analyzeEmotions(
  text: string,
  emotionsData: Array<{ name: string; description: string }>,
  apiKey: string
): Promise<Record<string, number>> {
  try {
    console.log("[AI] Analyzing emotions in text with retry logic:", text.substring(0, 100) + "....");
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey,
    });
    
    // Create a prompt with available emotions
    const emotionOptions = emotionsData
      .map(e => `${e.name}: ${e.description}`)
      .join("\n");
    
    const systemPrompt = `
      You are an expert at detecting emotions in text. Analyze the following text and assign scores to the emotions below:
      ${emotionOptions}
      
      Only return emotions that are clearly present in the text. 
      Use a scale of 0.0 to 1.0, where 0.0 means not present and 1.0 means strongly present.
      Return your response as a JSON object with emotion names as keys and scores as values.
      Return ONLY a valid JSON object without any additional text.
    `;
    
    // Retry logic for emotion analysis
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[AI] Emotion analysis attempt ${attempt}/2`);
        
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
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
          response_format: { type: "json_object" }
        });
        
        const result = completion.choices[0]?.message?.content;
        if (!result) {
          throw new Error('No response from OpenAI');
        }
        
        const emotionsResult = JSON.parse(result);
        
        console.log("[AI] Emotions analyzed successfully:", emotionsResult);
        
        return emotionsResult;
        
      } catch (error: any) {
        console.error(`[AI] Emotion analysis attempt ${attempt}/2 failed:`, error.message);
        
        if (attempt === 2) {
          break;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.error("[AI] Emotion analysis failed after all attempts");
    return { Neutral: 0.5 };
    
  } catch (error) {
    console.error("[AI] Emotion analysis error:", error);
    // Return a small set of default emotions on error
    return { Neutral: 0.5 };
  }
}

/**
 * Generate embedding for text using OpenAI's embedding API with retry logic
 */
export async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  try {
    console.log("[AI] Generating embedding for text with retry logic:", text.substring(0, 100) + "....");
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey,
    });
    
    // Retry logic for embedding generation
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[AI] Embedding generation attempt ${attempt}/2`);
        
        const embedding = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: text
        });
        
        const embeddingVector = embedding.data[0].embedding;
        
        console.log("[AI] Embedding generated successfully");
        
        return embeddingVector;
        
      } catch (error: any) {
        console.error(`[AI] Embedding generation attempt ${attempt}/2 failed:`, error.message);
        
        if (attempt === 2) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    throw new Error('Embedding generation failed after all attempts');
    
  } catch (error) {
    console.error("[AI] Embedding error:", error);
    throw error;
  }
}

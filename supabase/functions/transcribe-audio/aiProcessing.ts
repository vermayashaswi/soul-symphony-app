
// Import necessary Deno modules
import { encode as base64Encode } from "https://deno.land/std@0.132.0/encoding/base64.ts";

// Import the official OpenAI SDK
import OpenAI from "https://esm.sh/openai@4.63.0";

/**
 * Transcribe audio using OpenAI's Whisper API - FIXED: No language detection here
 * @param audioBlob - The audio blob to transcribe
 * @param fileType - The audio file type (webm, mp4, wav, etc.)
 * @param apiKey - The OpenAI API key
 * @param language - The language code or 'auto' for auto-detection
 * @returns Transcribed text only (language detection moved to translation step)
 */
export async function transcribeAudioWithWhisper(
  audioBlob: Blob,
  fileType: string,
  apiKey: string,
  language: string = 'auto'
): Promise<{ text: string }> {
  try {
    console.log("[Transcription] FIXED: Starting Whisper transcription (no language detection)");
    
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
          
          console.log(`[Transcription] FIXED: Success with model ${model} on attempt ${attempt}:`, {
            textLength: transcribedText.length,
            sampleText: transcribedText.substring(0, 100) + "...",
            model: model
          });
          
          // FIXED: Return only transcribed text, no language detection
          return {
            text: transcribedText
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
 * FIXED: Translates and refines text with proper language detection
 */
export async function translateAndRefineText(
  text: string, 
  apiKey: string
): Promise<{ refinedText: string; detectedLanguages: string[] }> {
  try {
    console.log("[AI] FIXED: Starting text refinement with language detection");
    console.log("[AI] Input text:", text.substring(0, 100) + "...");
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey,
    });
    
    // FIXED: Enhanced prompt for language detection and refinement
    const systemMessage = `You are a multilingual text refinement specialist. 
         
Your task is to:
1. Detect the primary language(s) used in the text
2. If the text is in a non-English language, translate it to natural, fluent English
3. If the text is already in English, improve grammar and clarity while maintaining the original meaning and tone
4. Preserve any mixed-language content by noting the original languages

Return your response as a JSON object with this exact format:
{
  "refined_text": "the translated/refined text in English",
  "detected_languages": ["list", "of", "detected", "language", "codes"]
}

Language codes to use: en (English), es (Spanish), fr (French), de (German), it (Italian), pt (Portuguese), ru (Russian), ar (Arabic), zh (Chinese), ja (Japanese), ko (Korean), hi (Hindi), ur (Urdu), etc.`;

    // Retry logic for text refinement
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[AI] FIXED: Text refinement attempt ${attempt}/2`);
        
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
          const detectedLanguages = Array.isArray(parsedResult.detected_languages) ? 
            parsedResult.detected_languages.filter(lang => typeof lang === 'string' && lang.length > 0) : ['en'];
          
          console.log("[AI] FIXED: Text refined successfully:", {
            originalLength: text.length,
            refinedLength: refinedText.length,
            originalSample: text.substring(0, 100),
            refinedSample: refinedText.substring(0, 100),
            detectedLanguages: detectedLanguages
          });
          
          return { 
            refinedText,
            detectedLanguages 
          };
        } catch (parseError) {
          console.error("[AI] FIXED: Failed to parse JSON response:", parseError);
          // Fallback to original approach
          const refinedText = result || text;
          return { 
            refinedText,
            detectedLanguages: ['en'] 
          };
        }
        
      } catch (error: any) {
        lastError = error;
        console.error(`[AI] FIXED: Text refinement attempt ${attempt}/2 failed:`, error.message);
        
        // Check if this is a retryable error
        const isRetryableError = error.status >= 500 || 
                                error.message?.includes('timeout') ||
                                error.message?.includes('server error');
        
        if (!isRetryableError || attempt === 2) {
          break;
        }
        
        // Wait before retry
        const waitTime = 2000; // 2 second wait
        console.log(`[AI] FIXED: Retrying text refinement in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    console.error("[AI] FIXED: Text refinement failed after all attempts:", lastError?.message);
    return { 
      refinedText: text,
      detectedLanguages: ['en'] 
    };
    
  } catch (error) {
    console.error("[AI] FIXED: Text refinement error:", error);
    return { 
      refinedText: text,
      detectedLanguages: ['en'] 
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

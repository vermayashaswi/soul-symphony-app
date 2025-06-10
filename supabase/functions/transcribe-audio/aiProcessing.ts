
// Import necessary Deno modules
import { encode as base64Encode } from "https://deno.land/std@0.132.0/encoding/base64.ts";

/**
 * Transcribe audio using OpenAI's Whisper API with enhanced language detection
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
    console.log("[Transcription] Starting enhanced Whisper transcription");
    
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
    formData.append("model", "whisper-1");
    formData.append("response_format", "json"); // FIXED: Use json instead of verbose_json
    
    // Only add language parameter if it's not 'auto'
    if (language !== 'auto') {
      formData.append("language", language);
    }
    
    console.log("[Transcription] Sending request to OpenAI with:", {
      fileSize: audioBlob.size,
      fileType: audioBlob.type,
      fileExtension,
      hasApiKey: !!apiKey,
      model: "whisper-1",
      responseFormat: "json",
      autoLanguageDetection: language === 'auto'
    });
    
    // Call the OpenAI API for transcription
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Transcription] OpenAI API error:", errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }
    
    // Parse the response
    const result = await response.json();
    
    // Get the transcribed text from the result
    const transcribedText = result.text || "";
    
    // ENHANCED: For simple JSON response, we need to detect language ourselves
    let detectedLanguages: string[] = [];
    
    // Analyze the text content for language patterns
    detectedLanguages = detectLanguagePatterns(transcribedText);
    if (detectedLanguages.length === 0) {
      detectedLanguages = ["unknown"];
    }
    
    console.log("[Transcription] Success:", {
      textLength: transcribedText.length,
      sampleText: transcribedText.substring(0, 100) + "...",
      model: "whisper-1",
      detectedLanguages: detectedLanguages
    });
    
    return {
      text: transcribedText,
      detectedLanguages
    };
  } catch (error) {
    console.error("[Transcription] Error:", error);
    throw error;
  }
}

/**
 * ENHANCED: Detect language patterns in text content
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
 * ENHANCED: Translates and refines text with language preservation
 * Handles translation to English if needed and improves transcription quality
 * Returns both refined text and preserved language information
 */
export async function translateAndRefineText(
  text: string, 
  apiKey: string,
  detectedLanguages: string[]
): Promise<{ refinedText: string; preservedLanguages: string[] }> {
  try {
    console.log("[AI] Starting enhanced text refinement:", text.substring(0, 100) + "...");
    console.log("[AI] Input detected languages:", detectedLanguages);
    
    // Check if the detected language indicates non-English content
    const isNonEnglish = !detectedLanguages.includes('en') && detectedLanguages[0] !== 'en';
    const detectedLanguagesInfo = detectedLanguages.join(', ');
    
    // ENHANCED: Create a more sophisticated prompt for mixed-language handling
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
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-2025-04-14", // FIXED: Use the current flagship model
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
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI] OpenAI API error:", errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }
    
    const result = await response.json();
    
    try {
      const parsedResult = JSON.parse(result.choices[0].message.content);
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
      const refinedText = result.choices?.[0]?.message?.content || text;
      return { 
        refinedText,
        preservedLanguages: detectedLanguages 
      };
    }
  } catch (error) {
    console.error("[AI] Text refinement error:", error);
    return { 
      refinedText: text,
      preservedLanguages: detectedLanguages 
    };
  }
}

/**
 * Analyze emotions in text using OpenAI's GPT-4
 */
export async function analyzeEmotions(
  text: string,
  emotionsData: Array<{ name: string; description: string }>,
  apiKey: string
): Promise<Record<string, number>> {
  try {
    console.log("[AI] Analyzing emotions in text:", text.substring(0, 100) + "....");
    
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
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-2025-04-14", // FIXED: Use the current flagship model
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
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI] Emotion analysis API error:", errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }
    
    const result = await response.json();
    const emotionsResult = JSON.parse(result.choices[0].message.content);
    
    console.log("[AI] Emotions analyzed successfully:", emotionsResult);
    
    return emotionsResult;
  } catch (error) {
    console.error("[AI] Emotion analysis error:", error);
    // Return a small set of default emotions on error
    return { Neutral: 0.5 };
  }
}

/**
 * Generate embedding for text using OpenAI's embedding API
 */
export async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  try {
    console.log("[AI] Generating embedding for text:", text.substring(0, 100) + "....");
    
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
      throw new Error(`OpenAI API error: ${errorText}`);
    }
    
    const result = await response.json();
    const embedding = result.data[0].embedding;
    
    console.log("[AI] Embedding generated successfully");
    
    return embedding;
  } catch (error) {
    console.error("[AI] Embedding error:", error);
    throw error;
  }
}

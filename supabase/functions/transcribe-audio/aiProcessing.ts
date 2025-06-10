
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
    formData.append("model", "gpt-4o-transcribe"); // CHANGED: Back to gpt-4o-transcribe as requested
    
    // Always use auto-detection for better language detection
    // Only add language parameter if it's not 'auto'
    if (language !== 'auto') {
      formData.append("language", language);
    }
    
    // Use json response format
    formData.append("response_format", "json");
    
    console.log("[Transcription] Sending request to OpenAI with:", {
      fileSize: audioBlob.size,
      fileType: audioBlob.type,
      fileExtension,
      hasApiKey: !!apiKey,
      model: "gpt-4o-transcribe",
      autoLanguageDetection: language === 'auto',
      responseFormat: "json"
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
    
    // Enhanced language detection from the API response and text patterns
    let detectedLanguages: string[] = [];
    
    if (result.language) {
      detectedLanguages = [result.language];
    } else {
      // Fallback: try to detect language from text patterns
      detectedLanguages = detectLanguageFromText(transcribedText);
    }
    
    console.log("[Transcription] Success:", {
      textLength: transcribedText.length,
      sampleText: transcribedText.substring(0, 50) + "...",
      model: "gpt-4o-transcribe",
      detectedLanguage: detectedLanguages[0] || 'unknown',
      allDetectedLanguages: detectedLanguages
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
 * Enhanced language detection from text patterns
 */
function detectLanguageFromText(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return ['unknown'];
  }
  
  const detectedLanguages: string[] = [];
  
  // Common patterns for different languages
  const languagePatterns = {
    'hi': /[\u0900-\u097F]/, // Devanagari script (Hindi)
    'bn': /[\u0980-\u09FF]/, // Bengali script
    'te': /[\u0C00-\u0C7F]/, // Telugu script
    'ta': /[\u0B80-\u0BFF]/, // Tamil script
    'gu': /[\u0A80-\u0AFF]/, // Gujarati script
    'kn': /[\u0C80-\u0CFF]/, // Kannada script
    'ml': /[\u0D00-\u0D7F]/, // Malayalam script
    'or': /[\u0B00-\u0B7F]/, // Oriya script
    'pa': /[\u0A00-\u0A7F]/, // Gurmukhi script (Punjabi)
    'mr': /[\u0900-\u097F]/, // Marathi (also uses Devanagari)
    'zh': /[\u4e00-\u9fff]/, // Chinese characters
    'ja': /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/, // Japanese (Hiragana, Katakana, Kanji)
    'ko': /[\uac00-\ud7af]/, // Korean
    'ar': /[\u0600-\u06FF]/, // Arabic script
    'ru': /[\u0400-\u04FF]/, // Cyrillic script
    'fr': /\b(le|la|les|un|une|des|je|tu|il|elle|nous|vous|ils|elles|et|ou|mais|donc|car|ni|or)\b/i,
    'es': /\b(el|la|los|las|un|una|y|o|pero|que|de|en|es|por|para|con|sin|sobre)\b/i,
    'de': /\b(der|die|das|ein|eine|und|oder|aber|dass|von|zu|mit|auf|für|durch|über)\b/i,
    'it': /\b(il|la|lo|gli|le|un|una|e|o|ma|che|di|in|è|per|con|su|da)\b/i,
    'pt': /\b(o|a|os|as|um|uma|e|ou|mas|que|de|em|é|por|para|com|sem|sobre)\b/i,
  };
  
  // Check for script-based languages first
  for (const [lang, pattern] of Object.entries(languagePatterns)) {
    if (pattern.test(text)) {
      detectedLanguages.push(lang);
    }
  }
  
  // If no specific language detected, check if it's likely English
  if (detectedLanguages.length === 0) {
    const englishPattern = /^[a-zA-Z0-9\s.,!?;:'"()-]+$/;
    if (englishPattern.test(text.trim())) {
      detectedLanguages.push('en');
    } else {
      detectedLanguages.push('unknown');
    }
  }
  
  return detectedLanguages;
}

/**
 * IMPROVED: Conditional translation and refinement based on detected language
 * Only translates if the detected language is NOT English
 */
export async function translateAndRefineText(
  text: string, 
  apiKey: string,
  detectedLanguages: string[],
  preserveOriginal: boolean = true
): Promise<{ refinedText: string; needsTranslation: boolean; }> {
  try {
    console.log("[AI] Starting text refinement:", text.substring(0, 50) + "...");
    console.log("[AI] Detected languages:", detectedLanguages);
    
    // Check if the detected language indicates non-English content
    const primaryLanguage = detectedLanguages[0] || 'unknown';
    const needsTranslation = primaryLanguage !== 'en' && primaryLanguage !== 'unknown';
    
    console.log("[AI] Primary language:", primaryLanguage);
    console.log("[AI] Needs translation:", needsTranslation);
    
    // If preserveOriginal is true and text is not in English, don't translate
    if (preserveOriginal && needsTranslation) {
      console.log("[AI] Preserving original language, skipping translation");
      
      // Just clean up the text without translating
      const systemMessage = `You are a transcription refinement assistant. Improve the grammar and sentence structure of the following ${primaryLanguage === 'hi' ? 'Hindi' : primaryLanguage} text without changing its meaning or language. Do not translate to English. Keep the original language intact. Remove only obvious transcription errors and improve clarity while preserving the original language, tone, and phrasing.`;
      
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
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
          max_tokens: 1000
        })
      });
      
      if (!response.ok) {
        console.log("[AI] Refinement failed, returning original text");
        return { refinedText: text, needsTranslation };
      }
      
      const result = await response.json();
      const refinedText = result.choices?.[0]?.message?.content || text;
      
      console.log("[AI] Text refined in original language");
      return { refinedText, needsTranslation };
    }
    
    // Handle translation or English refinement
    const systemMessage = needsTranslation 
      ? `You are a multilingual translator. Translate the following text exactly into natural, fluent English. Do not add any explanation, interpretation, or additional context. Preserve all original meaning, tone, and emotion as closely as possible. The original language was detected as: ${primaryLanguage}.`
      : `You are a transcription refinement assistant. Improve the grammar and sentence structure of the following English text without changing its meaning. Do not add, infer, or rephrase anything beyond clarity and correctness. Remove filler words only where it doesn't affect the speaker's intent. Keep tone and phrasing as close to the original as possible.`;
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
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
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI] OpenAI API error:", errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }
    
    const result = await response.json();
    const refinedText = result.choices?.[0]?.message?.content || text;
    
    console.log("[AI] Text processed successfully, new length:", refinedText.length);
    console.log("[AI] Original text sample:", text.substring(0, 50));
    console.log("[AI] Processed text sample:", refinedText.substring(0, 50));
    console.log("[AI] Used detected language(s):", detectedLanguages.join(', '));
    
    return { refinedText, needsTranslation };
  } catch (error) {
    console.error("[AI] Text refinement error:", error);
    return { refinedText: text, needsTranslation: false }; // Return original text on error
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
    console.log("[AI] Analyzing emotions in text:", text.substring(0, 50) + "....");
    
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

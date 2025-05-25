
// Import necessary Deno modules
import { encode as base64Encode } from "https://deno.land/std@0.132.0/encoding/base64.ts";

/**
 * Transcribe audio using OpenAI's Whisper API
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
    formData.append("model", "gpt-4o-mini-transcribe");
    
    // Only add language parameter if it's not 'auto'
    if (language !== 'auto') {
      formData.append("language", language);
    }
    
    console.log("[Transcription] Sending request to OpenAI with:", {
      fileSize: audioBlob.size,
      fileType: audioBlob.type,
      fileExtension,
      hasApiKey: !!apiKey,
      model: "gpt-4o-mini-transcribe",
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
    
    // Get detected languages from the API response, not defaulting to any specific language
    const detectedLanguages = result.language ? [result.language] : ["unknown"];
    
    console.log("[Transcription] Success:", {
      textLength: transcribedText.length,
      sampleText: transcribedText.substring(0, 50) + "...",
      model: "gpt-4o-mini-transcribe",
      detectedLanguage: detectedLanguages[0]
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
 * Helper function to check if transcription quality seems reasonable
 */
function isTranscriptionQualityReasonable(text: string, audioDurationMs: number): boolean {
  if (!text || text.trim().length === 0) return false;
  
  // Very rough estimate: expect at least 1 character per second of audio for reasonable transcription
  const minExpectedLength = Math.max(1, Math.floor(audioDurationMs / 2000)); // 1 char per 2 seconds minimum
  const actualLength = text.trim().length;
  
  // If transcription is extremely short compared to audio duration, it might be poor quality
  if (actualLength < minExpectedLength && audioDurationMs > 3000) { // Only apply this check for audio longer than 3 seconds
    console.log(`[AI] Transcription might be poor quality: ${actualLength} chars for ${audioDurationMs}ms audio`);
    return false;
  }
  
  return true;
}

/**
 * Translates and refines text using GPT-4 with faithful word-for-word processing
 * Handles translation to English if needed and preserves original meaning exactly
 */
export async function translateAndRefineText(
  text: string, 
  apiKey: string,
  detectedLanguages: string[],
  audioDurationMs: number = 0
): Promise<{ refinedText: string; }> {
  try {
    console.log("[AI] Starting text refinement:", text.substring(0, 50) + "...");
    console.log("[AI] Detected languages:", detectedLanguages);
    
    // Check transcription quality first
    if (!isTranscriptionQualityReasonable(text, audioDurationMs)) {
      console.log("[AI] Poor transcription quality detected, returning original text");
      return { refinedText: text };
    }
    
    // Check if the detected language indicates non-English content
    const isNonEnglish = detectedLanguages[0] !== 'en' && detectedLanguages[0] !== 'unknown';
    const detectedLanguagesInfo = detectedLanguages.join(', ');
    
    // Create more faithful system messages that preserve exact content
    const systemMessage = isNonEnglish 
      ? `You are a precise translator that converts text from ${detectedLanguagesInfo} to English. Your task is to translate the following text word-for-word to English while preserving the exact meaning, tone, and structure. Do not add explanations, interpretations, or additional content. Only translate what is actually said. If the text is unclear or seems like gibberish, translate it as literally as possible without adding creative interpretations.`
      : `You are a precise transcription processor. The following text was transcribed from English audio (detected language: ${detectedLanguagesInfo}). Your task is to:
1. Keep the EXACT words and meaning as transcribed
2. Only fix obvious spelling errors or formatting issues
3. Do NOT add, remove, or interpret any content
4. Do NOT add explanations or creative interpretations
5. If the transcription seems unclear or short, preserve it exactly as it is
6. Return only the faithful transcription without additional commentary

Preserve the original content exactly as spoken.`;
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o", // Using main model for high-quality translation/refinement
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
        max_tokens: 1000,
        temperature: 0.1 // Low temperature for more consistent, faithful output
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI] OpenAI API error:", errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }
    
    const result = await response.json();
    const refinedText = result.choices?.[0]?.message?.content || text;
    
    // Additional validation: if the refined text is drastically different in length or seems to be an explanation rather than transcription, use original
    const originalLength = text.trim().length;
    const refinedLength = refinedText.trim().length;
    
    // If refined text is more than 3x longer than original and original was very short, it might be an explanation
    if (originalLength < 20 && refinedLength > originalLength * 3) {
      console.log("[AI] Refined text seems to be an explanation rather than faithful transcription, using original");
      return { refinedText: text };
    }
    
    console.log("[AI] Text refined successfully, new length:", refinedText.length);
    console.log("[AI] Original text sample:", text.substring(0, 50));
    console.log("[AI] Refined text sample:", refinedText.substring(0, 50));
    console.log("[AI] Used detected language(s):", detectedLanguagesInfo);
    
    return { refinedText };
  } catch (error) {
    console.error("[AI] Text refinement error:", error);
    return { refinedText: text }; // Return original text on error
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
        model: "gpt-4o",
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

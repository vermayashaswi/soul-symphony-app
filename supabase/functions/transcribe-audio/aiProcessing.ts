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
    formData.append("model", "whisper-1"); // Fixed: Use correct model name
    
    // Only add language parameter if it's not 'auto'
    if (language !== 'auto') {
      formData.append("language", language);
    }
    
    console.log("[Transcription] Sending request to OpenAI with:", {
      fileSize: audioBlob.size,
      fileType: audioBlob.type,
      fileExtension,
      hasApiKey: !!apiKey,
      model: "whisper-1", // Fixed: Use correct model name
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
    
    // Get detected languages from the API response
    const detectedLanguages = result.language ? [result.language] : ["unknown"];
    
    console.log("[Transcription] Success:", {
      textLength: transcribedText.length,
      sampleText: transcribedText.substring(0, 50) + "...",
      model: "whisper-1", // Fixed: Use correct model name
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
 * Translates and refines text using GPT-4 
 * Handles translation to English if needed and improves transcription quality
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
    // We never default to 'en' here - we only use what the transcription model detected
    const isNonEnglish = detectedLanguages[0] !== 'en';
    const detectedLanguagesInfo = detectedLanguages.join(', ');
    
    // Call the OpenAI API with the appropriate system message
    // Include detected language information in both prompts
    const systemMessage = isNonEnglish 
      ? `You are a multilingual translator. Translate the following text exactly into natural, fluent English. Do not add any explanation, interpretation, or additional context. Preserve all original meaning, tone, and emotion as closely as possible. The original language was detected as: ${detectedLanguagesInfo}.`
      : `You are a transcription refinement assistant. Improve the grammar and sentence structure of the following English text without changing its meaning. Do not add, infer, or rephrase anything beyond clarity and correctness. Remove filler words only where it doesn't affect the speaker's intent. Keep tone and phrasing as close to the original as possible.`;
    
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

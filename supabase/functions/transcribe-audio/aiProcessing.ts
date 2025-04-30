// Import necessary Deno modules
import { encode as base64Encode } from "https://deno.land/std@0.132.0/encoding/base64.ts";

/**
 * Transcribe audio using OpenAI's Whisper API
 * @param audioBlob The audio blob to transcribe
 * @param fileExtension The file extension (e.g., 'webm', 'mp3')
 * @param apiKey OpenAI API key
 * @param language Language code or 'auto' for automatic detection
 * @returns Transcribed text and detected languages
 */
export async function transcribeAudioWithWhisper(
  audioBlob: Blob,
  fileExtension: string,
  apiKey: string,
  language: string = 'auto'
): Promise<{ text: string; detectedLanguages: string[] }> {
  try {
    console.log("[Transcription] Preparing audio for OpenAI:", { 
      blobSize: audioBlob.size, 
      blobType: audioBlob.type, 
      fileExtension 
    });
    
    // Generate a valid filename with the correct extension
    const filename = `audio.${fileExtension}`;
    console.log("[Transcription] Using filename:", filename);
    
    // Create form data for the API request
    const formData = new FormData();
    formData.append("file", audioBlob, filename);
    formData.append("model", "gpt-4o-transcribe"); // Updated from gpt-4o-mini-transcribe to gpt-4o-transcribe
    
    // Set language parameter if provided
    if (language && language !== 'auto') {
      formData.append("language", language);
    }
    
    // Set response format to JSON
    formData.append("response_format", "verbose_json");
    
    console.log("[Transcription] Sending request to OpenAI with:", {
      fileSize: audioBlob.size,
      fileType: audioBlob.type,
      fileExtension,
      hasApiKey: !!apiKey,
      model: "gpt-4o-transcribe", // Updated model name
      autoLanguageDetection: language === 'auto'
    });
    
    // Make the API request
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    // Handle API response
    if (!response.ok) {
      const errorData = await response.text();
      console.error("[Transcription] OpenAI API error:", errorData);
      throw new Error(`OpenAI API error: ${response.status} ${errorData}`);
    }

    // Parse the response
    const data = await response.json();
    
    // Extract the transcribed text
    const text = data.text || "";
    
    // Extract detected languages if available
    const detectedLanguages = data.detected_language ? [data.detected_language] : ["unknown"];
    
    console.log("[Transcription] Success:", {
      textLength: text.length,
      sampleText: text.length > 30 ? text.substring(0, 30) + "..." : text,
      model: "gpt-4o-transcribe", // Updated model name
      detectedLanguage: detectedLanguages.join(', ')
    });
    
    return { text, detectedLanguages };
  } catch (error) {
    console.error("[Transcription] Error:", error);
    throw new Error(`Transcription failed: ${error.message}`);
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
      ? `You are a multilingual expert that translates and refines text from any language to English. The text was detected to be in language(s): ${detectedLanguagesInfo}. Please use this language information when translating. Translate the following text into clear, natural English while preserving all meaning and emotion.`
      : `You are an expert at refining transcribed text. The text was detected to be in language(s): ${detectedLanguagesInfo}. Clean up the input text into clear, well-structured sentences. Fix grammar issues, remove filler words, and make it sound more natural, but preserve ALL the original meaning and information.`;
    
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

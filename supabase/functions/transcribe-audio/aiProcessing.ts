// File: supabase/functions/transcribe-audio/aiProcessing.ts
// This file contains the AI processing functionality for the transcribe-audio edge function

/**
 * Translates and refines transcribed text using GPT
 */
export async function translateAndRefineText(transcribedText: string, apiKey: string) {
  if (!transcribedText) {
    return { refinedText: '', predictedLanguages: null };
  }
  
  try {
    console.log("Refining and translating text with GPT...");
    
    // Define the system prompt for GPT to process the transcribed text
    const systemPrompt = `
You are an assistant that helps refine speech-to-text transcriptions from journal entries. Your task is to:

1. Fix any grammatical errors, punctuation, and capitalization.
2. Maintain the original meaning and sentiment.
3. Preserve personal names, places, and technical terms even if they seem unusual.
4. Format the text in clear paragraphs with proper sentence structure.
5. Identify the languages used in the entry (primary and any secondary languages).
6. If the text is in a non-English language, provide an English translation while preserving the original non-English text.

DO NOT:
- Add information that wasn't in the original text
- Remove or significantly alter content from the original text
- Change the speaker's tone, opinion, or perspective

Output format:
{
  "refinedText": "The corrected and properly formatted text, with English translation only if the original was non-English",
  "predictedLanguages": [{"name": "Language name", "code": "ISO code", "confidence": 0-1 value, "primary": boolean}]
}
`;

    // Make a request to the OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4-0125-preview", // Using a capable model for this complex task
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: transcribedText
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent, conservative refinement
        max_tokens: 2000, // Allow sufficient space for response
        response_format: { type: "json_object" } // Request JSON response
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("OpenAI API error:", errorData);
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const result = data.choices[0].message.content;
    
    try {
      // Parse the JSON response
      const parsedResult = JSON.parse(result);
      console.log("Text refinement completed successfully");
      
      // Extract the refined text and predicted languages
      return {
        refinedText: parsedResult.refinedText || transcribedText,
        predictedLanguages: parsedResult.predictedLanguages || null
      };
    } catch (parseError) {
      console.error("Error parsing GPT response:", parseError);
      console.log("Raw response:", result);
      
      // If parsing fails, return the original text
      return {
        refinedText: transcribedText,
        predictedLanguages: null
      };
    }
  } catch (error) {
    console.error("Error in translateAndRefineText:", error);
    
    // On error, return the original text
    return {
      refinedText: transcribedText,
      predictedLanguages: null
    };
  }
}

import { OpenAI } from "https://deno.land/x/openai@v4.20.1/mod.ts";

/**
 * Transcribes audio using OpenAI's Whisper API
 */
export async function transcribeAudioWithWhisper(audioBlob: Blob, detectedFileType: string, apiKey: string): Promise<string> {
  try {
    console.log("Transcribing audio with Whisper API...");

    const openai = new OpenAI({ apiKey: apiKey });
    const transcription = await openai.audio.transcriptions.create({
      file: audioBlob,
      model: "whisper-1",
      response_format: "text"
    });

    console.log("Transcription completed successfully");
    return transcription;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  }
}

/**
 * Generates an embedding for the given text using OpenAI's Embedding API
 */
export async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  try {
    console.log("Generating embedding for text...");

    const openai = new OpenAI({ apiKey: apiKey });
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text
    });

    if (embeddingResponse.data.length === 0) {
      throw new Error("No embedding data returned from OpenAI API");
    }

    const embedding = embeddingResponse.data[0].embedding;
    console.log("Embedding generated successfully");
    return embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

/**
 * Analyzes emotions in the given text
 */
export async function analyzeEmotions(text: string, emotionsData: any[], apiKey: string): Promise<any> {
  try {
    console.log("Analyzing emotions in text...");

    // Construct the prompt for GPT
    const prompt = `
Analyze the following text and identify the primary emotions expressed. 
Return a JSON array of the emotions detected, each with a name and confidence score (0-1).
Use only the following emotions: ${emotionsData.map((e: any) => e.name).join(', ')}.

Text: "${text}"

Output format:
[{"emotion": "Emotion Name", "confidence": 0.0 - 1.0}]
`;

    // Call the OpenAI API
    const openai = new OpenAI({ apiKey: apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-0125",
      messages: [
        {
          role: "system",
          content: "You are an expert at understanding human emotions."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.4,
      max_tokens: 500,
      response_format: { type: "json_object" }
    });

    const result = completion.choices[0].message.content;
    console.log("Emotions analysis raw result:", result);

    try {
      // Parse the JSON response
      const parsedResult = JSON.parse(result);
      console.log("Emotions analysis completed successfully");
      return parsedResult;
    } catch (parseError) {
      console.error("Error parsing emotions analysis result:", parseError);
      console.log("Raw response:", result);
      return [];
    }
  } catch (error) {
    console.error("Error analyzing emotions:", error);
    return [];
  }
}

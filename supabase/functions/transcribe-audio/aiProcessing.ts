/**
 * AI processing utilities for transcription, translation, and analysis
 */

import { franc } from "https://deno.land/x/franc@v6.1.0/index.js";
import langTag from "https://deno.land/x/language_tags@1.0.0/mod.ts";

/**
 * Generates an embedding for text using OpenAI
 */
export async function generateEmbedding(text: string, openAIApiKey: string): Promise<number[]> {
  try {
    console.log('Generating embedding for text:', text.slice(0, 100) + '...');
    
    if (!openAIApiKey) {
      console.error('OpenAI API key is missing or empty');
      throw new Error('OpenAI API key is not configured');
    }
    
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }

    const result = await response.json();
    return result.data[0].embedding;
  } catch (error) {
    console.error('Error in generateEmbedding:', error);
    throw error;
  }
}

/**
 * Analyzes emotions in a text using OpenAI
 */
export async function analyzeEmotions(text: string, emotions: any[], openAIApiKey: string) {
  try {
    console.log('Analyzing emotions for text:', text.slice(0, 100) + '...');
    
    const emotionsPrompt = emotions.map(e => `- ${e.name}: ${e.description}`).join('\n');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an emotional analysis expert. You will be given a journal entry text and a list of emotions. 
            Analyze the text and identify which emotions from the provided list are present in the text. 
            Rate each identified emotion with an intensity value from 0 to 1, where 0 means not present and 1 means strongly present.
            Only include emotions that are actually expressed in the text with a score above 0.
            Return ONLY a JSON object with emotion names as keys and intensity values as numbers.
            
            Here is the list of emotions to choose from:
            ${emotionsPrompt}`
          },
          {
            role: 'user',
            content: `Analyze the emotions in this journal entry: "${text}"`
          }
        ],
        temperature: 0.5,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error analyzing emotions:', error);
      throw new Error('Failed to analyze emotions');
    }

    const result = await response.json();
    const emotionsText = result.choices[0].message.content;
    try {
      const emotions = JSON.parse(emotionsText);
      return emotions;
    } catch (err) {
      console.error('Error parsing emotions JSON:', err);
      console.error('Raw emotions text:', emotionsText);
      return null;
    }
  } catch (error) {
    console.error('Error in analyzeEmotions:', error);
    return null;
  }
}

/**
 * Detects the languages present in the transcribed text using franc
 */
export async function detectLanguages(text: string): Promise<string[]> {
  try {
    console.log('Detecting languages in text:', text.slice(0, 100) + '...');
    
    // Split text into chunks to analyze, as franc works better with smaller segments
    const chunks = text.split(/[.!?]+/).filter(chunk => chunk.trim().length > 10);
    
    const detectedLanguages = new Set<string>();
    
    // If text is too short, default to English
    if (text.length < 10) {
      console.log('Text too short for reliable language detection, defaulting to English');
      return ['en'];
    }
    
    // Process whole text first
    const mainLang = franc(text, { minLength: 10 });
    if (mainLang && mainLang !== 'und') {
      try {
        const langCode = langTag.language(mainLang).format();
        if (langCode) detectedLanguages.add(langCode);
      } catch (e) {
        console.log(`Could not resolve language tag for ${mainLang}`);
      }
    }
    
    // Process each meaningful chunk to detect multiple languages
    for (const chunk of chunks) {
      if (chunk.trim().length < 20) continue; // Skip very short chunks
      
      const lang = franc(chunk, { minLength: 10 });
      if (lang && lang !== 'und') {
        try {
          const langCode = langTag.language(lang).format();
          if (langCode) detectedLanguages.add(langCode);
        } catch (e) {
          console.log(`Could not resolve language tag for ${lang}`);
        }
      }
    }
    
    // Default to English if no languages detected
    if (detectedLanguages.size === 0) {
      console.log('No languages reliably detected, defaulting to English');
      return ['en'];
    }
    
    const result = Array.from(detectedLanguages);
    console.log('Detected languages:', result);
    return result;
  } catch (error) {
    console.error('Error in detectLanguages:', error);
    return ['en']; // Default to English on error
  }
}

/**
 * Transcribes audio and translates it if needed
 */
export async function transcribeAudioWithWhisper(
  audioBlob: Blob, 
  fileType: string, 
  openAIApiKey: string
): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, `audio.${fileType}`);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'json');
  
  // No language parameter - let Whisper auto-detect
  console.log("Sending to Whisper API with auto language detection");
  
  const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
    },
    body: formData,
  });

  if (!whisperResponse.ok) {
    const errorText = await whisperResponse.text();
    console.error("Whisper API error:", errorText);
    throw new Error(`Whisper API error: ${errorText}`);
  }

  const whisperResult = await whisperResponse.json();
  return whisperResult.text;
}

/**
 * Translates and refines the transcribed text
 */
export async function translateAndRefineText(
  transcribedText: string,
  openAIApiKey: string
): Promise<{ refinedText: string }> {
  try {
    console.log("Sending text to GPT for translation and refinement:", transcribedText.slice(0, 100) + "...");
    
    // First detect languages in the transcribed text
    const detectedLanguages = await detectLanguages(transcribedText);
    const languagesInfo = detectedLanguages.join(', ');
    
    console.log("Detected languages:", languagesInfo);
    
    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an empathetic writing assistant helping users journal. The following transcription is a voice journal that may contain multiple languages, informal speech, and emotional content.

Your task:
1. Translate all non-English portions to English.
2. Preserve the speaker's tone, intent, and emotional expression.
3. Maintain a first-person, personal narrative.
4. Do NOT add commentary or analysis.
5. Fix grammar or spelling issues only when necessary for clarity.
6. Retain cultural texts and just transliterate those to English 

Detected languages in the text: ${languagesInfo}

Here is the transcription:`
          },
          {
            role: 'user',
            content: `${transcribedText}`
          },
          {
            role: 'system',
            content: 'Reply with only the translated and corrected text. Apart from the translation of the audio entry, don\'t explain or provide any information from your end!'
          }
        ],
        temperature: 0.3
      }),
    });

    if (!gptResponse.ok) {
      const errorText = await gptResponse.text();
      console.error("GPT API error:", errorText);
      throw new Error(`GPT API error: ${errorText}`);
    }

    const gptResult = await gptResponse.json();
    const refinedText = gptResult.choices[0].message.content;
    
    console.log("GPT Response (first 100 chars):", refinedText.slice(0, 100) + "...");
    
    return { refinedText };
  } catch (error) {
    console.error("Error in translateAndRefineText:", error);
    // If translation fails, return original text as refined text
    return { refinedText: transcribedText };
  }
}


// Add import for OpenAI
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

/**
 * Detect languages in a piece of text
 */
export async function detectLanguages(text: string, openAIApiKey: string): Promise<string[]> {
  try {
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
            content: 'You are a language detection assistant. Your ONLY task is to identify all languages present in the given text. Respond ONLY with a comma-separated list of language codes (e.g., "en,fr,es"). Do not include any other information or explanation.'
          },
          {
            role: 'user',
            content: `Identify all languages in this text: "${text}"`
          }
        ],
        max_tokens: 100,
        temperature: 0.3
      }),
    });

    const data = await response.json();
    const languageCodes = data.choices[0].message.content.trim();
    return languageCodes.split(',').map((code: string) => code.trim());
  } catch (error) {
    console.error('Error detecting languages:', error);
    return ['en']; // Default to English on error
  }
}

/**
 * Detect primary language from an audio sample
 */
export async function detectLanguageFromAudio(
  audioBlob: Blob, 
  openAIApiKey: string
): Promise<string> {
  try {
    // Create a FormData object to send the audio file
    const formData = new FormData();
    formData.append('file', audioBlob);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'json');
    
    // Send the request to OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/translations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Unknown error');
    }
    
    const data = await response.json();
    
    // Try to extract language information
    let detectedLanguage = 'en'; // Default to English
    
    if (data.language) {
      detectedLanguage = data.language;
    }
    
    return detectedLanguage;
  } catch (error) {
    console.error('Error detecting language from audio:', error);
    return 'en'; // Default to English on error
  }
}

/**
 * Transcribe audio file using OpenAI Whisper
 */
export async function transcribeAudioWithWhisper(
  audioBlob: Blob,
  fileType: string,
  openAIApiKey: string,
  language?: string
): Promise<string> {
  try {
    // Create FormData to send audio file
    const formData = new FormData();
    formData.append('file', audioBlob, `audio.${fileType}`);
    formData.append('model', 'whisper-1');
    
    // Add language parameter if provided
    if (language) {
      formData.append('language', language);
    }
    
    console.log("Sending audio to Whisper API with params:", {
      fileType,
      blobSize: audioBlob.size,
      language: language || 'auto-detect'
    });
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Whisper API error:', errorText);
      throw new Error(`Whisper API error: ${errorText}`);
    }

    const data = await response.json();
    console.log("Whisper transcription successful, text length:", data.text?.length || 0);
    return data.text;
  } catch (error) {
    console.error('Error in Whisper transcription:', error);
    throw error;
  }
}

/**
 * Translate and refine the transcribed text
 * This ensures the text is in proper English and well-formatted
 */
export async function translateAndRefineText(
  transcribedText: string, 
  openAIApiKey: string,
  detectedLanguages: string[] = ['en']
): Promise<{ refinedText: string }> {
  try {
    if (!transcribedText || transcribedText.trim().length === 0) {
      console.error('No text to translate/refine');
      return { refinedText: '' };
    }
    
    // Check if the text needs translation
    const needsTranslation = !detectedLanguages.includes('en') || detectedLanguages.length > 1;
    
    console.log("Translating and refining text:", {
      textLength: transcribedText.length,
      detectedLanguages,
      needsTranslation
    });
    
    // Build the system prompt based on detected languages
    let systemPrompt = 'You are an expert transcription editor.';
    
    if (needsTranslation) {
      const languageList = detectedLanguages.join(', ');
      systemPrompt += ` The text may contain content in ${languageList}. Translate everything to English while preserving the original meaning.`;
    }
    
    systemPrompt += ' Polish the transcription by fixing grammar, punctuation, and capitalization. Preserve all factual content. Format paragraphs naturally.';
    
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
            content: systemPrompt
          },
          {
            role: 'user',
            content: transcribedText
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Error translating/refining text:', errorData);
      
      // If translation fails, fall back to original text
      return { refinedText: transcribedText };
    }

    const data = await response.json();
    const refinedText = data.choices[0]?.message?.content || transcribedText;
    
    console.log("Text refinement complete, original length:", transcribedText.length, 
                "refined length:", refinedText.length);
    
    return { refinedText };
  } catch (error) {
    console.error('Error translating/refining text:', error);
    // On error, return the original text
    return { refinedText: transcribedText };
  }
}

/**
 * Generate embedding for text using OpenAI Embeddings API
 */
export async function generateEmbedding(text: string, openAIApiKey: string): Promise<number[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Analyze emotions from text
 */
export async function analyzeEmotions(
  text: string,
  emotions: Array<{name: string, description?: string}>,
  openAIApiKey: string
): Promise<{[key: string]: number}> {
  try {
    if (!text || text.length < 5) {
      return {};
    }
    
    // Create a list of emotions for the prompt
    const emotionsList = emotions.map(e => 
      `"${e.name}"${e.description ? `: ${e.description}` : ''}`
    ).join('\n');
    
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
            content: `You are an emotion analysis expert. Analyze the text and provide scores for each emotion on a scale of 0.0 to 1.0, where 0.0 means not present and 1.0 means strongly present. Respond ONLY with a JSON object where keys are emotion names and values are scores. The emotions to analyze are:\n${emotionsList}`
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      }),
    });
    
    const data = await response.json();
    
    try {
      // Try to parse the response as JSON
      const emotionsResponse = JSON.parse(data.choices[0].message.content.trim());
      return emotionsResponse;
    } catch (parseError) {
      console.error('Error parsing emotions response:', parseError);
      
      // Fallback: try to extract JSON from text
      const jsonMatch = data.choices[0].message.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('Error parsing extracted JSON:', e);
        }
      }
      
      return {};
    }
  } catch (error) {
    console.error('Error analyzing emotions:', error);
    return {};
  }
}

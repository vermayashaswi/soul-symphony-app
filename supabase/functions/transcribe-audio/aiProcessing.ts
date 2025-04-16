
// This file should be created if it doesn't exist yet
// It contains functions for AI processing in the transcribe-audio edge function

/**
 * Translate and refine text using GPT
 * @param text - Text to translate and refine
 * @param apiKey - OpenAI API key
 * @param detectedLanguages - Detected languages in the text
 */
export async function translateAndRefineText(
  text: string, 
  apiKey: string,
  detectedLanguages: string[] = ['en']
): Promise<{ refinedText: string }> {
  try {
    // Skip processing for very short text
    if (!text || text.length < 5) {
      console.log("Text too short for refinement, returning as is");
      return { refinedText: text };
    }

    const primaryLanguage = detectedLanguages[0] || 'en';
    
    // Updated prompt as specified
    const systemPrompt = `You are a professional translator for a voice journaling app, SOuLO, that understands multi-lingual contexts and colloquial language phrases. Translate the following text from ${primaryLanguage} to English, preserving the original meaning, tone, and style. Make sure you use the languages detected by us as context as well. Then, fix any grammatical errors, improve clarity, and enhance readability while keeping the original meaning intact. Donot assume or add anything by yourself. Your response will be shown to a user using an app that wants to ONLY see their translation in English!!!`;

    // Make request to OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Error calling OpenAI API: ${error}`);
      return { refinedText: text }; // Fall back to original text on error
    }

    const data = await response.json();
    const refinedText = data.choices[0].message.content;
    
    return { refinedText: refinedText || text };
  } catch (error) {
    console.error('Error in translateAndRefineText:', error);
    return { refinedText: text }; // Fall back to original text on error
  }
}

/**
 * Detect language from audio
 * @param audioBlob - Audio blob
 * @param apiKey - OpenAI API key
 */
export async function detectLanguageFromAudio(
  audioBlob: Blob,
  apiKey: string
): Promise<string> {
  try {
    // Use Whisper to detect language from a small sample
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'auto');
    formData.append('response_format', 'json');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const result = await response.json();
    return result.language || 'en';
  } catch (error) {
    console.error('Error detecting language:', error);
    return 'en'; // Default to English on error
  }
}

/**
 * Detect languages in text
 * @param text - Text to detect languages in
 * @param apiKey - OpenAI API key
 */
export async function detectLanguages(
  text: string,
  apiKey: string
): Promise<string[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { 
            role: 'system', 
            content: 'You are a language detection expert. Analyze the text and identify all languages present. Return ONLY a JSON array of language codes, with the primary language first.' 
          },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const langResult = JSON.parse(data.choices[0].message.content);
    
    if (Array.isArray(langResult.languages)) {
      return langResult.languages;
    }
    
    return ['en']; // Default to English if format isn't as expected
  } catch (error) {
    console.error('Error detecting languages:', error);
    return ['en']; // Default to English on error
  }
}

/**
 * Transcribe audio with Whisper API
 * @param audioBlob - Audio blob
 * @param fileExtension - Audio file extension
 * @param apiKey - OpenAI API key
 * @param language - Language code
 */
export async function transcribeAudioWithWhisper(
  audioBlob: Blob,
  fileExtension: string,
  apiKey: string,
  language: string = 'en'
): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', audioBlob, `audio.${fileExtension}`);
    formData.append('model', 'whisper-1');
    formData.append('language', language);
    formData.append('response_format', 'json');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Whisper API error:', errorText);
      throw new Error(`Whisper API error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    return result.text || '';
  } catch (error) {
    console.error('Error in transcribeAudioWithWhisper:', error);
    throw error;
  }
}

/**
 * Generate embedding for text
 * @param text - Text to generate embedding for
 * @param apiKey - OpenAI API key
 */
export async function generateEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        input: text,
        model: 'text-embedding-ada-002'
      })
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Analyze emotions in text
 * @param text - Text to analyze
 * @param emotions - Emotions to analyze for
 * @param apiKey - OpenAI API key
 */
export async function analyzeEmotions(
  text: string,
  emotions: any[],
  apiKey: string
): Promise<any> {
  try {
    // Create a prompt for emotion analysis
    const emotionsNames = emotions.map(e => e.name).join(', ');
    const emotionPrompt = `
    Analyze the following text and rate it on a scale from 0.0 to 1.0 for each of these emotions: ${emotionsNames}.
    
    Return ONLY a JSON object with emotion names as keys and confidence scores as values (e.g. {"joy": 0.8, "sadness": 0.1}).
    `;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: emotionPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    
    return result;
  } catch (error) {
    console.error('Error analyzing emotions:', error);
    return {}; // Return empty object on error
  }
}

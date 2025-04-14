
/**
 * AI processing utilities for transcription, translation, and analysis
 */

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
 * Detects the languages present in the transcribed text
 */
export async function detectLanguages(text: string, openAIApiKey: string): Promise<string[]> {
  try {
    console.log('Detecting languages in text:', text.slice(0, 100) + '...');
    
    // Use a lightweight GPT model to detect languages
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
            content: `You are a language detection expert. Identify all languages used in the provided text. 
            Return ONLY a JSON array of language codes (e.g., ["en", "es", "fr"]). 
            If the text is entirely in one language, return only that language code. 
            Use ISO 639-1 two-letter language codes.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error detecting languages:', error);
      return ['en']; // Default to English if detection fails
    }

    const result = await response.json();
    try {
      const content = result.choices[0].message.content;
      const langData = JSON.parse(content);
      
      if (Array.isArray(langData.languages)) {
        console.log('Detected languages:', langData.languages);
        return langData.languages;
      } else if (Array.isArray(langData)) {
        console.log('Detected languages:', langData);
        return langData;
      }
      
      return ['en']; // Default to English if format is unexpected
    } catch (err) {
      console.error('Error parsing language detection response:', err);
      console.error('Raw response:', result.choices[0].message.content);
      return ['en']; // Default to English on error
    }
  } catch (error) {
    console.error('Error in detectLanguages:', error);
    return ['en']; // Default to English on error
  }
}

/**
 * Detect language from audio before transcription
 */
export async function detectLanguageFromAudio(audioBlob: Blob, openAIApiKey: string): Promise<string> {
  try {
    console.log('Detecting language from audio sample...');
    
    // Create a small sample of the audio for language detection
    // We'll use the first 30 seconds to determine the primary language
    const sampleSize = Math.min(audioBlob.size, 1024 * 1024); // Max 1MB sample
    const audioSample = audioBlob.slice(0, sampleSize);
    
    // Send a small sample to Whisper for language identification only
    const formData = new FormData();
    formData.append('file', audioSample, 'audio_sample.webm');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'json');
    formData.append('prompt', 'This is a language detection sample.');
    
    console.log('Sending sample to Whisper API for language detection');
    
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('Error detecting language from audio:', errorText);
      return 'en'; // Default to English if detection fails
    }

    const sampleResult = await whisperResponse.json();
    
    // If we got a sample transcription, use detectLanguages to analyze it
    if (sampleResult.text) {
      const detectedLanguages = await detectLanguages(sampleResult.text, openAIApiKey);
      console.log('Languages detected from audio sample:', detectedLanguages);
      
      // Return the primary language (first in the array)
      if (detectedLanguages && detectedLanguages.length > 0) {
        return detectedLanguages[0];
      }
    }
    
    return 'en'; // Default to English if no language detected
  } catch (error) {
    console.error('Error in detectLanguageFromAudio:', error);
    return 'en'; // Default to English on error
  }
}

/**
 * Transcribes audio and translates it if needed
 */
export async function transcribeAudioWithWhisper(
  audioBlob: Blob, 
  fileType: string, 
  openAIApiKey: string,
  primaryLanguage?: string
): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, `audio.${fileType}`);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'json');
  
  // Use detected language if available
  if (primaryLanguage && primaryLanguage !== 'en') {
    console.log(`Using detected primary language for transcription: ${primaryLanguage}`);
    formData.append('language', primaryLanguage);
  } else {
    console.log("Sending to Whisper API with auto language detection");
  }
  
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
  openAIApiKey: string,
  detectedLanguages?: string[]
): Promise<{ refinedText: string }> {
  try {
    console.log("Sending text to GPT for translation and refinement:", transcribedText.slice(0, 100) + "...");
    
    // First detect languages in the transcribed text if not provided
    const languagesToUse = detectedLanguages || await detectLanguages(transcribedText, openAIApiKey);
    const languagesInfo = languagesToUse.join(', ');
    
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
1. Translate all non-English portions to English and concatenate these to make sense and completely translate complete sentences to english
2. Preserve the speaker's tone, intent, emotional expression and cultural context.
3. Maintain a first-person, personal narrative.
4. DO NOT add commentary or analysis. JUST TRANSLATE as we will be showing your reponse to the user who's expect just to see the translation  
5. Fix grammar or spelling issues only when necessary for clarity

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

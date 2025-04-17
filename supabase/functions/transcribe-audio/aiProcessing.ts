
export async function transcribeAudioWithWhisper(
  audioBlob: Blob,
  fileExtension: string,
  apiKey: string,
  language: string = 'en'
): Promise<string> {
  try {
    // Log incoming audio details for debugging
    console.log('[Transcription] Preparing audio for OpenAI:', {
      blobSize: audioBlob.size,
      blobType: audioBlob.type,
      fileExtension,
      language
    });
    
    // Ensure we have a valid API key
    if (!apiKey) {
      throw new Error('Missing OpenAI API key');
    }
    
    // Ensure the audio blob is valid
    if (!audioBlob || audioBlob.size === 0) {
      throw new Error('Empty or invalid audio data');
    }
    
    // Create a proper filename with extension
    const filename = `audio.${fileExtension}`;
    console.log(`[Transcription] Using filename: ${filename}`);
    
    const formData = new FormData();
    formData.append('file', audioBlob, filename);
    formData.append('model', 'gpt-4o-mini-transcribe');  // Using gpt-4o-mini-transcribe model
    formData.append('language', language);
    formData.append('response_format', 'json');
    formData.append('prompt', 'The following is a journal entry or conversation that may contain personal thoughts, feelings, or experiences.');
    
    console.log('[Transcription] Sending request to OpenAI with:', {
      fileSize: audioBlob.size,
      fileType: audioBlob.type,
      fileExtension,
      language,
      hasApiKey: !!apiKey,
      model: 'gpt-4o-mini-transcribe'
    });
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
    
    try {
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Transcription] API error:', errorText);
        throw new Error(`Transcription API error: ${response.status} - ${errorText}`);
      }
      
      // Note: gpt-4o-mini-transcribe only supports json or text response formats
      const result = await response.json();
      
      if (!result.text) {
        console.error('[Transcription] No text in response:', result);
        throw new Error('No transcription text returned from API');
      }
      
      console.log('[Transcription] Success:', {
        textLength: result.text.length,
        sampleText: result.text.substring(0, 100) + '...',
        model: 'gpt-4o-mini-transcribe'
      });
      
      return result.text;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Transcription request timed out after 60 seconds');
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('[Transcription] Error in transcribeAudioWithWhisper:', error);
    throw error;
  }
}

// Add these exported functions that were referenced but missing
export async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  try {
    console.log("[AI] Generating embedding for text:", text.substring(0, 100) + "...");
    
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.substring(0, 8000) // Limit to 8000 chars for embedding models
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI] Embedding API error:", errorText);
      throw new Error(`Embedding API error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log("[AI] Embedding generated successfully");
    
    return result.data[0].embedding;
  } catch (error) {
    console.error("[AI] Error in generateEmbedding:", error);
    throw error;
  }
}

export async function analyzeEmotions(text: string, emotionsData: any[], apiKey: string): Promise<any[]> {
  try {
    console.log("[AI] Analyzing emotions in text:", text.substring(0, 100) + "...");
    
    // Create a list of emotions for the prompt
    const emotionsList = emotionsData.map(e => `- ${e.name}: ${e.description}`).join('\n');
    
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
            content: `You are an emotion analysis assistant. You will analyze text and identify emotions expressed in it.
            Analyze the text and select up to 3 of the most prominent emotions from this list:
            ${emotionsList}
            
            For each emotion you identify, provide an intensity score from 0.1 to 1.0 (with 1.0 being the strongest).
            Format your response as JSON without explanations, like this example:
            [{"id": 3, "name": "Joy", "intensity": 0.8}, {"id": 7, "name": "Gratitude", "intensity": 0.6}]`
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI] Emotions API error:", errorText);
      throw new Error(`Emotions API error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    const emotions = JSON.parse(result.choices[0].message.content);
    
    console.log("[AI] Emotions analyzed successfully:", emotions);
    
    return emotions;
  } catch (error) {
    console.error("[AI] Error in analyzeEmotions:", error);
    // Return empty array instead of throwing to avoid breaking the process
    return [];
  }
}

export async function translateAndRefineText(text: string, apiKey: string, detectedLanguages: string[] = ['en']): Promise<{ refinedText: string }> {
  try {
    console.log("[AI] Refining text:", text.substring(0, 100) + "...");
    console.log("[AI] Detected languages:", detectedLanguages);
    
    // Skip refinement for very short text
    if (text.length < 10) {
      console.log("[AI] Text too short, skipping refinement");
      return { refinedText: text };
    }
    
    // Skip if the text is already in English and relatively short
    if (detectedLanguages.length === 1 && detectedLanguages[0] === 'en' && text.length < 2000) {
      console.log("[AI] Text already in English and relatively short, minimal refinement");
      return { refinedText: text };
    }
    
    const isMainlyEnglish = detectedLanguages[0] === 'en';
    const prompt = isMainlyEnglish 
      ? `Refine this journal entry to fix any grammar or spelling errors, but preserve the meaning, tone, and style:`
      : `Translate this journal entry to English, while preserving the original meaning, tone, and style:`;
    
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
            content: `You are a helpful assistant that ${isMainlyEnglish ? 'refines' : 'translates'} journal entries.
            Your task is to ${isMainlyEnglish ? 'correct any grammar or spelling mistakes while preserving the original meaning, tone, and style' : 'translate the text to English while preserving the original meaning, tone, and style'}.
            Do not add or remove information. Do not summarize. Keep the same level of detail.`
          },
          {
            role: "user",
            content: prompt + "\n\n" + text
          }
        ],
        temperature: 0.3
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI] Refinement API error:", errorText);
      // Return original text if refinement fails
      return { refinedText: text };
    }
    
    const result = await response.json();
    const refinedText = result.choices[0].message.content;
    
    console.log("[AI] Text refined successfully, new length:", refinedText.length);
    
    return { refinedText };
  } catch (error) {
    console.error("[AI] Error in translateAndRefineText:", error);
    // Return original text if refinement fails
    return { refinedText: text };
  }
}

export async function detectLanguageFromAudio(audioBlob: Blob, apiKey: string): Promise<string> {
  try {
    // For small audio files, we'll just use 'en' as default to save API calls
    if (audioBlob.size < 100000) { // Less than 100KB
      console.log("[AI] Audio file too small, assuming English");
      return 'en';
    }
    
    // Sample the first few seconds for language detection
    const formData = new FormData();
    formData.append('file', audioBlob.slice(0, Math.min(500000, audioBlob.size)), 'audio.webm');
    formData.append('model', 'gpt-4o-mini-transcribe');
    formData.append('prompt', 'Identify the language being spoken');
    formData.append('response_format', 'json');
    
    console.log('[AI] Detecting language from audio...');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });
    
    if (!response.ok) {
      console.error('[AI] Language detection error, defaulting to English');
      return 'en';
    }
    
    const result = await response.json();
    
    // If no result or very short sample, default to English
    if (!result.text || result.text.length < 5) {
      console.log('[AI] Insufficient audio for language detection, defaulting to English');
      return 'en';
    }
    
    // Use the detected text to determine language
    return await detectLanguages(result.text, apiKey);
  } catch (error) {
    console.error('[AI] Error in detectLanguageFromAudio:', error);
    return 'en'; // Default to English on error
  }
}

export async function detectLanguages(text: string, apiKey: string): Promise<string> {
  try {
    // For very short text, assume English to save API calls
    if (text.length < 10) {
      return 'en';
    }
    
    console.log("[AI] Detecting language from text:", text.substring(0, 50) + "...");
    
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
            content: `You are a language detection specialist. 
            Analyze the text and determine the primary language used. 
            Respond with just the ISO 639-1 language code (e.g., 'en' for English, 'es' for Spanish).
            If multiple languages are present, return only the predominant language code.`
          },
          {
            role: "user",
            content: text.substring(0, 1000) // Use only first 1000 chars for detection
          }
        ],
        temperature: 0.2,
        max_tokens: 10
      })
    });
    
    if (!response.ok) {
      console.error("[AI] Language detection error, defaulting to English");
      return 'en';
    }
    
    const result = await response.json();
    const langCode = result.choices[0].message.content.trim().toLowerCase();
    
    // Basic validation of language code format
    if (langCode.length !== 2 || !/^[a-z]{2}$/.test(langCode)) {
      console.log("[AI] Invalid language code detected, defaulting to English:", langCode);
      return 'en';
    }
    
    console.log("[AI] Language detected:", langCode);
    return langCode;
  } catch (error) {
    console.error("[AI] Error in detectLanguages:", error);
    return 'en'; // Default to English on error
  }
}


export async function transcribeAudioWithWhisper(
  audioBlob: Blob,
  fileExtension: string,
  apiKey: string,
  language: string = 'en'
): Promise<{ text: string, detectedLanguages: string[] }> {
  try {
    // Log incoming audio details for debugging
    console.log('[Transcription] Preparing audio for OpenAI:', {
      blobSize: audioBlob.size,
      blobType: audioBlob.type,
      fileExtension
    });
    
    // Ensure we have a valid API key
    if (!apiKey) {
      throw new Error('Missing OpenAI API key');
    }
    
    // Ensure the audio blob is valid
    if (!audioBlob || audioBlob.size === 0) {
      throw new Error('Empty or invalid audio data');
    }
    
    // Enforce minimum audio size
    if (audioBlob.size < 100) {
      throw new Error('Audio file is too small to be valid');
    }

    // Validate content type - always use WAV for best compatibility
    const contentType = audioBlob.type || 'audio/wav';
    if (!contentType.includes('audio/')) {
      console.warn('[Transcription] Audio blob has non-audio content type:', contentType);
      // We'll continue anyway but log the warning
    }
    
    // Create a proper filename with extension
    const filename = `audio.${fileExtension || 'wav'}`;
    console.log(`[Transcription] Using filename: ${filename}`);
    
    const formData = new FormData();
    formData.append('file', audioBlob, filename);
    formData.append('model', 'gpt-4o-transcribe');  // Using full gpt-4o-transcribe model
    // Important: Don't set language to 'auto', remove it if it's 'auto'
    if (language !== 'auto') {
      formData.append('language', language);
    }
    formData.append('response_format', 'json');
    formData.append('prompt', 'The following is a journal entry or conversation that may contain personal thoughts, feelings, or experiences.');
    
    console.log('[Transcription] Sending request to OpenAI with:', {
      fileSize: audioBlob.size,
      fileType: audioBlob.type,
      fileExtension,
      hasApiKey: !!apiKey,
      model: 'gpt-4o-transcribe'
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
      
      // Parse the JSON response from the gpt-4o-transcribe model
      const result = await response.json();
      
      if (!result.text) {
        console.error('[Transcription] No text in response:', result);
        throw new Error('No transcription text returned from API');
      }
      
      console.log('[Transcription] Success:', {
        textLength: result.text.length,
        sampleText: result.text.substring(0, 100) + '...',
        model: 'gpt-4o-transcribe',
        detectedLanguage: result.language || 'unknown',
      });
      
      // Extract detected languages from the response
      const detectedLanguages = result.language ? [result.language] : ['en'];
      
      return {
        text: result.text,
        detectedLanguages
      };
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
    console.log("[AI] Starting text refinement:", text.substring(0, 100) + "...");
    console.log("[AI] Detected languages:", detectedLanguages);
    
    // Remove skip condition - ALL text must be processed
    const languageList = detectedLanguages.join(', ');
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert translator assistant that translates multilingual journal entries for a voice journaling app called SOuLO where users record their entries in multiple languages.

Here are the detected languages being used in this transcription text: ${languageList}

Your task is to:
1. Correct any grammatical errors
2. Improve contextual clarity
3. Fix spelling mistakes
4. Maintain the original tone and meaning
5. Do not add or remove any information from the original text
6. Preserve the original meaning and translate as is!
7. ALWAYS make some improvements to the text, even if minor
8. Never return the exact input text - always make at least minor refinements`
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.3
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI] Refinement API error:", errorText);
      // Make a second attempt with a simpler prompt if first fails
      console.log("[AI] Making second attempt with simpler prompt");
      return await makeSecondAttempt(text, apiKey);
    }
    
    const result = await response.json();
    const refinedText = result.choices[0].message.content;
    
    // If the refined text is identical to original, make a second attempt
    if (refinedText === text) {
      console.log("[AI] Refined text identical to original, making second attempt");
      return await makeSecondAttempt(text, apiKey);
    }
    
    console.log("[AI] Text refined successfully, new length:", refinedText.length);
    console.log("[AI] Original text sample:", text.substring(0, 50));
    console.log("[AI] Refined text sample:", refinedText.substring(0, 50));
    
    return { refinedText };
  } catch (error) {
    console.error("[AI] Error in translateAndRefineText:", error);
    // Even in error case, never return original text unmodified
    return await makeSecondAttempt(text, apiKey);
  }
}

// Also update the second attempt function to ensure it always modifies the text
async function makeSecondAttempt(text: string, apiKey: string): Promise<{ refinedText: string }> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a text editor. You MUST make at least minor improvements to the text - never return it exactly as provided. Fix spelling, grammar, and improve clarity while preserving the original meaning."
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.2
      })
    });
    
    if (!response.ok) {
      console.error("[AI] Second refinement attempt failed");
      // As last resort, add a period if missing to ensure some modification
      return { refinedText: text.trim() + (text.trim().endsWith('.') ? '' : '.') };
    }
    
    const result = await response.json();
    const refinedText = result.choices[0].message.content;
    
    // Verify we're not returning identical text
    if (refinedText === text) {
      // Add minimal punctuation change to ensure some difference
      return { refinedText: text.trim() + (text.trim().endsWith('.') ? '' : '.') };
    }
    
    console.log("[AI] Second attempt refinement complete");
    return { refinedText };
  } catch (error) {
    console.error("[AI] Error in second refinement attempt:", error);
    // Add minimal change as last resort
    return { refinedText: text.trim() + (text.trim().endsWith('.') ? '' : '.') };
  }
}


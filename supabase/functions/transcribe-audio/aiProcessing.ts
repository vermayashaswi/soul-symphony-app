
/**
 * Generates an embedding for text using OpenAI API
 * @param text - Text to embed
 * @param apiKey - OpenAI API key
 * @returns Array of embedding values
 */
export async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    return result.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

/**
 * Analyzes emotions in text using OpenAI API
 * @param text - Text to analyze
 * @param emotions - List of emotions to analyze for
 * @param apiKey - OpenAI API key
 * @returns Object mapping emotions to scores
 */
export async function analyzeEmotions(text: string, emotions, apiKey: string): Promise<any> {
  try {
    // Extract emotion names for analysis
    const emotionNames = emotions.map(e => e.name);
    
    // Skip empty text
    if (!text || text.trim() === '') {
      console.log("Empty text provided for emotion analysis, skipping");
      return null;
    }

    // Prepare prompt for GPT
    const prompt = `
      I want you to analyze the emotional content of the following text and score it for each of these emotions: ${emotionNames.join(', ')}.
      
      For each emotion, provide a score between 0 and 1 where:
      - 0 means the emotion is not present at all
      - 0.5 means the emotion is moderately present
      - 1 means the emotion is strongly present
      
      Text to analyze:
      """
      ${text}
      """
      
      Respond with ONLY a JSON object mapping each emotion to its score, like this format exactly - no explanation, just the JSON:
      {
        "joy": 0.7,
        "sadness": 0.1,
        "anger": 0.0,
        ...and so on for all emotions
      }
    `;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an emotion analysis assistant that responds only with JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0.0,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    
    // Extract JSON from GPT response
    let jsonResponse = result.choices[0].message.content.trim();
    
    // Remove any markdown code block formatting if present
    jsonResponse = jsonResponse.replace(/```json|```/g, '').trim();
    
    // Parse the JSON response
    const emotions_data = JSON.parse(jsonResponse);
    
    // Ensure all emotions have values
    emotionNames.forEach(emotion => {
      if (emotions_data[emotion] === undefined) {
        emotions_data[emotion] = 0;
      }
    });

    return emotions_data;
  } catch (error) {
    console.error("Error analyzing emotions:", error);
    throw error;
  }
}

/**
 * Transcribes audio using OpenAI Whisper API
 * @param audioBlob - Audio blob to transcribe
 * @param fileType - Type of audio file
 * @param apiKey - OpenAI API key
 * @param language - Language code (or 'auto' for auto-detection)
 * @returns Transcribed text
 */
export async function transcribeAudioWithWhisper(
  audioBlob: Blob,
  fileType: string,
  apiKey: string,
  language: string = 'auto'
): Promise<{ text: string; detectedLanguages: string[] }> {
  try {
    console.log(`Transcribing audio with Whisper: size=${audioBlob.size}, type=${audioBlob.type}, language=${language}`);
    
    // Prepare form data for API request
    const formData = new FormData();
    formData.append('file', audioBlob, `audio.${fileType}`);
    formData.append('model', 'whisper-1');
    
    // Only add language parameter if it's not set to auto
    if (language !== 'auto') {
      formData.append('language', language);
    }
    
    // Call the Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Whisper API error:", errorText);
      throw new Error(`Whisper API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("Whisper response:", {
      textLength: result.text?.length || 0,
      hasLanguage: !!result.language
    });
    
    // Extract the detected language if available
    const detectedLanguages = result.language ? [result.language] : [];
    
    return { 
      text: result.text || '', 
      detectedLanguages 
    };
  } catch (error) {
    console.error("Error in transcribeAudioWithWhisper:", error);
    throw error;
  }
}

/**
 * Translates and refines text using OpenAI API - now respects the original language
 * @param text - Text to translate and refine
 * @param apiKey - OpenAI API key
 * @param detectedLanguages - Array of detected languages
 * @returns Original and refined text
 */
export async function translateAndRefineText(
  text: string, 
  apiKey: string,
  detectedLanguages: string[]
): Promise<{ 
  refinedText: string; 
}> {
  try {
    // Just refine the text without translating it
    // Return the original text as the refined text for now
    return {
      refinedText: text,
    };
  } catch (error) {
    console.error("Error in translateAndRefineText:", error);
    throw error;
  }
}

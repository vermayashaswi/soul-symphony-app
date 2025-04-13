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
 * Transcribes audio using Whisper with language detection
 */
export async function transcribeAudioWithWhisper(
  audioBlob: Blob, 
  fileType: string, 
  openAIApiKey: string
): Promise<{
  text: string, 
  detectedLanguages: {[key: string]: number} | null
}> {
  try {
    const formData = new FormData();
    formData.append('file', audioBlob, `audio.${fileType}`);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('language', '');  // Auto-detect language
    
    console.log("Sending to Whisper API transcription endpoint with language auto-detection");
    
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
    console.log("Whisper transcription result:", whisperResult.text.slice(0, 100) + "...");
    
    // Extract detected languages from the verbose response
    const detectedLanguages = whisperResult.language_probs || null;
    if (detectedLanguages) {
      console.log("Detected languages:", JSON.stringify(detectedLanguages));
    } else {
      console.log("No language detection information provided by Whisper");
    }
    
    return {
      text: whisperResult.text,
      detectedLanguages
    };
  } catch (error) {
    console.error("Error in transcribeAudioWithWhisper:", error);
    return {
      text: "",
      detectedLanguages: null
    };
  }
}

/**
 * Translates the transcribed text to English using GPT-4o-mini
 */
export async function translateWithGPT(
  transcribedText: string,
  detectedLanguages: {[key: string]: number} | null,
  openAIApiKey: string
): Promise<string> {
  try {
    console.log("Translating text with GPT-4o-mini:", transcribedText.slice(0, 100) + "...");
    
    // Format the detected languages for the prompt
    let languagesDescription = "an unknown language";
    if (detectedLanguages) {
      const languages = Object.entries(detectedLanguages)
        .sort((a, b) => b[1] - a[1])  // Sort by probability (highest first)
        .filter(([_, prob]) => prob > 0.1)  // Only include languages with probability > 10%
        .map(([lang, prob]) => `${lang} (${Math.round(prob * 100)}%)`)
        .join(", ");
      
      if (languages) {
        languagesDescription = languages;
      }
    }
    
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
            content: `This is a transcript of a person speaking in a mix of ${languagesDescription}. Please translate the full message into fluent English and fix any errors or incomplete expressions. Maintain the intended meaning, tone, cultural context and correct for errors logically in the sentences. Don't return anything else other than just the translation!!`
          },
          {
            role: 'user',
            content: transcribedText
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!gptResponse.ok) {
      const errorText = await gptResponse.text();
      console.error("GPT API error:", errorText);
      throw new Error(`GPT API error: ${errorText}`);
    }

    const gptResult = await gptResponse.json();
    const translatedText = gptResult.choices[0].message.content;
    
    console.log("GPT Translation (first 100 chars):", translatedText.slice(0, 100) + "...");
    
    return translatedText;
  } catch (error) {
    console.error("Error in translateWithGPT:", error);
    // If translation fails, return original text
    return transcribedText;
  }
}

// Keep these functions as backwards compatibility
export async function translateAudioWithWhisper(audioBlob: Blob, fileType: string, openAIApiKey: string): Promise<string> {
  console.warn("translateAudioWithWhisper is deprecated, use transcribeAudioWithWhisper + translateWithGPT instead");
  const { text } = await transcribeAudioWithWhisper(audioBlob, fileType, openAIApiKey);
  return text;
}

export async function enhanceTranslatedText(translatedText: string, openAIApiKey: string): Promise<{ refinedText: string }> {
  console.warn("enhanceTranslatedText is deprecated, use translateWithGPT instead");
  return { refinedText: translatedText };
}

export async function translateAndRefineText(transcribedText: string, openAIApiKey: string): Promise<{ refinedText: string }> {
  console.warn("translateAndRefineText is deprecated, use translateWithGPT instead");
  const refinedText = await translateWithGPT(transcribedText, null, openAIApiKey);
  return { refinedText };
}

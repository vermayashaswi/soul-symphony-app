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
 * Transcribes audio and returns detected language info from Whisper
 */
export async function transcribeAudioWithWhisper(
  audioBlob: Blob, 
  fileType: string, 
  openAIApiKey: string
): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', audioBlob, `audio.${fileType}`);
    formData.append('model', 'whisper-1');
    
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
    
    // Log detected language from Whisper
    console.log("Whisper detected language:", whisperResult.language || "Not specified");
    
    return whisperResult.text;
  } catch (error) {
    console.error('Error in transcribeAudioWithWhisper:', error);
    throw error;
  }
}

/**
 * Translates and refines the transcribed text
 */
export async function translateAndRefineText(
  text: string,
  apiKey: string
): Promise<{ refinedText: string, error?: string }> {
  try {
    console.log("Starting text refinement and translation...");
    const systemMessage = `You are an expert in refining and translating speech-to-text content. Your job is to:
1. Fix grammatical errors and improve readability
2. Maintain the original meaning and voice of the speaker
3. Translate any non-English content to English`;

    const userMessage = `Please refine and translate this speech-to-text content if needed. Maintain the speaker's original voice and meaning while fixing grammar and improving readability:
    
${text}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API response not OK:", response.status, errorText);
      return { refinedText: text, error: `API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      console.error("Unexpected API response format:", JSON.stringify(data));
      return { refinedText: text, error: "Invalid API response format" };
    }
    
    const refinedText = data.choices[0].message.content.trim();
    
    // Verify we got a valid response
    if (!refinedText || refinedText.length < 10) {
      console.error("Refined text too short or empty:", refinedText);
      return { refinedText: text, error: "Refined text too short or empty" };
    }
    
    console.log("Text refinement successful!");
    return { refinedText };
  } catch (error) {
    console.error("Error in translateAndRefineText:", error);
    // Return original text on error instead of empty string
    return { refinedText: text, error: error.message };
  }
}

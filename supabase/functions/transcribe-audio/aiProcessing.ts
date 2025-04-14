
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
  transcribedText: string,
  openAIApiKey: string
): Promise<{ refinedText: string }> {
  try {
    console.log("Sending text to GPT for translation and refinement:", transcribedText.slice(0, 100) + "...");
    
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
            content: `You are a helpful assistant that improves journal entries. Your goal is to:
            1. Keep the original meaning intact
            2. Fix any grammar or spelling errors
            3. Improve clarity and readability
            4. Structure the text into paragraphs if needed
            5. If the text is in a language other than English, translate it to English while preserving the original meaning
            
            Do NOT add any new information, opinions, or comments not present in the original text.
            Do NOT summarize - maintain all details from the original text.
            Return ONLY the improved text without any explanations, comments, or extra text.`
          },
          {
            role: 'user',
            content: transcribedText
          }
        ],
        temperature: 0.3
      }),
    });

    if (!gptResponse.ok) {
      const error = await gptResponse.text();
      console.error('Error refining text with GPT:', error);
      throw new Error('Failed to refine text');
    }

    const result = await gptResponse.json();
    const refinedText = result.choices[0].message.content.trim();
    
    // Make sure we got back actual refined text and it's different from the original
    if (!refinedText || refinedText === transcribedText) {
      console.warn('GPT returned same text or empty response, using original text');
      return { refinedText: transcribedText };
    }
    
    console.log('Successfully refined text:', refinedText.slice(0, 100) + '...');
    return { refinedText };
  } catch (error) {
    console.error('Error in translateAndRefineText:', error);
    // If there's an error, use the original text
    return { refinedText: transcribedText };
  }
}

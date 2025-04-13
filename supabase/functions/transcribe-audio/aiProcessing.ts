
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
            content: 'You are an expert translator for multilingual, informal voice journals. The following text is a transliterated text of a user that could be speaking in a single language like Tamil, Telugu, Punjabi, Marathi, Bengali, Hindi, English, Spanish, Portugese, Afrikaans, Korean, Japanese etc. or could also often be switching between languages mid-sentence. Your job is to translate the entire transcript into natural, fluent English, keeping the original meaning, tone, and emotions intact. If there are any phrases in regional languages, interpret their intent rather than doing a literal word-for-word translation. Do not skip or paraphrase emotional expressions like sighs, pauses, or laughter—represent them appropriately in brackets if necessary. If anything is unclear or inaudible, mark it with [unclear] instead of guessing.'
          },
          {
            role: 'user',
            content: `Here is the transcript: "${transcribedText}"`
          }
        ]
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

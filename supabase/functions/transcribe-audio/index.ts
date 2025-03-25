import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function processBase64Chunks(base64String: string, chunkSize = 32768) {
  if (!base64String || base64String.length === 0) {
    console.error('Empty base64 string provided');
    return new Uint8Array(0);
  }

  try {
    const chunks: Uint8Array[] = [];
    let position = 0;
    
    while (position < base64String.length) {
      const chunk = base64String.slice(position, position + chunkSize);
      const binaryChunk = atob(chunk);
      const bytes = new Uint8Array(binaryChunk.length);
      
      for (let i = 0; i < binaryChunk.length; i++) {
        bytes[i] = binaryChunk.charCodeAt(i);
      }
      
      chunks.push(bytes);
      position += chunkSize;
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  } catch (error) {
    console.error('Error processing base64 chunks:', error);
    throw new Error('Failed to process audio data');
  }
}

// Function to transcribe audio using Whisper API
async function transcribeAudio(audioBlob: Uint8Array) {
  if (!openAIApiKey) {
    throw new Error('OpenAI API key is not configured');
  }
  
  try {
    const formData = new FormData();
    const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
    
    formData.append('file', audioFile);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'json');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Whisper API error:', errorData);
      throw new Error(`Whisper API error: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    return data.text || '';
  } catch (error) {
    console.error('Error in transcribeAudio:', error);
    throw error;
  }
}

// Function to refine/translate text if needed using GPT
async function refineText(text: string) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAIApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that refines and improves transcribed text. If the text is not in English, translate it to English. Fix grammar, punctuation, and make the text more coherent without changing its meaning.'
          },
          {
            role: 'user',
            content: `Please refine this transcribed text: "${text}"`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('GPT API error during text refinement:', errorData);
      throw new Error(`GPT API error: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error in refineText:', error);
    throw error;
  }
}

// Function to analyze emotions in text - UPDATED to return emotion scores
async function analyzeEmotions(text: string) {
  try {
    // Fetch emotion list from database
    const { data: emotions, error: emotionsError } = await supabase
      .from('emotions')
      .select('name, description')
      .order('id', { ascending: true });
      
    if (emotionsError) {
      console.error('Error fetching emotions:', emotionsError);
      throw new Error(`Database error: ${emotionsError.message}`);
    }
    
    if (!emotions || emotions.length === 0) {
      console.warn('No emotions found in database');
      return {};
    }
    
    const emotionNames = emotions.map(e => e.name);
    const emotionDescriptions = emotions.map(e => `${e.name}: ${e.description || e.name}`);
    
    // Analyze emotions using GPT
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAIApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an emotion analysis assistant. Analyze the text and identify the emotions present from this list: ${emotionNames.join(', ')}. 
            
Here are some descriptions of these emotions: 
${emotionDescriptions.join('\n')}

Identify the top emotions present in the text. For each emotion present, generate a score from 0-100 based on how strongly it appears in the text. Only include emotions with a score of 20 or higher. Return the results as a simple JSON object with emotion names as keys and scores as values, for example: {"happy": 80, "excited": 65}. Do not include any array structure.`
          },
          {
            role: 'user',
            content: `Analyze the emotions in this text: "${text}"`
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('GPT API error during emotion analysis:', errorData);
      throw new Error(`GPT API error: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    let emotionScores = {};
    
    try {
      const content = data.choices[0].message.content.trim();
      emotionScores = JSON.parse(content);
      console.log("Parsed emotion scores:", emotionScores);
      
      // Validate the format - should be an object with emotion names as keys and scores as values
      if (typeof emotionScores !== 'object' || Array.isArray(emotionScores)) {
        console.warn('Emotion analysis result is not in the expected format:', emotionScores);
        return {};
      }
      
      return emotionScores;
    } catch (error) {
      console.error('Error parsing emotion analysis result:', error, data.choices[0].message.content);
      return {};
    }
  } catch (error) {
    console.error('Error in analyzeEmotions:', error);
    return {};
  }
}

// Function to extract master themes from text
async function extractThemes(text: string) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAIApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a thematic analysis assistant. Your task is to identify the 5 most prominent themes or topics discussed in the given text. Each theme should be a short phrase (2-4 words), not a complete sentence. Be specific rather than generic. You must return exactly 5 themes, no more and no less. Return only the list of themes as a JSON array of strings.'
          },
          {
            role: 'user',
            content: `Extract exactly 5 key themes from this text: "${text}"`
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('GPT API error during theme extraction:', errorData);
      throw new Error(`GPT API error: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    let result;
    
    try {
      const content = data.choices[0].message.content.trim();
      result = JSON.parse(content);
      
      // Extract the array if it's wrapped in another object
      if (result.themes && Array.isArray(result.themes)) {
        result = result.themes;
      }
      
      // If the result is not an array, make it one
      if (!Array.isArray(result)) {
        console.warn('Theme extraction result is not an array:', result);
        const themes = Object.values(result).filter(theme => typeof theme === 'string');
        
        // Ensure we have exactly 5 themes
        while (themes.length < 5) {
          themes.push(`Theme ${themes.length + 1}`);
        }
        
        return themes.slice(0, 5);
      }
      
      // Ensure we have exactly 5 themes
      const themes = [...result];
      while (themes.length < 5) {
        themes.push(`Theme ${themes.length + 1}`);
      }
      
      return themes.slice(0, 5);
    } catch (error) {
      console.error('Error parsing theme extraction result:', error, data.choices[0].message.content);
      return ["Theme 1", "Theme 2", "Theme 3", "Theme 4", "Theme 5"];
    }
  } catch (error) {
    console.error('Error in extractThemes:', error);
    return ["Error Processing", "Could Not Extract", "Technical Difficulty", "Try Again", "API Issue"];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.error('Invalid content type:', contentType);
      throw new Error('Request must be JSON format');
    }

    const requestBody = await req.text();
    if (!requestBody || requestBody.trim() === '') {
      console.error('Empty request body');
      throw new Error('Empty request body');
    }

    let payload;
    try {
      payload = JSON.parse(requestBody);
    } catch (error) {
      console.error('Error parsing JSON:', error, 'Body:', requestBody.slice(0, 100));
      throw new Error('Invalid JSON payload');
    }

    const { audio, userId } = payload;
    
    if (!audio) {
      console.error('No audio data provided in payload');
      throw new Error('No audio data provided');
    }

    console.log("Received audio data, processing...");
    console.log("User ID:", userId);
    console.log("Audio data length:", audio.length);
    
    const binaryAudio = processBase64Chunks(audio);
    console.log("Processed binary audio size:", binaryAudio.length);

    if (binaryAudio.length === 0) {
      throw new Error('Failed to process audio data - empty result');
    }
    
    const timestamp = Date.now();
    const filename = `journal-entry-${userId ? userId + '-' : ''}${timestamp}.webm`;
    
    let audioUrl = null;
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const journalBucket = buckets?.find(b => b.name === 'journal-audio-entries');
      
      if (!journalBucket) {
        console.log('Creating journal-audio-entries bucket');
        await supabase.storage.createBucket('journal-audio-entries', {
          public: true
        });
      }
      
      const { data: storageData, error: storageError } = await supabase
        .storage
        .from('journal-audio-entries')
        .upload(filename, binaryAudio, {
          contentType: 'audio/webm',
          cacheControl: '3600'
        });
        
      if (storageError) {
        console.error('Error uploading audio to storage:', storageError);
        console.error('Storage error details:', JSON.stringify(storageError));
      } else {
        const { data: urlData } = await supabase
          .storage
          .from('journal-audio-entries')
          .getPublicUrl(filename);
          
        audioUrl = urlData?.publicUrl;
        console.log("Audio stored successfully:", audioUrl);
      }
    } catch (err) {
      console.error("Storage error:", err);
    }
    
    console.log("Transcribing audio...");
    let transcriptionText;
    try {
      transcriptionText = await transcribeAudio(binaryAudio);
      console.log("Transcription complete:", transcriptionText.substring(0, 100) + "...");
    } catch (err) {
      console.error("Transcription error:", err);
      transcriptionText = "Error during transcription. Please try again.";
    }
    
    console.log("Refining and translating text...");
    let refinedText;
    try {
      refinedText = await refineText(transcriptionText);
      console.log("Text refinement complete:", refinedText.substring(0, 100) + "...");
    } catch (err) {
      console.error("Text refinement error:", err);
      refinedText = transcriptionText;
    }
    
    console.log("Analyzing emotions...");
    let emotionScores = {};
    try {
      emotionScores = await analyzeEmotions(refinedText);
      console.log("Emotion analysis complete:", emotionScores);
    } catch (err) {
      console.error("Emotion analysis error:", err);
      emotionScores = {};
    }
    
    console.log("Extracting themes...");
    let themes;
    try {
      themes = await extractThemes(refinedText);
      console.log("Theme extraction complete:", themes);
    } catch (err) {
      console.error("Theme extraction error:", err);
      themes = ["Theme 1", "Theme 2", "Theme 3", "Theme 4", "Theme 5"];
    }
    
    // Store entry with processed data
    const audioDuration = Math.floor(binaryAudio.length / 16000);
    let entryId = null;
    
    try {
      const { data: entryData, error: insertError } = await supabase
        .from('Journal Entries')
        .insert([{ 
          "transcription text": transcriptionText,
          "refined text": refinedText,
          "audio_url": audioUrl,
          "user_id": userId || null,
          "duration": audioDuration,
          "emotions": emotionScores, // Store emotion scores directly
          "master_themes": themes
        }])
        .select();
          
      if (insertError) {
        console.error('Error creating entry in database:', insertError);
        console.error('Error details:', JSON.stringify(insertError));
        throw new Error(`Database insert error: ${insertError.message}`);
      } else if (entryData && entryData.length > 0) {
        console.log("Journal entry saved to database:", entryData[0].id);
        entryId = entryData[0].id;
      } else {
        console.error("No data returned from insert operation");
        throw new Error("Failed to create journal entry in database");
      }
    } catch (dbErr) {
      console.error("Database error:", dbErr);
      throw new Error(`Database error: ${dbErr.message}`);
    }

    return new Response(
      JSON.stringify({
        transcription: transcriptionText,
        refinedText: refinedText,
        audioUrl: audioUrl,
        entryId: entryId,
        emotions: emotionScores,
        themes: themes,
        success: true
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error("Error in transcribe-audio function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        success: false,
        message: "Error occurred, but edge function is returning 200 to avoid CORS issues"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

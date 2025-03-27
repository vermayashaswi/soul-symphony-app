import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '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';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

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

async function generateEmbedding(text: string) {
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

async function analyzeEmotions(text: string) {
  try {
    console.log('Analyzing emotions for text:', text.slice(0, 100) + '...');
    
    // First, fetch all emotions from our database
    const { data: emotions, error: emotionsError } = await supabase
      .from('emotions')
      .select('name, description')
      .order('id', { ascending: true });
      
    if (emotionsError) {
      console.error('Error fetching emotions from database:', emotionsError);
      throw new Error('Failed to fetch emotions data');
    }
    
    // Create a prompt with all emotions
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

    if (!openAIApiKey) {
      console.error('OpenAI API key is missing or empty in environment variables');
      throw new Error('OpenAI API key is not configured. Please set the OPENAI_API_KEY secret in the Supabase dashboard.');
    }

    console.log("Received audio data, processing...");
    console.log("User ID:", userId);
    console.log("Audio data length:", audio.length);
    console.log("OpenAI API Key available:", !!openAIApiKey);
    
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
    
    const formData = new FormData();
    const blob = new Blob([binaryAudio], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'json');

    console.log("Sending to Whisper API for high-quality transcription using the latest model...");
    
    try {
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
      const transcribedText = whisperResult.text;
      
      console.log("Transcription successful:", transcribedText);

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
              content: 'You are a helpful assistant that translates multilingual text to English and improves its clarity and grammar without changing the meaning. Preserve the emotional tone and personal nature of the content.'
            },
            {
              role: 'user',
              content: `Here is a multilingual voice journal data of a user in their local language. Please translate it to English logically "${transcribedText}"`
            }
          ],
        }),
      });

      if (!gptResponse.ok) {
        const errorText = await gptResponse.text();
        console.error("GPT API error:", errorText);
        throw new Error(`GPT API error: ${errorText}`);
      }

      const gptResult = await gptResponse.json();
      const refinedText = gptResult.choices[0].message.content;
      
      console.log("Refinement successful:", refinedText);

      const emotions = await analyzeEmotions(refinedText);
      console.log("Emotion analysis:", emotions);

      const audioDuration = Math.floor(binaryAudio.length / 16000);

      let entryId = null;
      if (transcribedText) {
        try {
          const { data: entryData, error: insertError } = await supabase
            .from('Journal Entries')
            .insert([{ 
              "transcription text": transcribedText,
              "refined text": refinedText,
              "audio_url": audioUrl,
              "user_id": userId || null,
              "duration": audioDuration,
              "emotions": emotions
            }])
            .select();
              
          if (insertError) {
            console.error('Error creating entry in database:', insertError);
            console.error('Error details:', JSON.stringify(insertError));
            throw new Error(`Database insert error: ${insertError.message}`);
          } else if (entryData && entryData.length > 0) {
            console.log("Journal entry saved to database:", entryData[0].id);
            entryId = entryData[0].id;
            
            try {
              const embedding = await generateEmbedding(refinedText);
              
              const { error: embeddingError } = await supabase
                .from('journal_embeddings')
                .insert([{ 
                  journal_entry_id: entryId,
                  content: refinedText,
                  embedding: embedding
                }]);
                
              if (embeddingError) {
                console.error('Error storing embedding:', embeddingError);
                console.error('Embedding error details:', JSON.stringify(embeddingError));
              } else {
                console.log("Embedding stored successfully for entry:", entryId);
              }
            } catch (embErr) {
              console.error("Error generating embedding:", embErr);
            }
          } else {
            console.error("No data returned from insert operation");
            throw new Error("Failed to create journal entry in database");
          }
        } catch (dbErr) {
          console.error("Database error:", dbErr);
          throw new Error(`Database error: ${dbErr.message}`);
        }
      } else {
        throw new Error("Transcription failed - no text generated");
      }

      return new Response(
        JSON.stringify({
          transcription: transcribedText,
          refinedText: refinedText,
          audioUrl: audioUrl,
          entryId: entryId,
          emotions: emotions,
          success: true
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } catch (apiError) {
      console.error("API error:", apiError);
      
      return new Response(
        JSON.stringify({ 
          error: apiError.message, 
          success: false, 
          message: "API error occurred, but edge function is returning 200 to avoid CORS issues" 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
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

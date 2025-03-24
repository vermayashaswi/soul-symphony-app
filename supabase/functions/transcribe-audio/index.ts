
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Important: The OpenAI API key format has changed, need to use the correct project API key
const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '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';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process base64 in chunks to prevent memory issues
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

// Generate embeddings using OpenAI
async function generateEmbedding(text: string) {
  try {
    // Log that we're trying to generate an embedding
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

// Function to analyze emotions in text
async function analyzeEmotions(text: string) {
  try {
    console.log('Analyzing emotions for text:', text.slice(0, 100) + '...');
    
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
            content: 'You are an emotion analysis expert. Extract the emotions present in the text and assign intensity values from 0 to 1. Return ONLY a JSON object with emotion names as keys and intensity values as values. Include at least: joy, sadness, anger, fear, surprise, and any other relevant emotions.'
          },
          {
            role: 'user',
            content: `Analyze the emotions in this text: "${text}"`
          }
        ],
        temperature: 0.7,
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
      // Parse the JSON response
      const emotions = JSON.parse(emotionsText);
      return emotions;
    } catch (err) {
      console.error('Error parsing emotions JSON:', err);
      return null;
    }
  } catch (error) {
    console.error('Error in analyzeEmotions:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify content-type to ensure we're getting JSON data
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.error('Invalid content type:', contentType);
      throw new Error('Request must be JSON format');
    }

    // Parse the request body
    const requestBody = await req.text();
    if (!requestBody || requestBody.trim() === '') {
      console.error('Empty request body');
      throw new Error('Empty request body');
    }

    // Parse the JSON payload
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

    // Verify API keys are available
    if (!openAIApiKey) {
      console.error('OpenAI API key is missing or empty in environment variables');
      throw new Error('OpenAI API key is not configured. Please set the OPENAI_API_KEY secret in the Supabase dashboard.');
    }

    console.log("Received audio data, processing...");
    console.log("User ID:", userId);
    console.log("Audio data length:", audio.length);
    console.log("OpenAI API Key available:", !!openAIApiKey);
    console.log("OpenAI API Key starts with:", openAIApiKey.substring(0, 10));
    console.log("Supabase URL available:", !!supabaseUrl);
    console.log("Supabase Service Key available:", !!supabaseServiceKey);
    
    // Process audio in chunks
    const binaryAudio = processBase64Chunks(audio);
    console.log("Processed binary audio size:", binaryAudio.length);

    if (binaryAudio.length === 0) {
      throw new Error('Failed to process audio data - empty result');
    }
    
    // Save to storage
    const timestamp = Date.now();
    const filename = `journal-entry-${userId ? userId + '-' : ''}${timestamp}.webm`;
    
    // Upload to storage
    let audioUrl = null;
    try {
      // Ensure the storage bucket exists
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
        // Get the public URL for the audio
        const { data: urlData } = await supabase
          .storage
          .from('journal-audio-entries')
          .getPublicUrl(filename);
          
        audioUrl = urlData?.publicUrl;
        console.log("Audio stored successfully:", audioUrl);
      }
    } catch (err) {
      console.error("Storage error:", err);
      // Continue with transcription even if storage fails
    }
    
    // Prepare form data for Whisper API
    const formData = new FormData();
    const blob = new Blob([binaryAudio], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');

    console.log("Sending to Whisper API...");
    
    try {
      // Send to OpenAI Whisper API
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

      // Send to GPT for potential language translation and refinement
      console.log("Sending to GPT for refinement...");
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
              content: 'You are a helpful assistant that translates multilingual text to English and improves its clarity and grammar without changing the meaning.'
            },
            {
              role: 'user',
              content: `Translate this multilingual feedback to English and improve its clarity: "${transcribedText}"`
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

      // Analyze emotions in the refined text
      const emotions = await analyzeEmotions(refinedText);
      console.log("Emotion analysis:", emotions);

      // Calculate audio duration (in seconds)
      const audioDuration = Math.floor(binaryAudio.length / 16000); // Rough estimate based on typical audio bitrate

      // Store in database if we have valid transcription
      let entryId = null;
      if (transcribedText) {
        try {
          // Insert the journal entry
          console.log("Inserting journal entry with transcription:", transcribedText.substring(0, 50));
          console.log("Refined text:", refinedText.substring(0, 50));
          
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
            
            // Generate embedding for the refined text
            try {
              const embedding = await generateEmbedding(refinedText);
              
              // Store the embedding in the journal_embeddings table
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
                // Continue despite embedding error
              } else {
                console.log("Embedding stored successfully for entry:", entryId);
              }
            } catch (embErr) {
              console.error("Error generating embedding:", embErr);
              // Continue despite embedding error
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
      
      // Special handling for error responses to ensure we send a 200 status
      // This helps the frontend handle the error gracefully
      return new Response(
        JSON.stringify({ 
          error: apiError.message, 
          success: false, 
          message: "API error occurred, but edge function is returning 200 to avoid CORS issues" 
        }),
        {
          status: 200, // Return 200 even for errors to avoid CORS issues
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error("Error in transcribe-audio function:", error);
    
    // Return 200 status even for errors to avoid CORS issues in the frontend
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        success: false,
        message: "Error occurred, but edge function is returning 200 to avoid CORS issues"
      }),
      {
        status: 200, // Return 200 even for errors
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

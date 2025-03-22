
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';
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
}

// Generate embeddings using OpenAI
async function generateEmbedding(text: string) {
  try {
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audio, userId } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log("Received audio data, processing...");
    
    // Process audio in chunks
    const binaryAudio = processBase64Chunks(audio);
    
    // Save to storage
    const timestamp = Date.now();
    const filename = `journal-entry-${timestamp}.webm`;
    
    // Upload to storage
    let audioUrl = null;
    try {
      const { data: storageData, error: storageError } = await supabase
        .storage
        .from('journal-audio-entries')
        .upload(filename, binaryAudio);
        
      if (storageError) {
        console.error('Error uploading audio to storage:', storageError);
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

    // Store in database if we have valid transcription
    let entryId = null;
    if (transcribedText) {
      try {
        // Insert the journal entry
        const { data: entryData, error: insertError } = await supabase
          .from('Journal Entries')
          .insert([{ 
            "transcription text": transcribedText,
            "refined text": refinedText,
            "audio_url": audioUrl,
            "user_id": userId || null
          }])
          .select();
            
        if (insertError) {
          console.error('Error creating entry in database:', insertError);
        } else if (entryData && entryData.length > 0) {
          console.log("Journal entry saved to database:", entryData);
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
            } else {
              console.log("Embedding stored successfully for entry:", entryId);
            }
          } catch (embErr) {
            console.error("Error generating embedding:", embErr);
          }
        }
      } catch (dbErr) {
        console.error("Database error:", dbErr);
      }
    }

    return new Response(
      JSON.stringify({
        transcription: transcribedText,
        refinedText: refinedText,
        audioUrl: audioUrl,
        entryId: entryId,
        success: true
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error("Error in transcribe-audio function:", error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

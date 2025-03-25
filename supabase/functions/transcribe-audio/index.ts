
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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
    
    // Instead of transcribing with AI, we'll just store a placeholder message
    const placeholderText = "Audio transcription functionality has been removed temporarily.";
    
    // Store entry without OpenAI processing
    const audioDuration = Math.floor(binaryAudio.length / 16000);
    let entryId = null;
    
    try {
      const { data: entryData, error: insertError } = await supabase
        .from('Journal Entries')
        .insert([{ 
          "transcription text": placeholderText,
          "audio_url": audioUrl,
          "user_id": userId || null,
          "duration": audioDuration
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
        transcription: placeholderText,
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

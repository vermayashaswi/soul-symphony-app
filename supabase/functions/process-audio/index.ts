
// Follow Deno and Supabase Edge Function conventions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
    });
  }
  
  try {
    // Parse the request body
    const { audio, userId, tempId } = await req.json();
    
    if (!audio) {
      return new Response(
        JSON.stringify({ error: 'Audio data is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    if (!tempId) {
      return new Response(
        JSON.stringify({ error: 'Temporary ID is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Log the received data (without the full audio content for privacy)
    console.log(`Processing audio for user ${userId} with tempId ${tempId}`);
    console.log(`Audio data size: ${audio ? Math.round(audio.length / 1024) + "KB" : "0KB"}`);
    
    // Create a Supabase client with the project URL and service role key
    const supabaseAdminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    // Decode the base64 audio data to a binary buffer
    const binaryData = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    
    // Upload the audio to Supabase Storage
    const bucketName = "journal_audio";
    const filePath = `${userId}/${tempId}.wav`;
    
    const { data: uploadData, error: uploadError } = await supabaseAdminClient
      .storage
      .from(bucketName)
      .upload(filePath, binaryData, {
        contentType: 'audio/wav',
        upsert: true
      });
    
    if (uploadError) {
      console.error("Error uploading audio:", uploadError);
      return new Response(
        JSON.stringify({ error: `Upload error: ${uploadError.message}` }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Get the public URL for the uploaded audio
    const { data: publicUrlData } = supabaseAdminClient
      .storage
      .from(bucketName)
      .getPublicUrl(filePath);
    
    const publicUrl = publicUrlData?.publicUrl;
    
    // Create a new placeholder entry in the Journal Entries table
    const { data: entryData, error: entryError } = await supabaseAdminClient
      .from('Journal Entries')
      .insert([
        {
          user_id: userId,
          'foreign key': tempId,
          audio_url: publicUrl,
          'transcription text': 'Processing...',
        }
      ]);
    
    if (entryError) {
      console.error("Error creating journal entry:", entryError);
      return new Response(
        JSON.stringify({ error: `Database error: ${entryError.message}` }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Begin audio transcription in the background
    const transcriptionPromise = startTranscription(supabaseAdminClient, userId, tempId);
    
    // Use EdgeRuntime.waitUntil if available to run transcription in the background
    // This will allow us to return a response immediately while processing continues
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(transcriptionPromise);
    } else {
      // If EdgeRuntime is not available, we'll still start the process but won't wait for it
      console.log("EdgeRuntime.waitUntil not available, starting transcription without waiting");
    }
    
    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Audio processing started",
        tempId: tempId,
        audioUrl: publicUrl
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: `Unexpected error: ${error.message}` }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Function to start the transcription process
async function startTranscription(supabaseClient, userId, tempId) {
  try {
    console.log(`Starting transcription for entry with tempId ${tempId}`);
    
    // Call the transcribe-audio edge function
    const { data: transcriptionData, error: transcriptionError } = await supabaseClient.functions.invoke("transcribe-audio", {
      body: {
        userId: userId,
        entryId: tempId,
      }
    });
    
    if (transcriptionError) {
      console.error("Error calling transcribe-audio function:", transcriptionError);
      return;
    }
    
    console.log("Transcription process completed:", transcriptionData);
  } catch (error) {
    console.error("Error in transcription process:", error);
  }
}

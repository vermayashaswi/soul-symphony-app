
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.22.0";
import { Configuration, OpenAIApi } from "https://esm.sh/openai@3.2.1";

// Setup CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create a Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const openaiKey = Deno.env.get("OPENAI_API_KEY") || "";

    if (!supabaseUrl || !supabaseServiceRole || !openaiKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRole);

    // Check if this is a test request and respond appropriately
    try {
      const testRequest = await req.clone().json();
      if (testRequest && testRequest.test === true) {
        console.log("Received test request, responding with success");
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Transcription service is functioning normally" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    } catch (parseError) {
      // Not a JSON request or not a test request, continue with normal processing
      console.log("Not a test request, continuing with normal processing");
    }

    // Determine if this is a form data request or a JSON request
    let file: File | null = null;
    let userId: string | null = null;
    let audioBase64: string | null = null;

    // Check if the request body is form data
    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("multipart/form-data")) {
      try {
        console.log("Processing multipart form data request");
        const formData = await req.formData();
        file = formData.get("file") as File;
        userId = formData.get("userId") as string;
      } catch (formError) {
        console.error("Error parsing form data:", formError);
        throw new Error("Failed to parse form data");
      }
    } else {
      // Assume JSON request
      try {
        console.log("Processing JSON request");
        const { audio, userId: id } = await req.json();
        audioBase64 = audio;
        userId = id;
      } catch (jsonError) {
        console.error("Error parsing JSON data:", jsonError);
        throw new Error("Failed to parse JSON data");
      }
    }

    // Validate required data
    if ((!file && !audioBase64) || !userId) {
      throw new Error("Audio data and User ID are required");
    }

    // Convert base64 to file if needed
    if (audioBase64 && !file) {
      console.log("Converting base64 to file");
      const binaryString = atob(audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      file = new File([bytes.buffer], "audio.webm", { type: "audio/webm" });
    }

    if (!file) {
      throw new Error("Could not process audio data");
    }

    // Check file type
    const allowedFileTypes = ["audio/webm", "audio/ogg", "audio/mpeg", "audio/wav"];
    if (!allowedFileTypes.includes(file.type)) {
      throw new Error("Invalid file type. Only webm, ogg, mp3, and wav are allowed.");
    }
    
    // Try to upload the file to storage before transcription
    try {
      const folderPath = `${userId}/recordings`;
      const fileName = `recording-${Date.now()}.webm`;
      const filePath = `${folderPath}/${fileName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('journal-audio-entries')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: true
        });
        
      console.log("Uploaded audio file to storage:", uploadError ? "Failed" : "Success");
    } catch (uploadError) {
      console.log("Note: Could not upload to storage:", uploadError);
      // Continue with transcription even if storage fails
    }

    // Call the OpenAI transcription API
    console.log(`Transcribing audio file (${file.size} bytes) for user ${userId}`);
    const configuration = new Configuration({ apiKey: openaiKey });
    const openai = new OpenAIApi(configuration);

    try {
      console.log("Sending file to OpenAI for transcription");
      const transcriptionResponse = await openai.createTranscription(
        file,
        "whisper-1"
      );

      const transcription = transcriptionResponse.data.text;
      console.log("Received transcription from OpenAI");

      // Create a new journal entry in Supabase
      console.log("Creating journal entry in database");
      const { data: journalEntry, error: journalError } = await supabase
        .from("Journal Entries")
        .insert([
          {
            user_id: userId,
            "transcription text": transcription,
            "refined text": transcription, // Initialize refined text as the same as transcription
            created_at: new Date().toISOString(),
            audio_url: `${userId}/recordings/recording-${Date.now()}.webm` // Store the audio path reference
          }
        ])
        .select()
        .single();

      if (journalError) {
        console.error("Error creating journal entry:", journalError);
        throw new Error("Failed to create journal entry");
      }

      console.log(`Created journal entry with ID: ${journalEntry.id}`);

      // Immediately generate embedding for the new journal entry
      try {
        console.log("Generating embedding for the transcription");
        // Initialize OpenAI for embedding creation
        const embeddingResponse = await openai.createEmbedding({
          model: "text-embedding-ada-002",
          input: transcription.trim(),
        });

        if (!embeddingResponse.data || !embeddingResponse.data.data || embeddingResponse.data.data.length === 0) {
          throw new Error(`OpenAI API returned an invalid response for embedding creation`);
        }

        const [{ embedding }] = embeddingResponse.data.data;

        // Check if the journal_embeddings table exists
        try {
          const { data: tableExists, error: tableError } = await supabase
            .from('journal_embeddings')
            .select('id')
            .limit(1);
            
          // If table doesn't exist, attempt to create it
          if (tableError) {
            console.log("Embedding table might not exist, attempting to create it");
            
            await supabase.rpc('create_embeddings_table', {
              sql: `
                CREATE TABLE IF NOT EXISTS journal_embeddings (
                  id BIGSERIAL PRIMARY KEY,
                  journal_entry_id BIGINT NOT NULL,
                  content TEXT NOT NULL,
                  embedding VECTOR(1536),
                  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
              `
            });
          }
        } catch (tableErr) {
          console.error("Error checking/creating embedding table:", tableErr);
        }

        // Store the embedding in the database
        const { error: embeddingError } = await supabase
          .from('journal_embeddings')
          .insert({
            journal_entry_id: journalEntry.id,
            embedding,
            content: transcription
          });

        if (embeddingError) {
          console.error("Error storing embedding:", embeddingError);
        } else {
          console.log(`Successfully stored embedding for journal entry ${journalEntry.id}`);
        }
      } catch (embeddingError) {
        console.error("Error creating or storing embedding:", embeddingError);
      }

      return new Response(
        JSON.stringify({ 
          data: { 
            transcription, 
            entryId: journalEntry.id 
          }, 
          success: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } catch (openaiError) {
      console.error("OpenAI transcription error:", openaiError);
      throw new Error(`Transcription failed: ${openaiError.message || "OpenAI API error"}`);
    }
  } catch (error) {
    console.error("Error in transcribe-audio function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

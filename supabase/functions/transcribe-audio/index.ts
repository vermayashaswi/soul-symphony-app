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

    // Extract data from the request
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;

    if (!file) {
      throw new Error("File is required");
    }

    if (!userId) {
      throw new Error("User ID is required");
    }

    // Check file type
    const allowedFileTypes = ["audio/webm", "audio/ogg", "audio/mpeg", "audio/wav"];
    if (!allowedFileTypes.includes(file.type)) {
      throw new Error("Invalid file type. Only webm, ogg, mp3, and wav are allowed.");
    }

    // Convert audio file to base64
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64Audio = btoa(String.fromCharCode.apply(null, [...uint8Array]));

    // Call the OpenAI transcription API
    const configuration = new Configuration({ apiKey: openaiKey });
    const openai = new OpenAIApi(configuration);

    const transcriptionResponse = await openai.createTranscription(
      file,
      "whisper-1"
    );

    const transcription = transcriptionResponse.data.text;

    // Create a new journal entry in Supabase
    const { data: journalEntry, error: journalError } = await supabase
      .from("Journal Entries")
      .insert([
        {
          user_id: userId,
          audio_url: null, // You might want to store the audio file in storage and save the URL here
          "transcription text": transcription,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (journalError) {
      console.error("Error creating journal entry:", journalError);
      throw new Error("Failed to create journal entry");
    }

    // Immediately generate embedding for the new journal entry
    try {
      // Initialize OpenAI for embedding creation
      const embeddingResponse = await openai.createEmbedding({
        model: "text-embedding-ada-002",
        input: transcription.trim(),
      });

      if (!embeddingResponse.data || !embeddingResponse.data.data || embeddingResponse.data.data.length === 0) {
        throw new Error(`OpenAI API returned an invalid response for embedding creation`);
      }

      const [{ embedding }] = embeddingResponse.data.data;

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
        // Consider whether to throw an error or just log it.  The transcription succeeded,
        // so perhaps we should not fail the entire request due to embedding failure.
      } else {
        console.log(`Successfully stored embedding for journal entry ${journalEntry.id}`);
      }
    } catch (embeddingError) {
      console.error("Error creating or storing embedding:", embeddingError);
      // Handle embedding error appropriately
    }

    return new Response(
      JSON.stringify({ data: { transcription: transcription }, success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in transcribe-audio function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

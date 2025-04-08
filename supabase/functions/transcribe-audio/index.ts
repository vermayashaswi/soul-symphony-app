// This file contains the Supabase Edge Function for transcribing audio
// and saving it as a journal entry
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';
import { uuidv4 } from 'https://jspm.dev/uuid';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Environment variables
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Response handling helper
  const sendResponse = (status: number, data: any) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  };

  // If health check, return status quickly
  const url = new URL(req.url);
  const isHealthCheck = url.searchParams.get('health') === 'true' || 
                       (req.method === 'POST' && req.headers.get('x-health-check') === 'true');
  
  if (isHealthCheck) {
    try {
      // For a health check, just return a success status
      console.log("Received health check, returning status");
      return sendResponse(200, { status: 'ok', message: 'Transcribe audio function is alive' });
    } catch (error) {
      console.error("Health check error:", error);
      return sendResponse(500, { status: 'error', message: 'Health check failed', error: String(error) });
    }
  }

  // Parse the request body
  let body;
  try {
    body = await req.json();
  } catch (error) {
    console.error("Error parsing request body:", error);
    return sendResponse(400, { success: false, error: 'Invalid request body' });
  }

  // Extract parameters
  const { audio, userId, directTranscription = false } = body;

  if (!audio) {
    return sendResponse(400, { success: false, error: 'No audio data provided' });
  }

  if (!userId) {
    return sendResponse(400, { success: false, error: 'User ID is required' });
  }

  // Initialize Supabase client
  let supabase;
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }
    
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("Supabase client initialized with service role");
  } catch (error) {
    console.error("Error initializing Supabase client:", error);
    return sendResponse(500, { success: false, error: 'Internal server error: Supabase initialization failed' });
  }

  // Process audio and transcribe
  try {
    console.log(`Transcribing audio for user ${userId}. Direct transcription mode: ${directTranscription}`);
    
    // Convert base64 to binary
    let binaryAudio;
    try {
      binaryAudio = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    } catch (error) {
      console.error("Error converting base64 to binary:", error);
      return sendResponse(400, { success: false, error: 'Invalid base64 audio data' });
    }
    
    // Determine file type from the data
    let detectedFileType = 'webm';
    let mimeType = 'audio/webm';
    
    // Check for WAV header (RIFF....WAVE)
    if (binaryAudio.length > 12 &&
        binaryAudio[0] === 82 && binaryAudio[1] === 73 && 
        binaryAudio[2] === 70 && binaryAudio[3] === 70 &&
        binaryAudio[8] === 87 && binaryAudio[9] === 65 && 
        binaryAudio[10] === 86 && binaryAudio[11] === 69) {
      detectedFileType = 'wav';
      mimeType = 'audio/wav';
    } 
    // Check for MP3 header (ID3 or MPEG frame sync)
    else if (binaryAudio.length > 2 &&
            ((binaryAudio[0] === 73 && binaryAudio[1] === 68 && binaryAudio[2] === 51) || // "ID3"
             ((binaryAudio[0] === 0xFF) && ((binaryAudio[1] & 0xE0) === 0xE0)))) {
      detectedFileType = 'mp3';
      mimeType = 'audio/mp3';
    }
    // Check for M4A header (ftyp....)
    else if (binaryAudio.length > 11 &&
            binaryAudio[4] === 102 && binaryAudio[5] === 116 && 
            binaryAudio[6] === 121 && binaryAudio[7] === 112) {
      detectedFileType = 'm4a';
      mimeType = 'audio/m4a';
    }
    console.log(`Detected file type: ${detectedFileType}`);
    
    // Call OpenAI's Whisper API for transcription
    const formData = new FormData();
    const blob = new Blob([binaryAudio], { type: mimeType });
    formData.append('file', blob, `audio.${detectedFileType}`);
    
    // Use whisper-large-v2 model as requested
    formData.append('model', 'whisper-large-v2');
    formData.append('response_format', 'json');
    
    // Specify that we want high-fidelity transcription
    if (!directTranscription) {
      formData.append('language', 'en'); // Specify language to help with accuracy
    }

    console.log("Sending to Whisper API for high-quality transcription using whisper-large-v2 model...");
    console.log("Using file type:", detectedFileType, "with MIME type:", mimeType);
    
    try {
      // Check OpenAI key
      if (!openAIApiKey) {
        throw new Error("OpenAI API key is not configured");
      }
      
      const openAIResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAIApiKey}`,
        },
        body: formData,
      });
      
      if (!openAIResponse.ok) {
        const errorText = await openAIResponse.text();
        console.error(`OpenAI API error (${openAIResponse.status}):`, errorText);
        throw new Error(`OpenAI API error: ${errorText}`);
      }
      
      const transcriptionResult = await openAIResponse.json();
      const transcriptionText = transcriptionResult.text.trim();
      
      console.log(`Transcription successful. Text length: ${transcriptionText.length} characters`);
      console.log(`Sample text: "${transcriptionText.substring(0, 100)}${transcriptionText.length > 100 ? '...' : ''}"`);
      
      // If direct transcription is requested, return just the transcription
      if (directTranscription) {
        return sendResponse(200, {
          success: true,
          transcription: transcriptionText
        });
      }
      
      // Otherwise, save the transcription as a journal entry
      // First, check if the user profile exists
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();
        
      if (profileError) {
        console.log("Profile not found, attempting to create one");
        
        // Get basic user information
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
        
        if (userError) {
          console.error("Error getting user data:", userError);
          throw new Error("Failed to retrieve user data");
        }
        
        // Create profile
        const { error: insertProfileError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: userData.user?.email || null,
            full_name: userData.user?.user_metadata?.full_name || null,
            avatar_url: userData.user?.user_metadata?.avatar_url || null,
            onboarding_completed: false
          });
          
        if (insertProfileError) {
          console.error("Error creating profile:", insertProfileError);
          throw new Error("Failed to create user profile");
        }
        
        console.log("Created new profile for user:", userId);
      } else {
        console.log("Found existing profile for user:", userId);
      }
      
      // Calculate an approximate duration from audio size
      // This is a rough estimate: ~16KB per second for compressed audio
      const estimatedDuration = Math.round(binaryAudio.length / 16000);
      
      // Generate a unique foreign key for this entry
      const foreignKey = `journal-entry-${uuidv4()}`;
      
      // Insert the transcription into the database
      const { data: insertData, error: insertError } = await supabase
        .from('Journal Entries')
        .insert({
          user_id: userId,
          "transcription text": transcriptionText,
          sentiment: null, // Will be processed asynchronously
          duration: estimatedDuration,
          "foreign key": foreignKey
        })
        .select('id')
        .single();
        
      if (insertError) {
        console.error("Error inserting journal entry:", insertError);
        
        // Check if it's a permissions issue
        if (insertError.message.includes('permission denied')) {
          return sendResponse(403, { 
            success: false, 
            error: 'Permission denied when inserting journal entry. Check RLS policies.' 
          });
        }
        
        throw new Error(`Failed to save journal entry: ${insertError.message}`);
      }
      
      if (!insertData || !insertData.id) {
        throw new Error("Journal entry was not created properly");
      }
      
      console.log("Successfully created journal entry with ID:", insertData.id);
      
      // Trigger asynchronous processing for sentiment analysis and theme extraction
      // This happens in the background without blocking the response
      try {
        console.log("Triggering sentiment analysis for entry:", insertData.id);
        
        fetch(`${supabaseUrl}/functions/v1/analyze-sentiment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            entryId: insertData.id,
            text: transcriptionText
          })
        }).catch(error => {
          console.error("Error triggering sentiment analysis:", error);
        });
        
        console.log("Sentiment analysis function called successfully");
      } catch (processingError) {
        console.error("Error triggering background processing:", processingError);
        // Don't fail the entire request for background processing errors
      }
      
      // Return the result
      return sendResponse(200, {
        success: true,
        transcription: transcriptionText, 
        entryId: insertData.id,
        foreignKey: foreignKey
      });
      
    } catch (openAIError) {
      console.error("OpenAI API error:", openAIError);
      return sendResponse(500, { success: false, error: `Transcription failed: ${openAIError.message}` });
    }
  } catch (error) {
    console.error("Unexpected error during processing:", error);
    return sendResponse(500, { success: false, error: `Unexpected error: ${error.message}` });
  }
});

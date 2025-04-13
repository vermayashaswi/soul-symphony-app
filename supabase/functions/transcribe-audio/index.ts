
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCorsRequest, createErrorResponse, createSuccessResponse } from "../_shared/utils.ts";
import { processBase64Chunks, detectFileType } from "./audioProcessing.ts";
import { 
  generateEmbedding, 
  analyzeEmotions, 
  translateAudioWithWhisper,
  enhanceTranslatedText
} from "./aiProcessing.ts";
import { analyzeWithGoogleNL } from "./nlProcessing.ts";
import { 
  createSupabaseAdmin, 
  createProfileIfNeeded, 
  extractThemes, 
  storeJournalEntry,
  storeEmbedding,
  verifyJournalEntry
} from "./databaseOperations.ts";
import { storeAudioFile } from "./storageOperations.ts";

// Load environment variables
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
const GOOGLE_NL_API_KEY = Deno.env.get('GOOGLE_API') || '';

// Create Supabase client
const supabase = createSupabaseAdmin(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCorsRequest(req);
  if (corsResponse) return corsResponse;
  
  try {
    // Validate request content type
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.error('Invalid content type:', contentType);
      throw new Error('Request must be JSON format');
    }

    // Parse request body
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

    const { audio, userId, directTranscription, useTranslation } = payload;
    
    // Validate required fields
    if (!audio) {
      console.error('No audio data provided in payload');
      throw new Error('No audio data provided');
    }

    if (!openAIApiKey) {
      console.error('OpenAI API key is missing or empty in environment variables');
      throw new Error('OpenAI API key is not configured. Please set the OPENAI_API_KEY secret in the Supabase dashboard.');
    }

    // Log request details
    console.log("Received audio data, processing...");
    console.log("User ID:", userId);
    console.log("Direct transcription mode:", directTranscription ? "YES" : "NO");
    console.log("Using Whisper translation API:", useTranslation ? "YES" : "NO");
    
    // Ensure user profile exists
    if (userId) {
      await createProfileIfNeeded(supabase, userId);
    }
    
    // Process audio data
    console.log("Audio data length:", audio.length);
    console.log("OpenAI API Key available:", !!openAIApiKey);
    
    const binaryAudio = processBase64Chunks(audio);
    console.log("Processed binary audio size:", binaryAudio.length);

    if (binaryAudio.length === 0) {
      throw new Error('Failed to process audio data - empty result');
    }
    
    // Detect file type
    const detectedFileType = detectFileType(binaryAudio);
    console.log("Detected file type:", detectedFileType);
    
    // Generate filename and store audio file
    const timestamp = Date.now();
    const filename = `journal-entry-${userId ? userId + '-' : ''}${timestamp}.${detectedFileType}`;
    
    let audioUrl = null;
    try {
      audioUrl = await storeAudioFile(supabase, binaryAudio, filename, detectedFileType);
    } catch (err) {
      console.error("Storage error:", err);
    }
    
    // Prepare audio file for transcription
    let mimeType = 'audio/webm';
    if (detectedFileType === 'mp4') mimeType = 'audio/mp4';
    if (detectedFileType === 'wav') mimeType = 'audio/wav';
    
    const blob = new Blob([binaryAudio], { type: mimeType });
    
    try {
      // Directly translate audio using Whisper
      console.log("Using Whisper translation API for direct translation to English");
      const translatedText = await translateAudioWithWhisper(blob, detectedFileType, openAIApiKey);
      console.log("Translation successful:", translatedText);

      // If direct transcription mode, return just the transcription/translation
      if (directTranscription) {
        return createSuccessResponse({ transcription: translatedText });
      }

      // Since we're using Whisper's direct translation, we'll use the same text
      // for both transcription and refined text
      const refinedText = translatedText;

      // Get emotions from the translated text
      const { data: emotionsData, error: emotionsError } = await supabase
        .from('emotions')
        .select('name, description')
        .order('id', { ascending: true });
        
      if (emotionsError) {
        console.error('Error fetching emotions from database:', emotionsError);
        throw new Error('Failed to fetch emotions data');
      }
      
      // Analyze emotions in the translated text
      const emotions = await analyzeEmotions(refinedText, emotionsData, openAIApiKey);

      // Analyze sentiment and extract entities using Google NL API
      const { sentiment: sentimentScore, entities } = await analyzeWithGoogleNL(refinedText, GOOGLE_NL_API_KEY);

      // Calculate audio duration more accurately based on file type and bytes
      let audioDuration = 0;
      
      if (detectedFileType === 'webm') {
        // For WebM, use the recordingTime from the client if available, or estimate
        // WebM is compressed so bytes don't directly correlate to duration
        audioDuration = payload.recordingTime ? Math.floor(payload.recordingTime / 1000) : translatedText.length / 15;
      } else if (detectedFileType === 'wav') {
        // For WAV (assuming 48kHz, 16-bit, stereo)
        // 48000 samples/sec * 2 bytes/sample * 2 channels = 192000 bytes/sec
        audioDuration = Math.round(binaryAudio.length / 192000);
      } else {
        // Fallback estimation based on translation length
        // Average speaking rate is ~150 words per minute
        const wordCount = translatedText.split(/\s+/).length;
        audioDuration = Math.max(1, Math.round(wordCount / 2.5)); // ~150 words/min = 2.5 words/sec
      }
      
      console.log(`Calculated audio duration: ${audioDuration} seconds`);

      // Store journal entry in database - use the translated text for both fields
      // since we're getting direct translation from Whisper
      console.log("Storing journal entry with data:", {
        transcription_length: translatedText.length,
        refined_text_length: refinedText.length,
        audio_url: audioUrl ? "present" : "absent",
        user_id: userId ? "present" : "absent",
        emotions: emotions ? "present" : "absent",
        entities: entities ? `${entities.length} entities` : "absent",
      });
      
      const entryId = await storeJournalEntry(
        supabase,
        translatedText, // Use translated text as transcription 
        refinedText,    // Use the same translated text as refined text
        audioUrl,
        userId,
        audioDuration,
        emotions,
        sentimentScore,
        entities
      );

      if (entryId) {
        console.log("Journal entry stored successfully with ID:", entryId);
        
        // Extract themes for the entry
        if (refinedText) {
          try {
            // Use waitUntil to run in background but also log any errors
            const themePromise = extractThemes(supabase, refinedText, entryId);
            EdgeRuntime.waitUntil(
              themePromise.catch(err => {
                console.error("Background theme extraction failed:", err);
              })
            );
            console.log("Started background task to extract themes");
          } catch (themeErr) {
            console.error("Error starting theme extraction:", themeErr);
          }
        }
        
        // Call batch-extract-entities to ensure entities are extracted
        try {
          console.log("Starting entity extraction for entry:", entryId);
          const entityExtractionPromise = supabase.functions.invoke('batch-extract-entities', {
            body: {
              userId: userId,
              processAll: false,
              diagnosticMode: false
            }
          });
          
          EdgeRuntime.waitUntil(
            entityExtractionPromise.catch(err => {
              console.error("Background entity extraction failed:", err);
            })
          );
          console.log("Started background task for entity extraction");
        } catch (entityErr) {
          console.error("Error starting entity extraction:", entityErr);
        }
      
        // Generate and store embedding
        try {
          const embedding = await generateEmbedding(refinedText, openAIApiKey);
          await storeEmbedding(supabase, entryId, refinedText, embedding);
        } catch (embErr) {
          console.error("Error generating embedding:", embErr);
        }
      }

      // Verify journal entry was stored
      const verified = await verifyJournalEntry(supabase, entryId);
      console.log("Journal entry verification result:", verified);

      // Return success response
      return createSuccessResponse({
        transcription: translatedText,
        refinedText: refinedText,
        audioUrl: audioUrl,
        entryId: entryId,
        emotions: emotions,
        sentiment: sentimentScore,
        entities: entities
      });
    } catch (error) {
      console.error("Error in transcribe-audio function:", error);
      return createErrorResponse(error);
    }
  } catch (error) {
    console.error("Error in transcribe-audio function:", error);
    return createErrorResponse(error);
  }
});

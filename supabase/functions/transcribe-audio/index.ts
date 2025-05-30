import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCorsRequest, createErrorResponse, createSuccessResponse } from "../_shared/utils.ts";
import { processBase64Chunks, detectFileType, isValidAudioData } from "./audioProcessing.ts";
import { 
  generateEmbedding, 
  analyzeEmotions, 
  transcribeAudioWithWhisper,
  translateAndRefineText
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

// Create Supabase client - we'll initialize this inside the request handler to avoid top-level await
let supabase = null;

serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCorsRequest(req);
  if (corsResponse) return corsResponse;
  
  try {
    // Log environment variable availability (not the values themselves)
    console.log("Environment check:", {
      hasOpenAIKey: !!openAIApiKey,
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseServiceKey: !!supabaseServiceKey,
      hasGoogleNLApiKey: !!GOOGLE_NL_API_KEY
    });

    // Initialize Supabase client
    if (!supabase) {
      try {
        supabase = createSupabaseAdmin(supabaseUrl, supabaseServiceKey);
        console.log("Supabase client initialized successfully");
      } catch (initError) {
        console.error("Failed to initialize Supabase client:", initError);
        throw new Error(`Failed to initialize Supabase client: ${initError.message}`);
      }
    }

    // Validate request content type
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.error('Invalid content type:', contentType);
      throw new Error('Request must be JSON format');
    }

    // Parse request body with safety checks
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

    const { audio, userId, directTranscription, highQuality } = payload;
    
    // Validate required fields
    if (!audio) {
      console.error('No audio data provided in payload');
      throw new Error('No audio data provided');
    }
    
    // Additional validation for audio data
    if (typeof audio !== 'string' || audio.length < 50) {
      console.error('Audio data appears too short or invalid');
      throw new Error('Audio data appears too short or invalid');
    }

    if (!openAIApiKey) {
      console.error('OpenAI API key is missing or empty in environment variables');
      throw new Error('OpenAI API key is not configured. Please set the OPENAI_API_KEY secret in the Supabase dashboard.');
    }

    // Log request details
    console.log("Received audio data, processing...");
    console.log("User ID:", userId);
    console.log("Direct transcription mode:", directTranscription ? "YES" : "NO");
    console.log("High quality mode:", highQuality ? "YES" : "NO");
    console.log("Audio data length:", audio.length);
    console.log("Using model: gpt-4o-transcribe"); // Changed to requested model name
    
    // Process audio data in a try-catch block to handle any processing errors
    let binaryAudio;
    try {
      binaryAudio = processBase64Chunks(audio);
      console.log("Processed binary audio size:", binaryAudio.length);

      if (binaryAudio.length === 0) {
        throw new Error('Failed to process audio data - empty result');
      }
      
      // Validate audio data quality
      if (!isValidAudioData(binaryAudio)) {
        throw new Error('Audio data appears corrupted or invalid');
      }
    } catch (processingError) {
      console.error("Error processing audio data:", processingError);
      throw new Error(`Failed to process audio data: ${processingError.message}`);
    }
    
    // Ensure user profile exists
    if (userId) {
      try {
        await createProfileIfNeeded(supabase, userId);
      } catch (profileErr) {
        console.error("Error creating/checking user profile:", profileErr);
        // Don't throw here, just log the error and continue
      }
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
      // Continue even if storage fails
    }
    
    // Prepare audio file for transcription
    let mimeType = 'audio/webm';
    if (detectedFileType === 'mp4') mimeType = 'audio/mp4';
    if (detectedFileType === 'wav') mimeType = 'audio/wav';
    if (detectedFileType === 'ogg') mimeType = 'audio/ogg';
    
    const blob = new Blob([binaryAudio], { type: mimeType });
    console.log("Created blob for transcription:", {
      size: blob.size,
      type: blob.type,
      detectedFileType
    });
    
    try {
      // Transcribe audio with the requested model name
      console.log("Sending audio to OpenAI API for transcription");
      console.log("Using model: gpt-4o-transcribe"); // Changed to requested model name
      
      // Important: Use 'auto' for language detection
      const { text: transcribedText, detectedLanguages } = await transcribeAudioWithWhisper(
        blob, 
        detectedFileType, 
        openAIApiKey, 
        'auto'  // Use 'auto' for automatic language detection
      );
      
      console.log("Transcription successful:", transcribedText ? "yes" : "no");
      console.log("Detected languages:", detectedLanguages);
      
      if (!transcribedText) {
        throw new Error('Failed to get transcription from OpenAI API');
      }

      // If direct transcription mode, return just the transcription
      if (directTranscription) {
        return createSuccessResponse({ 
          transcription: transcribedText,
          detectedLanguages
        });
      }
      
      // Process with GPT for translation and refinement with detected languages
      console.log("Processing transcription with GPT for refinement...");
      const { refinedText } = await translateAndRefineText(transcribedText, openAIApiKey, detectedLanguages);

      // Get emotions from the refined text
      let emotions = null;
      try {
        const { data: emotionsData, error: emotionsError } = await supabase
          .from('emotions')
          .select('name, description')
          .order('id', { ascending: true });
          
        if (emotionsError) {
          console.error('Error fetching emotions from database:', emotionsError);
        } else {
          emotions = await analyzeEmotions(refinedText, emotionsData, openAIApiKey);
        }
      } catch (emotionsErr) {
        console.error("Error analyzing emotions:", emotionsErr);
      }

      // Analyze sentiment using Google NL API - wrap in try/catch
      let sentimentScore = "0";
      try {
        if (GOOGLE_NL_API_KEY) {
          const nlResults = await analyzeWithGoogleNL(refinedText, GOOGLE_NL_API_KEY);
          sentimentScore = nlResults.sentiment;
        } else {
          console.log("Skipping Google NL analysis - API key not provided");
        }
      } catch (nlErr) {
        console.error("Error in Google NL analysis:", nlErr);
      }

      // Calculate audio duration
      let audioDuration = 0;
      
      if (detectedFileType === 'webm') {
        // For WebM, use the recordingTime from the client if available, or estimate
        const estimatedDuration = payload.recordingTime ? Math.floor(payload.recordingTime / 1000) : 0;
        if (estimatedDuration > 300) { // 5 minutes
          throw new Error('Recording exceeds maximum duration of 5 minutes');
        }
        audioDuration = estimatedDuration;
      } else if (detectedFileType === 'wav') {
        // For WAV (assuming 48kHz, 16-bit, stereo)
        audioDuration = Math.round(binaryAudio.length / 192000);
      } else {
        // Fallback estimation based on transcription length
        const wordCount = transcribedText.split(/\s+/).length;
        audioDuration = Math.max(1, Math.round(wordCount / 2.5)); 
      }
      
      console.log(`Calculated audio duration: ${audioDuration} seconds`);

      // Store journal entry in database
      console.log("Storing journal entry...");
      let entryId = null;
      try {
        entryId = await storeJournalEntry(
          supabase,
          transcribedText,
          refinedText,
          audioUrl,
          userId,
          audioDuration,
          emotions,
          sentimentScore,
          null  // Removed entities parameter
        );
        
        console.log("Journal entry stored with ID:", entryId);
        
        // After successful store, verify the entry exists
        const { data: verifiedEntry, error: verificationError } = await supabase
          .from('Journal Entries')
          .select('id')
          .eq('id', entryId)
          .single();
          
        if (verificationError) {
          console.warn("Entry verification warning:", verificationError);
        } else {
          console.log("Entry verified in database:", verifiedEntry?.id);
        }
      } catch (dbErr) {
        console.error("Error storing journal entry:", dbErr);
        throw new Error(`Failed to store journal entry: ${dbErr.message}`);
      }

      // Start background tasks for post-processing
      if (entryId) {        
        try {
          // Extract themes and generate embedding in the background
          const themeExtractionPromise = extractThemes(supabase, refinedText, entryId)
            .catch(err => {
              console.error("Background theme extraction failed:", err);
            });
          
          const embeddingPromise = (async () => {
            try {
              const embedding = await generateEmbedding(refinedText, openAIApiKey);
              await storeEmbedding(supabase, entryId, refinedText, embedding);
            } catch (embErr) {
              console.error("Error generating embedding:", embErr);
            }
          })();
          
          // Trigger generate-themes edge function
          const generateThemesPromise = (async () => {
            try {
              console.log(`Triggering generate-themes for entry ID: ${entryId}`);
              const { error: themeError } = await supabase.functions.invoke('generate-themes', {
                body: { 
                  entryId,
                  fromEdit: false
                }
              });
              
              if (themeError) {
                console.error("Error triggering theme generation:", themeError);
              } else {
                console.log("Theme generation triggered successfully");
              }
            } catch (err) {
              console.error("Error in generate-themes trigger:", err);
            }
          })();
          
          // Run background tasks
          if (typeof EdgeRuntime !== 'undefined' && 'waitUntil' in EdgeRuntime) {
            EdgeRuntime.waitUntil(Promise.all([
              themeExtractionPromise,
              embeddingPromise,
              generateThemesPromise
            ]));
          } else {
            Promise.all([
              themeExtractionPromise,
              embeddingPromise,
              generateThemesPromise
            ]).catch(err => {
              console.error("Error in background tasks:", err);
            });
          }
        } catch (bgErr) {
          console.error("Error setting up background tasks:", bgErr);
        }
      }

      // Return success response
      return createSuccessResponse({
        transcription: transcribedText,
        refinedText: refinedText,
        audioUrl: audioUrl,
        entryId: entryId,
        emotions: emotions,
        sentiment: sentimentScore,
        detectedLanguages: detectedLanguages
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

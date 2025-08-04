
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { analyzeWithGoogleNL } from './nlProcessing.ts';
import { transcribeAudioWithWhisper, translateAndRefineText, analyzeEmotions, generateEmbedding } from './aiProcessing.ts';
import { createSupabaseAdmin, createProfileIfNeeded, extractThemes, storeJournalEntry, storeEmbedding } from './databaseOperations.ts';
import { storeAudioFile } from './storageOperations.ts';
import { processBase64Chunks, detectFileType, isValidAudioData } from './audioProcessing.ts';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-timezone, x-request-timestamp, x-client-version, x-audio-size',
};

/**
 * Enhanced environment validation
 */
function validateEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!Deno.env.get('OPENAI_API_KEY')) {
    errors.push('OPENAI_API_KEY not configured');
  }
  
  if (!Deno.env.get('SUPABASE_URL')) {
    errors.push('SUPABASE_URL not configured');
  }
  
  if (!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY not configured');
  }
  
  // Google NL API is optional but log if missing
  if (!Deno.env.get('GOOGLE_API')) {
    console.warn('FIXED: GOOGLE_API not configured - sentiment analysis will be skipped');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Enhanced request validation
 */
function validateRequest(requestData: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!requestData.audio && !requestData.audioData) {
    errors.push('No audio data provided');
  }
  
  if (!requestData.userId) {
    errors.push('User ID is required');
  } else if (typeof requestData.userId !== 'string' || requestData.userId.length < 10) {
    errors.push('Invalid user ID format');
  }
  
  const audioData = requestData.audio || requestData.audioData;
  if (audioData && (typeof audioData !== 'string' || audioData.length < 100)) {
    errors.push('Invalid audio data format or size');
  }
  
  if (requestData.recordingTime !== null && requestData.recordingTime !== undefined) {
    if (typeof requestData.recordingTime !== 'number' || requestData.recordingTime < 0) {
      errors.push('Invalid recording time format');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Enhanced memory monitoring
 */
function logMemoryUsage(stage: string) {
  try {
    const memUsage = Deno.memoryUsage();
    console.log(`FIXED [${stage}] Memory usage:`, {
      rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)}MB`,
      heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      external: `${(memUsage.external / 1024 / 1024).toFixed(2)}MB`
    });
  } catch (error) {
    console.warn(`FIXED: Could not get memory usage for ${stage}:`, error.message);
  }
}

/**
 * Enhanced garbage collection hint
 */
function requestGarbageCollection() {
  try {
    // Force garbage collection if available
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
      console.log('FIXED: Garbage collection requested');
    }
  } catch (error) {
    // Ignore GC errors
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let processingStage = 'initialization';
  let statusCode = 200;
  let errorMessage: string | undefined;
  
  try {
    console.log("=== FIXED TRANSCRIBE-AUDIO PIPELINE START ===");
    logMemoryUsage('pipeline-start');
    

    // Step 1: Enhanced environment validation
    console.log("FIXED: Validating environment configuration");
    const envValidation = validateEnvironment();
    
    if (!envValidation.valid) {
      console.error("FIXED: Environment validation failed:", envValidation.errors);
      statusCode = 500;
      errorMessage = `Configuration error: ${envValidation.errors.join(', ')}`;
      throw new Error(errorMessage);
    }
    
    console.log("FIXED: Environment validation passed");

    // Step 2: Enhanced Supabase client initialization with error handling
    processingStage = 'supabase-init';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    let supabaseAdmin;
    let supabaseClient;
    
    try {
      supabaseAdmin = createSupabaseAdmin(supabaseUrl, supabaseServiceKey);
      supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      });
      
      console.log("FIXED: Supabase clients initialized successfully");
    } catch (error) {
      console.error("FIXED: Failed to initialize Supabase clients:", error);
      throw new Error(`Database connection failed: ${error.message}`);
    }

    // Step 3: Enhanced request parsing with timeout
    processingStage = 'request-parsing';
    console.log("FIXED: Parsing request data");
    
    let requestData;
    try {
      requestData = await Promise.race([
        req.json(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Request parsing timeout')), 10000)
        )
      ]);
    } catch (error) {
      console.error("FIXED: Request parsing failed:", error);
      statusCode = 400;
      errorMessage = `Request parsing failed: ${error.message}`;
      throw new Error(errorMessage);
    }
    
    // Step 4: Enhanced request validation
    const requestValidation = validateRequest(requestData);
    if (!requestValidation.valid) {
      console.error("FIXED: Request validation failed:", requestValidation.errors);
      return new Response(JSON.stringify({
        error: `Invalid request: ${requestValidation.errors.join(', ')}`,
        timestamp: new Date().toISOString(),
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Extract validated parameters - this is the userId from the request data
    const { userId, highQuality = true, directTranscription = false, recordingTime = null } = requestData;
    const actualAudioData = requestData.audio || requestData.audioData;
    
    console.log("=== FIXED REQUEST PARAMETERS ===");
    console.log(`User ID: ${userId}`);
    console.log(`Direct transcription mode: ${directTranscription ? 'YES' : 'NO'}`);
    console.log(`High quality mode: ${highQuality ? 'YES' : 'NO'}`);
    console.log(`Audio data length: ${actualAudioData?.length || 0}`);
    console.log(`FIXED: Recording time received: ${recordingTime} (${typeof recordingTime})`);
    
    // Get enhanced request metadata
    const timezone = req.headers.get('x-timezone') || 'UTC';
    const requestTimestamp = req.headers.get('x-request-timestamp') || new Date().toISOString();
    const clientVersion = req.headers.get('x-client-version') || 'unknown';
    const audioSizeHeader = req.headers.get('x-audio-size');
    
    console.log(`FIXED: Request metadata - timezone: ${timezone}, version: ${clientVersion}, timestamp: ${requestTimestamp}`);
    
    logMemoryUsage('request-validated');

    // Step 5: Enhanced user profile management
    processingStage = 'profile-management';
    try {
      await createProfileIfNeeded(supabaseAdmin, userId, timezone);
      console.log("FIXED: User profile validated/created");
    } catch (error) {
      console.error("FIXED: Profile management failed:", error);
      // Don't fail the entire process for profile issues
      console.warn("FIXED: Continuing without profile validation");
    }

    // Step 6: Enhanced audio processing with memory management
    processingStage = 'audio-processing';
    console.log("=== FIXED AUDIO PROCESSING ===");
    logMemoryUsage('before-audio-processing');
    
    let bytes: Uint8Array;
    let detectedFileType: string;
    
    try {
      bytes = processBase64Chunks(actualAudioData);
      detectedFileType = detectFileType(bytes);
      
      console.log(`FIXED: Processed binary audio size: ${bytes.length} bytes`);
      console.log(`FIXED: Detected file type: ${detectedFileType}`);
      
      // Enhanced audio validation
      if (!isValidAudioData(bytes)) {
        throw new Error('Audio data validation failed - invalid format or content');
      }
      
      console.log("FIXED: Audio validation passed");
      
    } catch (error) {
      console.error("FIXED: Audio processing failed:", error);
      throw new Error(`Audio processing failed: ${error.message}`);
    }
    
    logMemoryUsage('after-audio-processing');

    // Step 7: Enhanced duration calculation with validation
    processingStage = 'duration-calculation';
    let durationSeconds: number;
    
    if (recordingTime !== null && recordingTime > 0) {
      // Validate recording time
      if (recordingTime > 7200000) { // 2 hours max
        console.warn(`FIXED: Recording time too long: ${recordingTime}ms, capping at 2 hours`);
        durationSeconds = 7200;
      } else {
        durationSeconds = Math.round(recordingTime / 1000);
      }
      console.log(`FIXED: Using provided recording duration: ${recordingTime}ms -> ${durationSeconds}s`);
    } else {
      // Enhanced fallback estimation
      const estimatedBitrate = 32000; // Conservative estimate
      durationSeconds = Math.max(1, Math.floor(bytes.length / estimatedBitrate));
      console.log(`FIXED: Estimated duration from audio size: ${durationSeconds}s`);
    }

    // Step 8: Enhanced audio file storage with error handling
    processingStage = 'file-storage';
    const timestamp = Date.now();
    const fileName = `journal-entry-${userId}-${timestamp}.${detectedFileType}`;
    
    let audioUrl: string | null = null;
    try {
      console.log(`FIXED: Storing audio file ${fileName} with size ${bytes.length} bytes`);
      audioUrl = await storeAudioFile(supabaseAdmin, bytes, fileName, detectedFileType);
      
      if (audioUrl) {
        console.log(`FIXED: File uploaded successfully: ${audioUrl}`);
      } else {
        console.warn('FIXED: File storage failed, continuing without URL');
      }
    } catch (storageError) {
      console.error('FIXED: Audio storage failed:', storageError);
      console.warn('FIXED: Continuing without audio URL');
    }
    
    logMemoryUsage('after-file-storage');

    // Step 9: FIXED - Transcription with no language detection
    processingStage = 'transcription';
    console.log('=== FIXED STEP 1: AUDIO TRANSCRIPTION (NO LANGUAGE DETECTION) ===');
    
    const audioBlob = new Blob([bytes], { type: `audio/${detectedFileType}` });
    console.log(`FIXED: Created blob for transcription: { size: ${audioBlob.size}, type: "${audioBlob.type}" }`);
    
    // Clear bytes array to free memory
    bytes = null as any;
    requestGarbageCollection();
    logMemoryUsage('before-transcription');
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
    
    let transcribedText: string;
    
    try {
      // FIXED: Only get transcribed text, no language detection
      const transcriptionResult = await transcribeAudioWithWhisper(
        audioBlob,
        detectedFileType,
        openaiApiKey,
        'auto'
      );
      
      transcribedText = transcriptionResult.text;
      
      if (!transcribedText || transcribedText.trim().length === 0) {
        throw new Error('Transcription returned empty result');
      }
      
      console.log(`FIXED: Transcription successful: ${transcribedText.length} characters`);
      console.log(`FIXED: Sample: "${transcribedText.slice(0, 100)}${transcribedText.length > 100 ? '...' : ''}"`);
      
    } catch (error) {
      console.error("FIXED: Transcription failed:", error);
      throw new Error(`Transcription failed: ${error.message}`);
    }
    
    logMemoryUsage('after-transcription');

    // Enhanced direct transcription mode response
    if (directTranscription) {
      console.log('FIXED: Direct transcription mode, returning result');
      return new Response(JSON.stringify({
        transcription: transcribedText,
        language: 'unknown', // FIXED: No language detection in transcription
        languages: [], // FIXED: Empty array for consistency
        duration: durationSeconds,
        success: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 10: FIXED - Text refinement with language detection
    processingStage = 'text-refinement';
    console.log('=== FIXED STEP 2: TEXT REFINEMENT WITH LANGUAGE DETECTION ===');
    logMemoryUsage('before-refinement');
    
    let refinedText: string;
    let detectedLanguages: string[];
    
    try {
      // FIXED: Language detection happens here now
      const refinementResult = await translateAndRefineText(
        transcribedText, 
        openaiApiKey
      );
      
      refinedText = refinementResult.refinedText;
      detectedLanguages = refinementResult.detectedLanguages;
      
      console.log('FIXED: Text refinement completed with language detection');
      console.log(`FIXED: Original length: ${transcribedText.length}, Refined length: ${refinedText.length}`);
      console.log(`FIXED: Detected languages: ${JSON.stringify(detectedLanguages)}`);
      
    } catch (error) {
      console.error("FIXED: Text refinement failed:", error);
      // Use original text as fallback
      refinedText = transcribedText;
      detectedLanguages = ['en']; // Default fallback
      console.warn("FIXED: Using original text as fallback with default language");
    }
    
    logMemoryUsage('after-refinement');

    // Step 11: Enhanced sentiment analysis with error handling
    processingStage = 'sentiment-analysis';
    console.log('=== FIXED STEP 3: SENTIMENT ANALYSIS ===');
    
    let sentimentResult = { sentiment: "0" };
    const googleNLApiKey = Deno.env.get('GOOGLE_API');
    
    if (googleNLApiKey) {
      try {
        sentimentResult = await analyzeWithGoogleNL(refinedText, googleNLApiKey);
        console.log(`FIXED: Sentiment analysis result: ${sentimentResult.sentiment}`);
      } catch (sentimentError) {
        console.error('FIXED: Sentiment analysis failed:', sentimentError);
        console.log('FIXED: Using default sentiment value of 0');
      }
    } else {
      console.log('FIXED: Google NL API key not found, skipping sentiment analysis');
    }

    // Step 12: Enhanced emotion analysis
    processingStage = 'emotion-analysis';
    console.log('=== FIXED STEP 4: EMOTION ANALYSIS ===');
    
    let emotions = {};
    
    try {
      const { data: emotionsData, error: emotionsError } = await supabaseAdmin
        .from('emotions')
        .select('name, description');

      if (!emotionsError && emotionsData && emotionsData.length > 0) {
        try {
          emotions = await analyzeEmotions(refinedText, emotionsData, openaiApiKey);
          console.log('FIXED: Emotion analysis completed:', emotions);
        } catch (emotionError) {
          console.error('FIXED: Emotion analysis failed:', emotionError);
        }
      } else {
        console.warn('FIXED: No emotions data found, skipping emotion analysis');
      }
    } catch (error) {
      console.error('FIXED: Emotions database query failed:', error);
    }
    
    logMemoryUsage('after-emotion-analysis');

    // Step 13: FIXED - Database storage with proper language handling
    processingStage = 'database-storage';
    console.log('=== FIXED STEP 5: DATABASE STORAGE ===');
    
    let entryId: number;
    
    try {
      entryId = await storeJournalEntry(
        supabaseAdmin,
        transcribedText,
        refinedText,
        audioUrl,
        userId,
        durationSeconds,
        emotions,
        sentimentResult.sentiment
      );
      
      console.log(`FIXED: Journal entry stored successfully with ID: ${entryId}`);
      
      // FIXED: Enhanced language and duration update
      try {
        const { error: languageUpdateError } = await supabaseAdmin
          .from('Journal Entries')
          .update({ 
            languages: detectedLanguages, // FIXED: Use languages from refinement step
            duration: durationSeconds
          })
          .eq('id', entryId);

        if (languageUpdateError) {
          console.error('FIXED: Error updating languages and duration:', languageUpdateError);
        } else {
          console.log(`FIXED: Metadata updated: languages=${JSON.stringify(detectedLanguages)}, duration=${durationSeconds}s`);
        }
      } catch (updateError) {
        console.error('FIXED: Language update failed:', updateError);
      }
      
    } catch (error) {
      console.error("FIXED: Database storage failed:", error);
      throw new Error(`Database storage failed: ${error.message}`);
    }
    
    logMemoryUsage('after-database-storage');

    // Step 14: FIXED - Background processing with entity extraction in sentiment analysis
    processingStage = 'background-processing';
    console.log('=== FIXED BACKGROUND PROCESSING ===');
    
    // Theme extraction (entities will be populated here too)
    try {
      await extractThemes(supabaseAdmin, refinedText, entryId);
      console.log('FIXED: Theme extraction initiated (includes entity extraction)');
    } catch (error) {
      console.error('FIXED: Theme extraction failed:', error);
    }

    // Embedding generation
    try {
      const embedding = await generateEmbedding(refinedText, openaiApiKey);
      await storeEmbedding(supabaseAdmin, entryId, refinedText, embedding);
      console.log('FIXED: Embeddings generated and stored');
    } catch (embeddingError) {
      console.error('FIXED: Embedding generation failed:', embeddingError);
    }
    
    // Final memory cleanup
    requestGarbageCollection();
    logMemoryUsage('pipeline-complete');

    // Step 15: FIXED - Success response with proper language data
    const totalTime = Date.now() - startTime;
    console.log('=== FIXED PIPELINE COMPLETE ===');
    console.log(`FIXED: Total processing time: ${totalTime}ms`);
    
    return new Response(JSON.stringify({
      id: entryId,
      entryId: entryId,
      transcription: transcribedText,
      refined: refinedText,
      emotions: emotions,
      sentiment: sentimentResult.sentiment,
      language: detectedLanguages[0] || 'en', // FIXED: Use language from refinement step
      languages: detectedLanguages, // FIXED: Use languages from refinement step
      duration: durationSeconds,
      audioUrl: audioUrl,
      processingTimestamp: requestTimestamp,
      processingTime: totalTime,
      success: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('=== FIXED PIPELINE ERROR ===');
    console.error(`FIXED: Error in ${processingStage}:`, error);
    console.error(`FIXED: Processing failed after: ${totalTime}ms`);
    
    if (!statusCode || statusCode === 200) {
      statusCode = 500;
    }
    if (!errorMessage) {
      errorMessage = error.message;
    }


    logMemoryUsage('error-state');
    
    // Enhanced error classification
    if (error.message.includes('timeout')) {
      statusCode = 408;
    } else if (error.message.includes('validation')) {
      statusCode = 400;
    } else if (error.message.includes('authentication') || error.message.includes('authorization')) {
      statusCode = 401;
    } else if (error.message.includes('size') || error.message.includes('large')) {
      statusCode = 413;
    }
    
    return new Response(JSON.stringify({
      error: error.message,
      errorType: statusCode === 408 ? 'timeout' : statusCode === 400 ? 'validation_error' : 'internal_error',
      stage: processingStage,
      processingTime: totalTime,
      timestamp: new Date().toISOString(),
      success: false
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

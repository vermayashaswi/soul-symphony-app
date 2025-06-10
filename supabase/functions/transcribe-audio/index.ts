
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
    console.warn('ENHANCED: GOOGLE_API not configured - sentiment analysis will be skipped');
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
    console.log(`ENHANCED [${stage}] Memory usage:`, {
      rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)}MB`,
      heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      external: `${(memUsage.external / 1024 / 1024).toFixed(2)}MB`
    });
  } catch (error) {
    console.warn(`ENHANCED: Could not get memory usage for ${stage}:`, error.message);
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
      console.log('ENHANCED: Garbage collection requested');
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
  
  try {
    console.log("=== ENHANCED TRANSCRIBE-AUDIO PIPELINE START ===");
    logMemoryUsage('pipeline-start');
    
    // Step 1: Enhanced environment validation
    console.log("ENHANCED: Validating environment configuration");
    const envValidation = validateEnvironment();
    
    if (!envValidation.valid) {
      console.error("ENHANCED: Environment validation failed:", envValidation.errors);
      return new Response(JSON.stringify({
        error: `Configuration error: ${envValidation.errors.join(', ')}`,
        timestamp: new Date().toISOString(),
        success: false
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log("ENHANCED: Environment validation passed");

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
      
      console.log("ENHANCED: Supabase clients initialized successfully");
    } catch (error) {
      console.error("ENHANCED: Failed to initialize Supabase clients:", error);
      throw new Error(`Database connection failed: ${error.message}`);
    }

    // Step 3: Enhanced request parsing with timeout
    processingStage = 'request-parsing';
    console.log("ENHANCED: Parsing request data");
    
    let requestData;
    try {
      requestData = await Promise.race([
        req.json(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Request parsing timeout')), 10000)
        )
      ]);
    } catch (error) {
      console.error("ENHANCED: Request parsing failed:", error);
      throw new Error(`Request parsing failed: ${error.message}`);
    }
    
    // Step 4: Enhanced request validation
    const requestValidation = validateRequest(requestData);
    if (!requestValidation.valid) {
      console.error("ENHANCED: Request validation failed:", requestValidation.errors);
      return new Response(JSON.stringify({
        error: `Invalid request: ${requestValidation.errors.join(', ')}`,
        timestamp: new Date().toISOString(),
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Extract validated parameters
    const { userId, highQuality = true, directTranscription = false, recordingTime = null } = requestData;
    const actualAudioData = requestData.audio || requestData.audioData;
    
    console.log("=== ENHANCED REQUEST PARAMETERS ===");
    console.log(`User ID: ${userId}`);
    console.log(`Direct transcription mode: ${directTranscription ? 'YES' : 'NO'}`);
    console.log(`High quality mode: ${highQuality ? 'YES' : 'NO'}`);
    console.log(`Audio data length: ${actualAudioData?.length || 0}`);
    console.log(`ENHANCED: Recording time received: ${recordingTime} (${typeof recordingTime})`);
    
    // Get enhanced request metadata
    const timezone = req.headers.get('x-timezone') || 'UTC';
    const requestTimestamp = req.headers.get('x-request-timestamp') || new Date().toISOString();
    const clientVersion = req.headers.get('x-client-version') || 'unknown';
    const audioSizeHeader = req.headers.get('x-audio-size');
    
    console.log(`ENHANCED: Request metadata - timezone: ${timezone}, version: ${clientVersion}, timestamp: ${requestTimestamp}`);
    
    logMemoryUsage('request-validated');

    // Step 5: Enhanced user profile management
    processingStage = 'profile-management';
    try {
      await createProfileIfNeeded(supabaseAdmin, userId, timezone);
      console.log("ENHANCED: User profile validated/created");
    } catch (error) {
      console.error("ENHANCED: Profile management failed:", error);
      // Don't fail the entire process for profile issues
      console.warn("ENHANCED: Continuing without profile validation");
    }

    // Step 6: Enhanced audio processing with memory management
    processingStage = 'audio-processing';
    console.log("=== ENHANCED AUDIO PROCESSING ===");
    logMemoryUsage('before-audio-processing');
    
    let bytes: Uint8Array;
    let detectedFileType: string;
    
    try {
      bytes = processBase64Chunks(actualAudioData);
      detectedFileType = detectFileType(bytes);
      
      console.log(`ENHANCED: Processed binary audio size: ${bytes.length} bytes`);
      console.log(`ENHANCED: Detected file type: ${detectedFileType}`);
      
      // Enhanced audio validation
      if (!isValidAudioData(bytes)) {
        throw new Error('Audio data validation failed - invalid format or content');
      }
      
      console.log("ENHANCED: Audio validation passed");
      
    } catch (error) {
      console.error("ENHANCED: Audio processing failed:", error);
      throw new Error(`Audio processing failed: ${error.message}`);
    }
    
    logMemoryUsage('after-audio-processing');

    // Step 7: Enhanced duration calculation with validation
    processingStage = 'duration-calculation';
    let durationSeconds: number;
    
    if (recordingTime !== null && recordingTime > 0) {
      // Validate recording time
      if (recordingTime > 7200000) { // 2 hours max
        console.warn(`ENHANCED: Recording time too long: ${recordingTime}ms, capping at 2 hours`);
        durationSeconds = 7200;
      } else {
        durationSeconds = Math.round(recordingTime / 1000);
      }
      console.log(`ENHANCED: Using provided recording duration: ${recordingTime}ms -> ${durationSeconds}s`);
    } else {
      // Enhanced fallback estimation
      const estimatedBitrate = 32000; // Conservative estimate
      durationSeconds = Math.max(1, Math.floor(bytes.length / estimatedBitrate));
      console.log(`ENHANCED: Estimated duration from audio size: ${durationSeconds}s`);
    }

    // Step 8: Enhanced audio file storage with error handling
    processingStage = 'file-storage';
    const timestamp = Date.now();
    const fileName = `journal-entry-${userId}-${timestamp}.${detectedFileType}`;
    
    let audioUrl: string | null = null;
    try {
      console.log(`ENHANCED: Storing audio file ${fileName} with size ${bytes.length} bytes`);
      audioUrl = await storeAudioFile(supabaseAdmin, bytes, fileName, detectedFileType);
      
      if (audioUrl) {
        console.log(`ENHANCED: File uploaded successfully: ${audioUrl}`);
      } else {
        console.warn('ENHANCED: File storage failed, continuing without URL');
      }
    } catch (storageError) {
      console.error('ENHANCED: Audio storage failed:', storageError);
      console.warn('ENHANCED: Continuing without audio URL');
    }
    
    logMemoryUsage('after-file-storage');

    // Step 9: Enhanced transcription with memory cleanup
    processingStage = 'transcription';
    console.log('=== ENHANCED STEP 1: AUDIO TRANSCRIPTION ===');
    
    const audioBlob = new Blob([bytes], { type: `audio/${detectedFileType}` });
    console.log(`ENHANCED: Created blob for transcription: { size: ${audioBlob.size}, type: "${audioBlob.type}" }`);
    
    // Clear bytes array to free memory
    bytes = null as any;
    requestGarbageCollection();
    logMemoryUsage('before-transcription');
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
    
    let transcribedText: string;
    let detectedLanguages: string[];
    
    try {
      const transcriptionResult = await transcribeAudioWithWhisper(
        audioBlob,
        detectedFileType,
        openaiApiKey,
        'auto'
      );
      
      transcribedText = transcriptionResult.text;
      detectedLanguages = transcriptionResult.detectedLanguages;
      
      if (!transcribedText || transcribedText.trim().length === 0) {
        throw new Error('Transcription returned empty result');
      }
      
      console.log(`ENHANCED: Transcription successful: ${transcribedText.length} characters`);
      console.log(`ENHANCED: Sample: "${transcribedText.slice(0, 100)}${transcribedText.length > 100 ? '...' : ''}"`);
      console.log(`ENHANCED: Detected languages: ${JSON.stringify(detectedLanguages)}`);
      
    } catch (error) {
      console.error("ENHANCED: Transcription failed:", error);
      throw new Error(`Transcription failed: ${error.message}`);
    }
    
    logMemoryUsage('after-transcription');

    // Enhanced direct transcription mode response
    if (directTranscription) {
      console.log('ENHANCED: Direct transcription mode, returning result');
      return new Response(JSON.stringify({
        transcription: transcribedText,
        language: detectedLanguages[0] || 'unknown',
        languages: detectedLanguages,
        duration: durationSeconds,
        success: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 10: Enhanced text refinement
    processingStage = 'text-refinement';
    console.log('=== ENHANCED STEP 2: TEXT REFINEMENT ===');
    logMemoryUsage('before-refinement');
    
    let refinedText: string;
    let preservedLanguages: string[];
    
    try {
      const refinementResult = await translateAndRefineText(
        transcribedText, 
        openaiApiKey, 
        detectedLanguages
      );
      
      refinedText = refinementResult.refinedText;
      preservedLanguages = refinementResult.preservedLanguages;
      
      console.log('ENHANCED: Text refinement completed');
      console.log(`ENHANCED: Original length: ${transcribedText.length}, Refined length: ${refinedText.length}`);
      console.log(`ENHANCED: Preserved languages: ${JSON.stringify(preservedLanguages)}`);
      
    } catch (error) {
      console.error("ENHANCED: Text refinement failed:", error);
      // Use original text as fallback
      refinedText = transcribedText;
      preservedLanguages = detectedLanguages;
      console.warn("ENHANCED: Using original text as fallback");
    }
    
    const finalLanguages = preservedLanguages && preservedLanguages.length > 0 ? preservedLanguages : detectedLanguages;
    logMemoryUsage('after-refinement');

    // Step 11: Enhanced sentiment analysis with error handling
    processingStage = 'sentiment-analysis';
    console.log('=== ENHANCED STEP 3: SENTIMENT ANALYSIS ===');
    
    let sentimentResult = { sentiment: "0" };
    const googleNLApiKey = Deno.env.get('GOOGLE_API');
    
    if (googleNLApiKey) {
      try {
        sentimentResult = await analyzeWithGoogleNL(refinedText, googleNLApiKey);
        console.log(`ENHANCED: Sentiment analysis result: ${sentimentResult.sentiment}`);
      } catch (sentimentError) {
        console.error('ENHANCED: Sentiment analysis failed:', sentimentError);
        console.log('ENHANCED: Using default sentiment value of 0');
      }
    } else {
      console.log('ENHANCED: Google NL API key not found, skipping sentiment analysis');
    }

    // Step 12: Enhanced emotion analysis
    processingStage = 'emotion-analysis';
    console.log('=== ENHANCED STEP 4: EMOTION ANALYSIS ===');
    
    let emotions = {};
    
    try {
      const { data: emotionsData, error: emotionsError } = await supabaseAdmin
        .from('emotions')
        .select('name, description');

      if (!emotionsError && emotionsData && emotionsData.length > 0) {
        try {
          emotions = await analyzeEmotions(refinedText, emotionsData, openaiApiKey);
          console.log('ENHANCED: Emotion analysis completed:', emotions);
        } catch (emotionError) {
          console.error('ENHANCED: Emotion analysis failed:', emotionError);
        }
      } else {
        console.warn('ENHANCED: No emotions data found, skipping emotion analysis');
      }
    } catch (error) {
      console.error('ENHANCED: Emotions database query failed:', error);
    }
    
    logMemoryUsage('after-emotion-analysis');

    // Step 13: Enhanced database storage with transaction-like behavior
    processingStage = 'database-storage';
    console.log('=== ENHANCED STEP 5: DATABASE STORAGE ===');
    
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
      
      console.log(`ENHANCED: Journal entry stored successfully with ID: ${entryId}`);
      
      // Enhanced language metadata update with error handling
      try {
        const { error: languageUpdateError } = await supabaseAdmin
          .from('Journal Entries')
          .update({ 
            languages: finalLanguages,
            duration: durationSeconds
          })
          .eq('id', entryId);

        if (languageUpdateError) {
          console.error('ENHANCED: Error updating languages and duration:', languageUpdateError);
        } else {
          console.log(`ENHANCED: Metadata updated: languages=${JSON.stringify(finalLanguages)}, duration=${durationSeconds}s`);
        }
      } catch (updateError) {
        console.error('ENHANCED: Language update failed:', updateError);
      }
      
    } catch (error) {
      console.error("ENHANCED: Database storage failed:", error);
      throw new Error(`Database storage failed: ${error.message}`);
    }
    
    logMemoryUsage('after-database-storage');

    // Step 14: Enhanced background processing with error isolation
    processingStage = 'background-processing';
    console.log('=== ENHANCED BACKGROUND PROCESSING ===');
    
    // Theme extraction
    try {
      await extractThemes(supabaseAdmin, refinedText, entryId);
      console.log('ENHANCED: Theme extraction initiated');
    } catch (error) {
      console.error('ENHANCED: Theme extraction failed:', error);
    }

    // Embedding generation
    try {
      const embedding = await generateEmbedding(refinedText, openaiApiKey);
      await storeEmbedding(supabaseAdmin, entryId, refinedText, embedding);
      console.log('ENHANCED: Embeddings generated and stored');
    } catch (embeddingError) {
      console.error('ENHANCED: Embedding generation failed:', embeddingError);
    }
    
    // Final memory cleanup
    requestGarbageCollection();
    logMemoryUsage('pipeline-complete');

    // Step 15: Enhanced success response
    const totalTime = Date.now() - startTime;
    console.log('=== ENHANCED PIPELINE COMPLETE ===');
    console.log(`ENHANCED: Total processing time: ${totalTime}ms`);
    
    return new Response(JSON.stringify({
      id: entryId,
      entryId: entryId,
      transcription: transcribedText,
      refined: refinedText,
      emotions: emotions,
      sentiment: sentimentResult.sentiment,
      language: finalLanguages[0] || 'unknown',
      languages: finalLanguages,
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
    console.error('=== ENHANCED PIPELINE ERROR ===');
    console.error(`ENHANCED: Error in ${processingStage}:`, error);
    console.error(`ENHANCED: Processing failed after: ${totalTime}ms`);
    
    logMemoryUsage('error-state');
    
    // Enhanced error classification
    let statusCode = 500;
    let errorType = 'internal_error';
    
    if (error.message.includes('timeout')) {
      statusCode = 408;
      errorType = 'timeout';
    } else if (error.message.includes('validation')) {
      statusCode = 400;
      errorType = 'validation_error';
    } else if (error.message.includes('authentication') || error.message.includes('authorization')) {
      statusCode = 401;
      errorType = 'auth_error';
    } else if (error.message.includes('size') || error.message.includes('large')) {
      statusCode = 413;
      errorType = 'payload_too_large';
    }
    
    return new Response(JSON.stringify({
      error: error.message,
      errorType,
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

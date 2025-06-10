
import { supabase } from '@/integrations/supabase/client';
import { blobToBase64 } from '@/utils/audio/blob-utils';

interface TranscriptionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Enhanced environment validation
 */
function validateEnvironment(): { valid: boolean; error?: string } {
  // Check if we have a valid Supabase client
  if (!supabase) {
    return { valid: false, error: 'Supabase client not initialized' };
  }

  // Check if we can access Supabase through a simple test
  try {
    // Test if the client is properly configured by checking if we can call a method
    // This is safer than accessing protected properties
    if (typeof supabase.auth.getUser !== 'function') {
      return { valid: false, error: 'Supabase client not properly configured' };
    }
  } catch (error) {
    return { valid: false, error: 'Supabase configuration error' };
  }

  return { valid: true };
}

/**
 * Enhanced audio data validation
 */
function validateAudioData(base64Audio: string): { valid: boolean; error?: string } {
  if (!base64Audio || typeof base64Audio !== 'string') {
    return { valid: false, error: 'Audio data must be a non-empty string' };
  }

  if (base64Audio.length < 50) {
    return { valid: false, error: 'Audio data too short to be valid' };
  }

  // Check for valid base64 pattern (basic validation)
  const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
  let testData = base64Audio;
  
  // Remove data URL prefix if present
  if (testData.includes(',')) {
    testData = testData.split(',')[1];
  }
  
  // Test a small portion for base64 validity
  const testChunk = testData.substring(0, Math.min(100, testData.length));
  if (!base64Pattern.test(testChunk)) {
    return { valid: false, error: 'Audio data is not valid base64 format' };
  }

  return { valid: true };
}

/**
 * Enhanced request preparation with validation
 */
function prepareTranscriptionRequest(
  base64Audio: string,
  userId: string,
  directTranscription: boolean,
  processSentiment: boolean,
  recordingDuration?: number
) {
  // Validate and clean base64 data
  let cleanAudio = base64Audio;
  if (cleanAudio.includes(',')) {
    cleanAudio = cleanAudio.split(',')[1];
  }

  // Normalize duration
  let actualDuration: number | null = null;
  if (recordingDuration !== undefined && recordingDuration !== null && recordingDuration > 0) {
    actualDuration = Math.round(recordingDuration);
    // Sanity check: cap at 2 hours
    if (actualDuration > 7200000) {
      console.warn('[TranscriptionService] ENHANCED: Duration capped at 2 hours');
      actualDuration = 7200000;
    }
  }

  // Get timezone with fallback
  let timezone = 'UTC';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (error) {
    console.warn('[TranscriptionService] ENHANCED: Could not detect timezone, using UTC');
  }

  return {
    body: {
      audio: cleanAudio,
      userId,
      directTranscription,
      highQuality: processSentiment,
      recordingTime: actualDuration
    },
    headers: {
      'x-timezone': timezone,
      'x-request-timestamp': new Date().toISOString(),
      'x-client-version': '1.0.0', // Add version for debugging
      'x-audio-size': cleanAudio.length.toString()
    }
  };
}

/**
 * Enhanced function invocation with timeout and retry logic
 */
async function invokeTranscriptionFunction(
  requestData: any,
  maxRetries: number = 2
): Promise<any> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[TranscriptionService] ENHANCED: Attempt ${attempt + 1}/${maxRetries + 1}`);
      
      const startTime = Date.now();
      
      // Enhanced timeout based on audio size
      const audioSize = requestData.body.audio.length;
      const baseTimeout = 90000; // 1.5 minute base (increased for OpenAI SDK)
      const sizeMultiplier = Math.min(audioSize / 100000, 10); // Max 10x multiplier
      const dynamicTimeout = baseTimeout + (sizeMultiplier * 30000); // Up to 6 minutes total
      
      console.log(`[TranscriptionService] ENHANCED: Using timeout: ${dynamicTimeout}ms for audio size: ${audioSize}`);
      
      const result = await Promise.race([
        supabase.functions.invoke('transcribe-audio', requestData),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`Function timeout after ${dynamicTimeout}ms`)), dynamicTimeout)
        )
      ]);
      
      const elapsed = Date.now() - startTime;
      console.log(`[TranscriptionService] ENHANCED: Function responded in ${elapsed}ms on attempt ${attempt + 1}`);
      
      return result;
      
    } catch (error: any) {
      lastError = error;
      console.error(`[TranscriptionService] ENHANCED: Attempt ${attempt + 1} failed:`, error.message);
      
      // Don't retry on certain errors
      if (error.message.includes('authentication') || 
          error.message.includes('authorization') ||
          error.message.includes('Invalid audio data')) {
        console.log('[TranscriptionService] ENHANCED: Non-retryable error, stopping');
        break;
      }
      
      // Wait before retry with exponential backoff
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 3000; // 3s, 6s, 12s...
        console.log(`[TranscriptionService] ENHANCED: Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError || new Error('All transcription attempts failed');
}

/**
 * Enhanced response validation
 */
function validateTranscriptionResponse(data: any): { valid: boolean; error?: string } {
  if (!data) {
    return { valid: false, error: 'No response data received' };
  }

  // For direct transcription, check for transcription field
  if (data.transcription !== undefined) {
    if (typeof data.transcription !== 'string') {
      return { valid: false, error: 'Invalid transcription format' };
    }
    return { valid: true };
  }

  // For full processing, check for essential fields
  if (data.entryId !== undefined) {
    if (typeof data.entryId !== 'number' || data.entryId <= 0) {
      return { valid: false, error: 'Invalid entry ID in response' };
    }
    return { valid: true };
  }

  return { valid: false, error: 'Response missing required fields' };
}

/**
 * Enhanced main transcription function with comprehensive error handling
 */
export async function sendAudioForTranscription(
  base64Audio: string,
  userId: string | undefined,
  directTranscription: boolean = false,
  processSentiment: boolean = true,
  recordingDuration?: number
): Promise<TranscriptionResult> {
  const startTime = Date.now();
  
  try {
    console.log(`[TranscriptionService] ENHANCED: Starting ${directTranscription ? 'direct' : 'full'} transcription processing with OpenAI SDK`);
    console.log(`[TranscriptionService] ENHANCED: Audio data size: ${base64Audio?.length || 0} characters`);
    console.log(`[TranscriptionService] ENHANCED: Recording duration (ms): ${recordingDuration}`);

    // Step 1: Enhanced environment validation
    const envValidation = validateEnvironment();
    if (!envValidation.valid) {
      throw new Error(`Environment validation failed: ${envValidation.error}`);
    }

    // Step 2: Enhanced user validation
    if (!userId) {
      throw new Error('User authentication required - no user ID provided');
    }

    if (typeof userId !== 'string' || userId.length < 10) {
      throw new Error('Invalid user ID format');
    }

    // Step 3: Enhanced audio data validation
    const audioValidation = validateAudioData(base64Audio);
    if (!audioValidation.valid) {
      throw new Error(`Audio validation failed: ${audioValidation.error}`);
    }

    // Step 4: Enhanced request preparation
    const requestData = prepareTranscriptionRequest(
      base64Audio,
      userId,
      directTranscription,
      processSentiment,
      recordingDuration
    );

    console.log('[TranscriptionService] ENHANCED: Request prepared with enhanced validation and OpenAI SDK support');

    // Step 5: Enhanced function invocation with retry logic
    console.log('[TranscriptionService] ENHANCED: Calling transcribe-audio edge function with OpenAI SDK...');
    
    const { data, error } = await invokeTranscriptionFunction(requestData);
    
    const elapsed = Date.now() - startTime;
    console.log(`[TranscriptionService] ENHANCED: Total processing time: ${elapsed}ms`);

    // Step 6: Enhanced error handling
    if (error) {
      console.error('[TranscriptionService] ENHANCED: Edge function error:', error);
      
      // Classify error types for better handling
      let errorMessage = error.message || 'Unknown edge function error';
      if (error.message?.includes('timeout')) {
        errorMessage = 'Processing timeout - please try with a shorter recording';
      } else if (error.message?.includes('size') || error.message?.includes('large')) {
        errorMessage = 'Audio file too large - please try with a shorter recording';
      } else if (error.message?.includes('format') || error.message?.includes('invalid')) {
        errorMessage = 'Invalid audio format - please try recording again';
      } else if (error.message?.includes('model')) {
        errorMessage = 'Audio transcription service temporarily unavailable - please try again';
      }
      
      throw new Error(`Transcription service error: ${errorMessage}`);
    }

    // Step 7: Enhanced response validation
    const responseValidation = validateTranscriptionResponse(data);
    if (!responseValidation.valid) {
      throw new Error(`Response validation failed: ${responseValidation.error}`);
    }

    console.log('[TranscriptionService] ENHANCED: Response validation passed');
    console.log('[TranscriptionService] ENHANCED: Processing completed successfully with OpenAI SDK');
    
    // Step 8: Enhanced success logging
    if (data.languages) {
      console.log('[TranscriptionService] ENHANCED: Languages detected:', data.languages);
    }
    if (data.entryId) {
      console.log('[TranscriptionService] ENHANCED: Entry ID:', data.entryId);
    }
    
    return {
      success: true,
      data
    };
    
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error('[TranscriptionService] ENHANCED: Error in transcription process:', error.message);
    console.error('[TranscriptionService] ENHANCED: Failed after:', elapsed, 'ms');
    
    // Enhanced error response with context
    return {
      success: false,
      error: error.message || 'Unknown transcription error'
    };
  }
}

/**
 * Enhanced helper function to convert a Blob to base64 with validation
 */
export async function audioToBase64(blob: Blob): Promise<string> {
  try {
    console.log(`[TranscriptionService] ENHANCED: Converting audio blob to base64, size: ${blob.size} bytes`);
    
    // Validate blob before conversion
    if (!blob || blob.size === 0) {
      throw new Error('Invalid or empty audio blob');
    }
    
    if (blob.size > 50 * 1024 * 1024) { // 50MB limit
      throw new Error(`Audio file too large: ${(blob.size / 1024 / 1024).toFixed(2)}MB (max 50MB)`);
    }
    
    const startTime = Date.now();
    
    const base64 = await Promise.race([
      blobToBase64(blob),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Base64 conversion timeout')), 30000) // 30s timeout
      )
    ]);
    
    const elapsed = Date.now() - startTime;
    console.log(`[TranscriptionService] ENHANCED: Conversion completed in ${elapsed}ms, result size: ${base64.length} characters`);
    
    // Validate result
    if (!base64 || base64.length < 100) {
      throw new Error('Base64 conversion produced invalid result');
    }
    
    return base64;
    
  } catch (error) {
    console.error('[TranscriptionService] ENHANCED: Error converting audio to base64:', error);
    throw new Error(`Failed to convert audio to base64: ${error.message}`);
  }
}

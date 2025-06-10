
import { supabase } from '@/integrations/supabase/client';
import { blobToBase64 } from './blob-utils';
import { sendAudioForTranscription } from './transcription-service';
import { getEntryIdForProcessingId, setEntryIdForProcessingId } from '../audio-processing';

/**
 * Enhanced audio validation with size and format checks
 */
function validateAudioBlob(audioBlob: Blob): { valid: boolean; error?: string } {
  // Check blob exists and has content
  if (!audioBlob || audioBlob.size === 0) {
    return { valid: false, error: 'Audio blob is empty or null' };
  }

  // Check minimum size (at least 1KB for valid audio)
  if (audioBlob.size < 1024) {
    return { valid: false, error: `Audio file too small: ${audioBlob.size} bytes` };
  }

  // Check maximum size (50MB limit for mobile apps)
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (audioBlob.size > maxSize) {
    return { valid: false, error: `Audio file too large: ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB (max 50MB)` };
  }

  // Check MIME type if available
  if (audioBlob.type && !audioBlob.type.startsWith('audio/')) {
    console.warn(`[BackgroundProcessor] Unexpected MIME type: ${audioBlob.type}`);
  }

  return { valid: true };
}

/**
 * Enhanced process recording with comprehensive error handling and robust retry logic
 */
export async function processRecordingInBackground(
  audioBlob: Blob,
  userId: string | undefined,
  tempId: string,
  recordingDuration?: number
): Promise<{ success: boolean; entryId?: number; error?: string }> {
  console.log('[BackgroundProcessor] ENHANCED: Starting background processing for tempId:', tempId);
  console.log('[BackgroundProcessor] ENHANCED: Recording duration (ms):', recordingDuration);
  console.log('[BackgroundProcessor] ENHANCED: Audio blob size:', audioBlob.size, 'bytes');
  
  // Start timing the entire process
  const startTime = Date.now();
  
  try {
    // Step 1: Enhanced user validation
    if (!userId) {
      throw new Error('User ID is required for audio processing');
    }

    // Step 2: Enhanced audio validation
    const validation = validateAudioBlob(audioBlob);
    if (!validation.valid) {
      throw new Error(`Audio validation failed: ${validation.error}`);
    }

    console.log('[BackgroundProcessor] ENHANCED: Audio validation passed');

    // Step 3: Enhanced duration validation and normalization
    let normalizedDuration: number | undefined;
    if (recordingDuration !== undefined && recordingDuration !== null) {
      if (recordingDuration < 0) {
        console.warn('[BackgroundProcessor] ENHANCED: Negative duration detected, using undefined');
        normalizedDuration = undefined;
      } else if (recordingDuration > 3600000) { // 1 hour in ms
        console.warn('[BackgroundProcessor] ENHANCED: Duration too long, capping at 1 hour');
        normalizedDuration = 3600000;
      } else {
        normalizedDuration = Math.round(recordingDuration);
      }
    }

    console.log(`[BackgroundProcessor] ENHANCED: Normalized duration: ${normalizedDuration}ms`);

    // Step 4: Enhanced base64 conversion with timeout
    console.log('[BackgroundProcessor] ENHANCED: Converting audio blob to base64');
    const conversionStart = Date.now();
    
    const base64Audio = await Promise.race([
      blobToBase64(audioBlob),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Base64 conversion timeout')), 30000) // 30s timeout
      )
    ]);
    
    const conversionTime = Date.now() - conversionStart;
    console.log(`[BackgroundProcessor] ENHANCED: Base64 conversion completed in ${conversionTime}ms`);
    
    if (!base64Audio || base64Audio.length < 100) {
      throw new Error('Audio conversion failed or produced invalid data');
    }
    
    console.log(`[BackgroundProcessor] ENHANCED: Successfully converted audio to base64, length: ${base64Audio.length}`);
    
    // Step 5: Enhanced transcription with aggressive retry logic for server errors
    console.log('[BackgroundProcessor] ENHANCED: Sending audio to transcription service');
    const transcriptionStart = Date.now();
    
    let transcriptionResult;
    let retryCount = 0;
    const maxRetries = 3; // Increased retries for server issues
    
    while (retryCount <= maxRetries) {
      try {
        console.log(`[BackgroundProcessor] ENHANCED: Transcription attempt ${retryCount + 1}/${maxRetries + 1}`);
        
        transcriptionResult = await Promise.race([
          sendAudioForTranscription(
            base64Audio, 
            userId,
            false, // Full processing
            true,  // High quality
            normalizedDuration
          ),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Transcription service timeout')), 180000) // 3 minute timeout
          )
        ]);
        
        if (transcriptionResult.success) {
          break; // Success, exit retry loop
        } else {
          throw new Error(transcriptionResult.error || 'Transcription failed');
        }
      } catch (error: any) {
        retryCount++;
        console.error(`[BackgroundProcessor] ENHANCED: Transcription attempt ${retryCount} failed:`, error.message);
        
        // Enhanced error classification for better retry decisions
        const isServerError = error.message.includes('500') || 
                             error.message.includes('server error') ||
                             error.message.includes('internal error') ||
                             error.message.includes('timeout') ||
                             error.message.includes('request_timeout');
        
        const isAuthError = error.message.includes('authentication') || 
                           error.message.includes('authorization') ||
                           error.message.includes('401') ||
                           error.message.includes('403');
        
        const isInvalidDataError = error.message.includes('Invalid audio data') ||
                                  error.message.includes('validation failed');
        
        // Don't retry on authentication or data validation errors
        if (isAuthError || isInvalidDataError) {
          console.log('[BackgroundProcessor] ENHANCED: Non-retryable error detected, stopping');
          break;
        }
        
        // Always retry server errors
        if (retryCount > maxRetries) {
          console.error('[BackgroundProcessor] ENHANCED: Max retries exceeded');
          throw error;
        }
        
        // Exponential backoff with jitter for server errors
        const baseWaitTime = Math.pow(2, retryCount) * 2000; // 2s, 4s, 8s, 16s...
        const jitter = Math.random() * 1000; // Add up to 1s jitter
        const waitTime = baseWaitTime + jitter;
        
        console.log(`[BackgroundProcessor] ENHANCED: Retrying in ${Math.round(waitTime)}ms... (Server error detected: ${isServerError})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    const transcriptionTime = Date.now() - transcriptionStart;
    console.log(`[BackgroundProcessor] ENHANCED: Transcription completed in ${transcriptionTime}ms after ${retryCount} retries`);

    if (!transcriptionResult || !transcriptionResult.success) {
      throw new Error(transcriptionResult?.error || 'Transcription service failed');
    }

    console.log('[BackgroundProcessor] ENHANCED: Transcription result:', transcriptionResult.data);
    console.log('[BackgroundProcessor] ENHANCED: Entry created with languages:', transcriptionResult.data?.languages);
    
    // Step 6: Enhanced entry ID validation
    const entryId = transcriptionResult.data?.entryId;
    
    if (!entryId) {
      throw new Error('No entry ID returned from transcription service');
    }

    if (typeof entryId !== 'number' || entryId <= 0) {
      throw new Error(`Invalid entry ID returned: ${entryId}`);
    }
    
    console.log(`[BackgroundProcessor] ENHANCED: Successfully created journal entry with ID: ${entryId}`);
    
    // Step 7: Enhanced mapping storage with validation
    try {
      setEntryIdForProcessingId(tempId, entryId);
      console.log(`[BackgroundProcessor] ENHANCED: Stored mapping ${tempId} -> ${entryId}`);
    } catch (mappingError) {
      console.error('[BackgroundProcessor] ENHANCED: Error storing entry mapping:', mappingError);
      // Don't fail the entire process for mapping errors
    }
    
    // Step 8: Enhanced UI notification with comprehensive data
    const totalTime = Date.now() - startTime;
    console.log(`[BackgroundProcessor] ENHANCED: Total processing time: ${totalTime}ms`);
    
    const eventDetail = {
      entryId,
      tempId,
      timestamp: Date.now(),
      forceUpdate: true,
      languages: transcriptionResult.data?.languages || [],
      processingTime: totalTime,
      audioSize: audioBlob.size,
      retryCount,
      success: true
    };
    
    window.dispatchEvent(new CustomEvent('journalEntriesNeedRefresh', {
      detail: eventDetail
    }));
    
    console.log('[BackgroundProcessor] ENHANCED: Processing completed successfully');
    
    return {
      success: true,
      entryId
    };
    
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error('[BackgroundProcessor] ENHANCED: Error in background processing:', error);
    console.error('[BackgroundProcessor] ENHANCED: Processing failed after:', totalTime, 'ms');
    
    // Enhanced error classification for user feedback
    let errorType = 'unknown';
    let userFriendlyMessage = error.message;
    
    if (error.message.includes('timeout')) {
      errorType = 'timeout';
      userFriendlyMessage = 'Processing took too long - please try with a shorter recording';
    } else if (error.message.includes('validation')) {
      errorType = 'validation';
      userFriendlyMessage = 'Invalid audio format - please try recording again';
    } else if (error.message.includes('conversion')) {
      errorType = 'conversion';
      userFriendlyMessage = 'Audio conversion failed - please try recording again';
    } else if (error.message.includes('server error') || error.message.includes('500')) {
      errorType = 'server_error';
      userFriendlyMessage = 'OpenAI servers are experiencing issues - please try again in a moment';
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      errorType = 'network';
      userFriendlyMessage = 'Network connection issue - please check your connection and try again';
    }
    
    // Enhanced failure notification with error details
    const failureDetail = {
      tempId,
      error: userFriendlyMessage,
      originalError: error.message,
      errorType,
      timestamp: Date.now(),
      processingTime: totalTime,
      audioSize: audioBlob?.size || 0,
      success: false
    };
    
    window.dispatchEvent(new CustomEvent('processingEntryFailed', {
      detail: failureDetail
    }));
    
    return {
      success: false,
      error: userFriendlyMessage
    };
  }
}

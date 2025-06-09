
import { supabase } from '@/integrations/supabase/client';
import { blobToBase64 } from '@/utils/audio/blob-utils';

interface TranscriptionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Enhanced transcription service with improved error handling and validation
 * @param base64Audio - Base64 encoded audio data
 * @param userId - User ID for association with the transcription
 * @param directTranscription - If true, just returns the transcription without processing
 * @param processSentiment - If true, ensure sentiment analysis is performed with UTF-8 encoding
 * @param recordingDuration - Recording duration in milliseconds (ACTUAL recording time)
 */
export async function sendAudioForTranscription(
  base64Audio: string,
  userId: string | undefined,
  directTranscription: boolean = false,
  processSentiment: boolean = true,
  recordingDuration?: number
): Promise<TranscriptionResult> {
  try {
    // Enhanced validation
    if (!base64Audio) {
      console.error('[TranscriptionService] No audio data provided');
      throw new Error('No audio data provided');
    }

    if (!userId) {
      console.error('[TranscriptionService] No user ID provided');
      throw new Error('User authentication required');
    }

    // Enhanced audio data validation
    if (typeof base64Audio !== 'string' || base64Audio.length < 50) {
      throw new Error('Invalid audio data format');
    }
    
    // Check for valid base64 format
    const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
    const cleanedAudio = base64Audio.replace(/^data:audio\/[^;]+;base64,/, '');
    if (!base64Pattern.test(cleanedAudio)) {
      throw new Error('Invalid base64 audio format');
    }

    console.log(`[TranscriptionService] Sending audio for ${directTranscription ? 'direct' : 'enhanced'} transcription processing`);
    console.log(`[TranscriptionService] Audio data size: ${base64Audio.length} characters`);
    console.log('[TranscriptionService] User ID provided:', userId ? 'Yes' : 'No');
    console.log('[TranscriptionService] Recording duration (actual):', recordingDuration, 'ms');

    // Use the actual recording duration provided by the client
    const actualDuration = recordingDuration || 0;
    console.log(`[TranscriptionService] Using actual recording duration: ${actualDuration}ms`);

    // Get user's timezone if available
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    // Enhanced request parameters logging
    console.log('[TranscriptionService] Enhanced request parameters:', {
      userId: userId ? '(provided)' : '(not provided)',
      directTranscription,
      highQuality: processSentiment,
      audioSize: base64Audio.length,
      recordingTime: actualDuration,
      timezone
    });

    // Enhanced transcription service call with retry logic
    console.log('[TranscriptionService] Calling enhanced transcribe-audio edge function...');
    const startTime = Date.now();
    
    let lastError;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke('transcribe-audio', {
          body: {
            audio: base64Audio, // Use 'audio' parameter name to match edge function
            userId,
            directTranscription,
            highQuality: processSentiment,
            recordingTime: actualDuration // Pass the actual recording duration
          },
          headers: {
            'x-timezone': timezone // Pass timezone in headers
          }
        });
        
        const elapsed = Date.now() - startTime;
        console.log(`[TranscriptionService] Enhanced edge function responded in ${elapsed}ms (attempt ${attempt})`);

        if (error) {
          console.error(`[TranscriptionService] Edge function error (attempt ${attempt}):`, error);
          lastError = error;
          
          // Don't retry on client errors
          if (error.message?.includes('client error') || error.message?.includes('authentication')) {
            throw new Error(`Edge function error: ${error.message}`);
          }
          
          // Retry on server errors
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
            console.log(`[TranscriptionService] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          throw new Error(`Edge function error after ${maxRetries} attempts: ${error.message}`);
        }

        if (!data) {
          console.error(`[TranscriptionService] No data returned from edge function (attempt ${attempt})`);
          lastError = new Error('No data returned from transcription service');
          
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt - 1) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          throw lastError;
        }

        console.log('[TranscriptionService] Enhanced transcription response:', data);
        console.log('[TranscriptionService] Enhanced transcription completed successfully');
        
        return {
          success: true,
          data
        };
      } catch (attemptError: any) {
        lastError = attemptError;
        console.error(`[TranscriptionService] Attempt ${attempt} failed:`, attemptError);
        
        if (attempt === maxRetries) {
          throw attemptError;
        }
        
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`[TranscriptionService] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error('All transcription attempts failed');
  } catch (error: any) {
    console.error('[TranscriptionService] Enhanced error in transcription process:', error);
    return {
      success: false,
      error: error.message || 'Unknown transcription error'
    };
  }
}

/**
 * Enhanced helper function to convert a Blob to base64 with validation
 * @param blob - Audio blob to convert
 */
export async function audioToBase64(blob: Blob): Promise<string> {
  try {
    console.log(`[TranscriptionService] Converting audio blob to base64, size: ${blob.size} bytes`);
    
    // Validate blob
    if (!blob || blob.size === 0) {
      throw new Error('Invalid or empty audio blob');
    }
    
    if (blob.size > 25 * 1024 * 1024) { // 25MB limit
      throw new Error('Audio file too large (maximum 25MB)');
    }
    
    const startTime = Date.now();
    
    const base64 = await blobToBase64(blob);
    
    // Validate result
    if (!base64 || base64.length < 50) {
      throw new Error('Base64 conversion produced invalid result');
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`[TranscriptionService] Enhanced conversion completed in ${elapsed}ms, result size: ${base64.length} characters`);
    
    return base64;
  } catch (error) {
    console.error('[TranscriptionService] Enhanced error converting audio to base64:', error);
    throw new Error(`Failed to convert audio to base64: ${error.message}`);
  }
}

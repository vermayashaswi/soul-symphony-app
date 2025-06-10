import { supabase } from '@/integrations/supabase/client';
import { blobToBase64 } from '@/utils/audio/blob-utils';

interface TranscriptionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Sends audio data to the transcribe-audio edge function
 * @param base64Audio - Base64 encoded audio data
 * @param userId - User ID for association with the transcription
 * @param directTranscription - If true, just returns the transcription without processing
 * @param processSentiment - If true, ensure sentiment analysis is performed with UTF-8 encoding
 * @param recordingDuration - Recording duration in milliseconds (ACTUAL recording time)
 * @param preserveOriginalLanguage - If true, preserve original language without translation
 */
export async function sendAudioForTranscription(
  base64Audio: string,
  userId: string | undefined,
  directTranscription: boolean = false,
  processSentiment: boolean = true,
  recordingDuration?: number,
  preserveOriginalLanguage: boolean = false
): Promise<TranscriptionResult> {
  try {
    if (!base64Audio) {
      console.error('[TranscriptionService] No audio data provided');
      throw new Error('No audio data provided');
    }

    if (!userId) {
      console.error('[TranscriptionService] No user ID provided');
      throw new Error('User authentication required');
    }

    console.log(`[TranscriptionService] Sending audio for ${directTranscription ? 'direct' : 'full'} transcription processing`);
    console.log(`[TranscriptionService] Audio data size: ${base64Audio.length} characters`);
    console.log('[TranscriptionService] User ID provided:', userId ? 'Yes' : 'No');
    console.log('[TranscriptionService] Recording duration (actual):', recordingDuration, 'ms');
    console.log('[TranscriptionService] Preserve original language:', preserveOriginalLanguage);

    // Check if base64Audio is valid
    if (typeof base64Audio !== 'string' || base64Audio.length < 50) {
      throw new Error('Invalid audio data format');
    }

    // Use the actual recording duration provided by the client
    const actualDuration = recordingDuration || 0;
    console.log(`[TranscriptionService] Using actual recording duration: ${actualDuration}ms`);

    // Get user's timezone if available
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    // Log the request parameters for debugging
    console.log('[TranscriptionService] Request parameters:', {
      userId: userId ? '(provided)' : '(not provided)',
      directTranscription,
      highQuality: processSentiment,
      audioSize: base64Audio.length,
      recordingTime: actualDuration,
      preserveOriginalLanguage,
      timezone
    });

    // Invoke the edge function with the actual recording duration and language preference
    console.log('[TranscriptionService] Calling transcribe-audio edge function...');
    const startTime = Date.now();
    
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: {
        audio: base64Audio, // Use 'audio' parameter name to match edge function
        userId,
        directTranscription,
        highQuality: processSentiment,
        recordingTime: actualDuration, // Pass the actual recording duration
        preserveOriginalLanguage // IMPROVED: Pass language preservation preference
      },
      headers: {
        'x-timezone': timezone // Pass timezone in headers
      }
    });
    
    const elapsed = Date.now() - startTime;
    console.log(`[TranscriptionService] Edge function responded in ${elapsed}ms`);

    if (error) {
      console.error('[TranscriptionService] Edge function error:', error);
      throw new Error(`Edge function error: ${error.message}`);
    }

    if (!data) {
      console.error('[TranscriptionService] No data returned from edge function');
      throw new Error('No data returned from transcription service');
    }

    console.log('[TranscriptionService] Transcription response:', data);
    console.log('[TranscriptionService] Transcription completed successfully');
    
    return {
      success: true,
      data
    };
  } catch (error: any) {
    console.error('[TranscriptionService] Error in transcription process:', error);
    return {
      success: false,
      error: error.message || 'Unknown transcription error'
    };
  }
}

/**
 * Helper function to convert a Blob to base64
 * @param blob - Audio blob to convert
 */
export async function audioToBase64(blob: Blob): Promise<string> {
  try {
    console.log(`[TranscriptionService] Converting audio blob to base64, size: ${blob.size} bytes`);
    const startTime = Date.now();
    
    const base64 = await blobToBase64(blob);
    
    const elapsed = Date.now() - startTime;
    console.log(`[TranscriptionService] Conversion completed in ${elapsed}ms, result size: ${base64.length} characters`);
    
    return base64;
  } catch (error) {
    console.error('[TranscriptionService] Error converting audio to base64:', error);
    throw new Error('Failed to convert audio to base64');
  }
}

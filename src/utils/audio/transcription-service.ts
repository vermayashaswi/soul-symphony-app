
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
 */
export async function sendAudioForTranscription(
  base64Audio: string,
  userId: string | undefined,
  directTranscription: boolean = false,
  processSentiment: boolean = true
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

    // Check if base64Audio is valid
    if (typeof base64Audio !== 'string' || base64Audio.length < 50) {
      throw new Error('Invalid audio data format');
    }

    // Calculate estimated recording time based on audio data size
    const estimatedDuration = Math.floor(base64Audio.length / 10000);
    console.log(`[TranscriptionService] Estimated recording duration: ~${estimatedDuration}s`);

    // Log the request parameters for debugging
    console.log('[TranscriptionService] Request parameters:', {
      userId: userId ? '(provided)' : '(not provided)',
      directTranscription,
      highQuality: processSentiment,
      audioSize: base64Audio.length,
      estimatedDuration: estimatedDuration * 1000
    });

    // Invoke the edge function with corrected parameter names
    console.log('[TranscriptionService] Calling transcribe-audio edge function...');
    const startTime = Date.now();
    
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: {
        audio: base64Audio, // Use 'audio' parameter name to match edge function
        userId,
        directTranscription,
        highQuality: processSentiment,
        recordingTime: estimatedDuration * 1000 // Convert to milliseconds
      },
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

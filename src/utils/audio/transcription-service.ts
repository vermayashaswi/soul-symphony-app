
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

    console.log(`[TranscriptionService] Sending audio for ${directTranscription ? 'direct' : 'full'} transcription processing`);
    console.log(`[TranscriptionService] Audio data size: ${base64Audio.length} characters`);
    console.log('[TranscriptionService] User ID provided:', userId ? 'Yes' : 'No');

    // Check if base64Audio is valid
    if (typeof base64Audio !== 'string' || base64Audio.length < 50) {
      throw new Error('Invalid audio data format');
    }

    // Guard against empty or invalid user ID which could cause server-side errors
    if (userId === '') {
      userId = undefined;
    }

    // Generate a request ID for tracking
    const requestId = Math.random().toString(36).substring(2, 15);
    console.log(`[TranscriptionService] Generated request ID: ${requestId}`);

    // Calculate estimated recording time based on audio data size
    const estimatedDuration = Math.floor(base64Audio.length / 10000);
    console.log(`[TranscriptionService] Estimated recording duration: ~${estimatedDuration}s`);

    // Invoke the edge function
    console.log(`[TranscriptionService] Invoking edge function with request ID: ${requestId}`);
    const startTime = Date.now();
    
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: {
        audio: base64Audio,
        userId,
        directTranscription,
        highQuality: processSentiment,
        recordingTime: estimatedDuration * 1000, // Convert to milliseconds
        requestId // Include the request ID
      },
    });

    const endTime = Date.now();
    console.log(`[TranscriptionService] Edge function response received in ${endTime - startTime}ms for request ${requestId}`);

    if (error) {
      console.error(`[TranscriptionService] Edge function error for request ${requestId}:`, error);
      throw new Error(`Edge function error: ${error.message}`);
    }

    if (!data) {
      console.error(`[TranscriptionService] No data returned from edge function for request ${requestId}`);
      throw new Error('No data returned from transcription service');
    }

    console.log(`[TranscriptionService] Transcription completed successfully for request ${requestId}`);
    console.log(`[TranscriptionService] Response data:`, data);
    
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
    return await blobToBase64(blob);
  } catch (error) {
    console.error('[TranscriptionService] Error converting audio to base64:', error);
    throw new Error('Failed to convert audio to base64');
  }
}

/**
 * Verifies if a journal entry was properly processed
 * @param entryId - ID of the journal entry to verify
 */
export async function verifyJournalEntryProcessed(entryId: number): Promise<boolean> {
  try {
    console.log(`[TranscriptionService] Verifying journal entry ${entryId} was processed`);
    
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('id, "refined text", emotions')
      .eq('id', entryId)
      .single();
    
    if (error) {
      console.error(`[TranscriptionService] Error verifying entry ${entryId}:`, error);
      return false;
    }
    
    if (!data) {
      console.log(`[TranscriptionService] Entry ${entryId} not found`);
      return false;
    }
    
    const isProcessed = !!data["refined text"] || !!data.emotions;
    console.log(`[TranscriptionService] Entry ${entryId} processed status: ${isProcessed}`);
    
    return isProcessed;
  } catch (error) {
    console.error(`[TranscriptionService] Exception verifying entry ${entryId}:`, error);
    return false;
  }
}


import { supabase } from '@/integrations/supabase/client';
import { blobToBase64 } from '@/utils/audio/blob-utils';
import { toast } from 'sonner';

interface TranscriptionResult {
  success: boolean;
  data?: any;
  error?: string;
  statusCode?: number;
  requestId?: string;
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

    // Calculate estimated recording time based on audio data size
    const estimatedDuration = Math.floor(base64Audio.length / 10000);
    console.log(`[TranscriptionService] Estimated recording duration: ~${estimatedDuration}s`);

    // Generate a request ID for tracking
    const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
    console.log(`[TranscriptionService] Request ID: ${requestId}`);

    // Invoke the edge function
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: {
        audio: base64Audio,
        userId,
        directTranscription,
        highQuality: processSentiment,
        recordingTime: estimatedDuration * 1000, // Convert to milliseconds
        requestId
      },
    });

    if (error) {
      console.error(`[TranscriptionService] Edge function error (${requestId}):`, error);
      // Try to get more detailed error information
      const errorDetails = typeof error === 'object' ? JSON.stringify(error) : error.toString();
      throw new Error(`Edge function error: ${error.message || errorDetails}`);
    }

    if (!data) {
      console.error(`[TranscriptionService] No data returned from edge function (${requestId})`);
      throw new Error('No data returned from transcription service');
    }

    console.log(`[TranscriptionService] Transcription completed successfully (${requestId})`);
    console.log('[TranscriptionService] Response data:', data);
    
    // Additional response validation
    if (data.entryId) {
      console.log(`[TranscriptionService] Entry ID received: ${data.entryId}`);
      
      // Dispatch completion event to notify listeners
      const event = new CustomEvent('transcriptionComplete', {
        detail: { 
          entryId: data.entryId,
          requestId,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(event);
    }
    
    return {
      success: true,
      data,
      requestId
    };
  } catch (error: any) {
    console.error('[TranscriptionService] Error in transcription process:', error);
    
    // Show error toast to the user
    toast.error('Error processing audio', {
      description: error.message || 'Please try again',
      duration: 4000
    });
    
    return {
      success: false,
      error: error.message || 'Unknown transcription error',
      statusCode: error.status || 500
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
 * Verifies that an entry was correctly processed
 * @param entryId - The entry ID to verify
 */
export async function verifyEntryProcessed(entryId: number): Promise<boolean> {
  try {
    console.log(`[TranscriptionService] Verifying entry ${entryId} processing`);
    
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('id, "refined text", translation_status')
      .eq('id', entryId)
      .single();
    
    if (error) {
      console.error(`[TranscriptionService] Error verifying entry ${entryId}:`, error);
      return false;
    }
    
    if (!data || !data["refined text"]) {
      console.log(`[TranscriptionService] Entry ${entryId} exists but not fully processed`);
      return false;
    }
    
    console.log(`[TranscriptionService] Entry ${entryId} verified with status: ${data.translation_status}`);
    return true;
  } catch (error) {
    console.error(`[TranscriptionService] Error in verifyEntryProcessed:`, error);
    return false;
  }
}

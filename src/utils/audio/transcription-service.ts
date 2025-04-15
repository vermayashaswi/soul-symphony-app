
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
 */
export async function sendAudioForTranscription(
  base64Audio: string,
  userId: string | undefined,
  directTranscription: boolean = false
): Promise<TranscriptionResult> {
  try {
    if (!base64Audio) {
      console.error('[TranscriptionService] No audio data provided');
      throw new Error('No audio data provided');
    }

    console.log(`[TranscriptionService] Sending audio for ${directTranscription ? 'direct' : 'full'} transcription processing`);
    console.log(`[TranscriptionService] Audio data size: ${base64Audio.length} characters`);
    
    // Call the Supabase edge function with a longer timeout
    console.log('[TranscriptionService] Invoking transcribe-audio edge function');
    const response = await supabase.functions.invoke('transcribe-audio', {
      body: {
        audio: base64Audio,
        userId: userId || null,
        directTranscription: directTranscription,
        highQuality: true // Add flag to indicate this is a high-quality recording
      }
    });

    // Handle response errors
    if (response.error) {
      console.error('[TranscriptionService] Edge function error:', response.error);
      return {
        success: false,
        error: response.error?.message || 'Failed to process audio'
      };
    }

    // Check if the response has a success field
    if (response.data?.success === false) {
      console.error('[TranscriptionService] Processing error:', response.data.error || response.data.message);
      return {
        success: false,
        error: response.data.error || response.data.message || 'Unknown error in audio processing'
      };
    }

    // Validate that we have data back
    if (!response.data) {
      console.error('[TranscriptionService] No data returned from edge function');
      return {
        success: false,
        error: 'No data returned from server'
      };
    }

    // Add more detailed logging about what was returned
    console.log('[TranscriptionService] Transcription successful:', {
      directMode: directTranscription,
      transcriptionLength: response.data?.transcription?.length || 0,
      refinedTextLength: response.data?.refinedText?.length || 0,
      hasEntryId: !!response.data?.entryId,
      entryId: response.data?.entryId || 'none',
      audioUrl: response.data?.audioUrl ? 'exists' : 'none'
    });

    return {
      success: true,
      data: response.data
    };
  } catch (error: any) {
    console.error('[TranscriptionService] Error in sendAudioForTranscription:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}

/**
 * Convert an audio blob to base64 and send for transcription
 * @param audioBlob - The audio blob to transcribe
 * @param userId - User ID for association with the transcription
 * @param directTranscription - If true, just returns the transcription without processing
 */
export async function transcribeAudioBlob(
  audioBlob: Blob,
  userId: string | undefined,
  directTranscription: boolean = false
): Promise<TranscriptionResult> {
  try {
    console.log('[TranscriptionService] Converting audio blob to base64...');
    console.log('[TranscriptionService] Audio blob details:', {
      size: audioBlob.size,
      type: audioBlob.type,
      hasDuration: 'duration' in audioBlob,
      duration: (audioBlob as any).duration || 'unknown'
    });
    
    // Convert blob to base64
    const base64Audio = await blobToBase64(audioBlob);
    
    console.log(`[TranscriptionService] Base64 conversion successful, length: ${base64Audio.length}`);
    
    // Send for transcription
    return await sendAudioForTranscription(base64Audio, userId, directTranscription);
  } catch (error: any) {
    console.error('[TranscriptionService] Error in transcribeAudioBlob:', error);
    return {
      success: false,
      error: error.message || 'Failed to prepare audio for transcription'
    };
  }
}

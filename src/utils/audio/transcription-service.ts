
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
 * @param useGoogleSTT - If true, uses Google Speech-to-Text instead of OpenAI Whisper
 */
export async function sendAudioForTranscription(
  base64Audio: string,
  userId: string | undefined,
  directTranscription: boolean = false,
  useGoogleSTT: boolean = false
): Promise<TranscriptionResult> {
  try {
    if (!base64Audio) {
      throw new Error('No audio data provided');
    }

    if (!userId) {
      throw new Error('No user ID provided');
    }

    console.log(`[TranscriptionService] Sending audio for ${directTranscription ? 'direct' : 'full'} transcription processing`);
    console.log(`[TranscriptionService] Audio data size: ${base64Audio.length} characters`);
    console.log(`[TranscriptionService] Using Google STT: ${useGoogleSTT ? 'Yes' : 'No'}`);
    console.log(`[TranscriptionService] User ID: ${userId}`);
    
    // Check auth status before proceeding
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      console.error('[TranscriptionService] Auth error or no session:', sessionError);
      throw new Error('Authentication required for transcription');
    }
    
    // Call the Supabase edge function with a longer timeout
    try {
      const response = await supabase.functions.invoke('transcribe-audio', {
        body: {
          audio: base64Audio,
          userId: userId,
          directTranscription: directTranscription,
          highQuality: true, // Add flag to indicate this is a high-quality recording
          useGoogleSTT: useGoogleSTT
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

      console.log('[TranscriptionService] Transcription successful:', {
        directMode: directTranscription,
        transcriptionLength: response.data?.transcription?.length || 0,
        hasEntryId: !!response.data?.entryId,
        service: response.data?.transcriptionService || (useGoogleSTT ? 'google' : 'whisper')
      });

      return {
        success: true,
        data: response.data
      };
    } catch (invokeError: any) {
      console.error('[TranscriptionService] Error invoking edge function:', invokeError);
      throw invokeError;
    }
  } catch (error: any) {
    console.error('[TranscriptionService] Error in sendAudioForTranscription:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}

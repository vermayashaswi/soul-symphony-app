
import { supabase } from '@/integrations/supabase/client';

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
      throw new Error('No audio data provided');
    }

    console.log(`Sending audio for ${directTranscription ? 'direct' : 'full'} transcription processing`);
    console.log(`Audio data size: ${base64Audio.length} characters`);
    
    // Call the Supabase edge function with a longer timeout
    const response = await supabase.functions.invoke('transcribe-audio', {
      body: {
        audio: base64Audio,
        userId: userId || null,
        directTranscription: directTranscription,
        highQuality: true // Add flag to indicate this is a high-quality recording
      },
      // Remove invalid options parameter
    }).catch(error => {
      console.error('Error invoking transcribe-audio function:', error);
      throw new Error(`Failed to send request to edge function: ${error.message || 'Connection error'}`);
    });

    // Response handling using statusCode
    const statusCode = response.error ? 500 : 200;
    
    if (statusCode !== 200) {
      console.error('Edge function error:', response.error);
      return {
        success: false,
        error: response.error?.message || 'Failed to process audio'
      };
    }

    // Check if the response has a success field
    if (response.data?.success === false) {
      console.error('Processing error:', response.data.error || response.data.message);
      return {
        success: false,
        error: response.data.error || response.data.message || 'Unknown error in audio processing'
      };
    }

    console.log('Transcription successful:', {
      directMode: directTranscription,
      transcriptionLength: response.data?.transcription?.length || 0,
      hasEntryId: !!response.data?.entryId
    });

    return {
      success: true,
      data: response.data
    };
  } catch (error: any) {
    console.error('Error in sendAudioForTranscription:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}


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
    console.log('[TranscriptionService] Using transcription model: gpt-4o-transcribe');
    
    // Add more diagnostic info about the audio data being sent
    console.log('[TranscriptionService] Audio data sample (first 100 chars):', base64Audio.substring(0, 100));
    
    // Make sure the base64 doesn't contain any URL encoding or header parts
    // It should be a clean base64 string without "data:audio/webm;base64," prefix
    let cleanBase64 = base64Audio;
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }
    
    // Validate base64 string - ensure it's properly formed
    if (!cleanBase64 || cleanBase64.length < 50) {
      throw new Error('Invalid audio data: Base64 string is too short');
    }
    
    try {
      // Verify this is a valid base64 string by trying to decode a small part
      atob(cleanBase64.substring(0, 100));
    } catch (e) {
      console.error('[TranscriptionService] Invalid base64 encoding:', e);
      throw new Error('Invalid audio data: Not properly base64 encoded');
    }
    
    // Better estimation of recording time
    const estimatedDuration = Math.max(
      (cleanBase64.length > 1000) ? Math.floor(cleanBase64.length / 700) : 1,
      directTranscription ? 5 : 3 // Minimum length assumptions
    );
    
    // Call the Supabase edge function with the properly formatted body
    console.log('[TranscriptionService] Invoking transcribe-audio edge function');
    const response = await supabase.functions.invoke('transcribe-audio', {
      body: {
        audio: cleanBase64,
        userId: userId || null,
        directTranscription: directTranscription,
        highQuality: true, // Set to true for full model
        recordingTime: estimatedDuration,
        modelName: 'gpt-4o-transcribe', // Use the full model
        format: 'wav', // Tell the server we're sending WAV format
        audioConfig: {
          sampleRate: 44100,
          channels: 1,
          bitDepth: 16
        },
        autoDetectLanguage: true,  // Added explicit flag for auto language detection
        processSentiment: true     // Add explicit flag to request sentiment analysis
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
      audioUrl: response.data?.audioUrl ? 'exists' : 'none',
      model: 'gpt-4o-transcribe',
      detectedLanguages: response.data?.detectedLanguages || 'none',
      sentiment: response.data?.sentiment || 'not set',
      responseData: JSON.stringify(response.data).substring(0, 200) + '...' // Log a sample of the response
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
    
    // Basic validation of the audio blob
    if (!audioBlob || audioBlob.size < 100) {
      throw new Error('Audio blob is empty or too small to be valid');
    }
    
    // Verify audio MIME type
    const validTypes = ['audio/wav', 'audio/webm', 'audio/mp3', 'audio/mp4', 'audio/mpeg', 'audio/ogg'];
    if (!validTypes.includes(audioBlob.type) && audioBlob.type !== '') {
      console.warn('[TranscriptionService] Unusual audio type:', audioBlob.type);
      // Continue anyway but log the warning
    }
    
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

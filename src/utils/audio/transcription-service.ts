
import { supabase } from '@/integrations/supabase/client';
import { blobToBase64, validatePayloadSize, getUtf8ByteLength } from './blob-utils';

/**
 * Transcribe audio using the Supabase edge function with enhanced error handling
 */
export async function transcribeAudio(
  audioBlob: Blob,
  userId: string
): Promise<{
  success: boolean;
  entryId?: number;
  transcription?: string;
  refinedText?: string;
  error?: string;
}> {
  try {
    console.log('[TranscriptionService] Starting transcription process');
    
    // Convert blob to base64 data URL
    const dataUrl = await blobToBase64(audioBlob);
    console.log('[TranscriptionService] Audio converted to data URL:', {
      dataUrlLength: dataUrl.length,
      blobSize: audioBlob.size,
      hasPrefix: dataUrl.startsWith('data:')
    });
    
    // Get recording duration
    let recordingTime = 0;
    if ('duration' in audioBlob) {
      recordingTime = Math.round((audioBlob as any).duration * 1000);
    }
    
    // Prepare the payload
    const payload = {
      audio: dataUrl,
      userId,
      recordingTime,
      highQuality: true
    };
    
    // Validate payload size before sending
    const sizeValidation = validatePayloadSize(payload);
    console.log('[TranscriptionService] Payload validation:', sizeValidation);
    
    if (!sizeValidation.isValid) {
      throw new Error(sizeValidation.errorMessage || 'Payload validation failed');
    }
    
    // Convert payload to JSON string for size calculation
    const payloadString = JSON.stringify(payload);
    const payloadSizeBytes = getUtf8ByteLength(payloadString);
    
    console.log('[TranscriptionService] Making request to transcribe-audio:', {
      payloadSizeBytes,
      payloadSizeMB: (payloadSizeBytes / (1024 * 1024)).toFixed(2),
      audioDataLength: payload.audio.length,
      userId: payload.userId,
      recordingTime: payload.recordingTime
    });
    
    // Get current session for proper authorization
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('[TranscriptionService] Session error:', sessionError);
      throw new Error(`Authentication error: ${sessionError.message}`);
    }
    
    if (!session?.access_token) {
      throw new Error('No valid session found - please log in again');
    }
    
    // Make the request with explicit headers and retry logic
    console.log('[TranscriptionService] Invoking edge function with session token');
    
    const startTime = Date.now();
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: payload,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payloadSizeBytes.toString(),
        'Authorization': `Bearer ${session.access_token}`,
        'X-Client-Info': 'supabase-js-web/2.49.1'
      }
    });
    
    const requestTime = Date.now() - startTime;
    console.log('[TranscriptionService] Edge function response received:', {
      requestTimeMs: requestTime,
      hasData: !!data,
      hasError: !!error,
      errorMessage: error?.message
    });
    
    if (error) {
      console.error('[TranscriptionService] Edge function error:', error);
      throw new Error(`Server error: ${error.message || 'Unknown error from transcription service'}`);
    }
    
    if (!data) {
      console.error('[TranscriptionService] No data returned from edge function');
      throw new Error('No response from transcription service');
    }
    
    console.log('[TranscriptionService] Transcription successful:', {
      entryId: data.entryId,
      hasTranscription: !!data.transcription,
      hasRefinedText: !!data.refinedText,
      processingTime: data.processingTime
    });
    
    return {
      success: true,
      entryId: data.entryId,
      transcription: data.transcription,
      refinedText: data.refinedText
    };
    
  } catch (error: any) {
    console.error('[TranscriptionService] Error in transcription:', error);
    
    // Provide user-friendly error messages
    let userFriendlyError = 'Failed to transcribe audio - please try again';
    
    if (error.message?.includes('network') || error.message?.includes('fetch')) {
      userFriendlyError = 'Network error - please check your connection';
    } else if (error.message?.includes('auth') || error.message?.includes('session')) {
      userFriendlyError = 'Session expired - please log in again';
    } else if (error.message?.includes('too large') || error.message?.includes('size')) {
      userFriendlyError = 'Audio file too large - please record a shorter message';
    } else if (error.message?.includes('empty') || error.message?.includes('invalid')) {
      userFriendlyError = 'Invalid audio data - please try recording again';
    }
    
    return {
      success: false,
      error: userFriendlyError
    };
  }
}

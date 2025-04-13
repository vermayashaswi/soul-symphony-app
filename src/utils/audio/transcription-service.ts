
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
  const startTime = Date.now();
  let debugEvent;
  
  try {
    if (!base64Audio) {
      throw new Error('No audio data provided');
    }

    console.log(`Sending audio for ${directTranscription ? 'direct' : 'full'} transcription with Whisper + GPT translation`);
    console.log(`Audio data size: ${base64Audio.length} characters`);
    
    // Make sure base64 data doesn't contain multiple data URL prefixes (can happen with some browsers)
    let cleanBase64 = base64Audio;
    if (base64Audio.includes('data:audio') && base64Audio.split('data:audio').length > 2) {
      console.log('Detected multiple data URL prefixes, cleaning up...');
      cleanBase64 = base64Audio.split('data:audio').pop() || '';
      if (cleanBase64.includes(',')) {
        cleanBase64 = cleanBase64.split(',')[1];
      }
    }
    
    debugEvent = new CustomEvent('debug:transcription', {
      detail: {
        step: 'start',
        timestamp: startTime,
        directTranscription,
        audioSize: cleanBase64.length,
        userId: userId || 'guest'
      }
    });
    window.dispatchEvent(debugEvent);
    
    // Call the Supabase edge function with a longer timeout
    const edgeFnStartTime = Date.now();
    
    debugEvent = new CustomEvent('debug:transcription', {
      detail: {
        step: 'edge-function-start',
        timestamp: edgeFnStartTime,
        elapsedMs: edgeFnStartTime - startTime
      }
    });
    window.dispatchEvent(debugEvent);
    
    const response = await supabase.functions.invoke('transcribe-audio', {
      body: {
        audio: cleanBase64,
        userId: userId || null,
        directTranscription: directTranscription,
        recordingTime: Date.now() - startTime, // Pass recording time to help with duration calculation
        timestamp: Date.now()
      },
      // Increase the timeout to 60 seconds
      options: {
        timeout: 60000
      }
    });
    
    const edgeFnEndTime = Date.now();
    
    debugEvent = new CustomEvent('debug:transcription', {
      detail: {
        step: 'edge-function-end',
        timestamp: edgeFnEndTime,
        durationMs: edgeFnEndTime - edgeFnStartTime,
        totalElapsedMs: edgeFnEndTime - startTime,
        hasError: !!response.error,
        statusText: response.error?.message || 'OK',
        responseSize: JSON.stringify(response).length
      }
    });
    window.dispatchEvent(debugEvent);

    // Handle response errors
    if (response.error) {
      console.error('Edge function error:', response.error);
      
      debugEvent = new CustomEvent('debug:transcription', {
        detail: {
          step: 'edge-function-error',
          timestamp: Date.now(),
          error: response.error?.message,
          statusText: response.error?.message || 'Unknown error'
        }
      });
      window.dispatchEvent(debugEvent);
      
      return {
        success: false,
        error: response.error?.message || 'Failed to process audio'
      };
    }

    // Check if the response has a success field
    if (response.data?.success === false) {
      console.error('Processing error:', response.data.error || response.data.message);
      
      debugEvent = new CustomEvent('debug:transcription', {
        detail: {
          step: 'processing-error',
          timestamp: Date.now(),
          error: response.data.error || response.data.message
        }
      });
      window.dispatchEvent(debugEvent);
      
      return {
        success: false,
        error: response.data.error || response.data.message || 'Unknown error in audio processing'
      };
    }

    // Validate that we have data back
    if (!response.data) {
      console.error('No data returned from edge function');
      
      debugEvent = new CustomEvent('debug:transcription', {
        detail: {
          step: 'no-data-error',
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(debugEvent);
      
      return {
        success: false,
        error: 'No data returned from server'
      };
    }

    console.log('Transcription with Whisper + GPT successful:', {
      directMode: directTranscription,
      transcriptionLength: response.data?.transcription?.length || 0,
      hasEntryId: !!response.data?.entryId
    });
    
    debugEvent = new CustomEvent('debug:transcription', {
      detail: {
        step: 'success',
        timestamp: Date.now(),
        totalDurationMs: Date.now() - startTime,
        directMode: directTranscription,
        transcriptionLength: response.data?.transcription?.length || 0,
        refinedTextLength: response.data?.refinedText?.length || 0,
        hasEntryId: !!response.data?.entryId,
        entryId: response.data?.entryId,
        hasEmotions: !!response.data?.emotions,
        hasSentiment: response.data?.sentiment !== undefined,
        audioUrl: response.data?.audioUrl || null
      }
    });
    window.dispatchEvent(debugEvent);

    return {
      success: true,
      data: response.data
    };
  } catch (error: any) {
    console.error('Error in sendAudioForTranscription:', error);
    
    debugEvent = new CustomEvent('debug:transcription', {
      detail: {
        step: 'exception',
        timestamp: Date.now(),
        totalDurationMs: Date.now() - startTime,
        error: error.message,
        stack: error.stack
      }
    });
    window.dispatchEvent(debugEvent);
    
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}

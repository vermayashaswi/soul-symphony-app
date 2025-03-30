
import { supabase } from '@/integrations/supabase/client';

interface TranscriptionResult {
  success: boolean;
  data?: {
    transcription?: string;
    refinedText?: string;
    audioUrl?: string;
    entryId?: number;
    emotions?: Record<string, number>;
    sentiment?: string;
    entities?: any[];
    tempId?: string;
  };
  error?: string;
  requestDetails?: {
    url?: string;
    status?: number;
    responseDetails?: any;
  };
}

/**
 * Sends audio data to Supabase Edge Function for transcription and analysis
 */
export async function sendAudioForTranscription(
  base64Audio: string, 
  userId: string,
  directTranscription: boolean = false
): Promise<TranscriptionResult> {
  try {
    console.log('Sending audio for transcription...');
    console.log('Direct transcription mode:', directTranscription);
    console.log('Audio data length:', base64Audio.length);
    
    // Add a unique ID for tracking this specific request
    const requestId = `req_${Math.random().toString(36).substring(2, 9)}`;
    console.log('Request ID:', requestId);
    
    const startTime = Date.now();
    const { data, error, status } = await supabase.functions.invoke('transcribe-audio', {
      body: { 
        audio: base64Audio,
        userId,
        directTranscription,
        requestId
      }
    });
    const endTime = Date.now();

    console.log(`Transcribe API call completed in ${endTime - startTime}ms with status: ${status}`);
    
    if (error) {
      console.error('Error from transcribe-audio function:', error);
      return {
        success: false,
        error: `Function error: ${error.message || 'Unknown error'}`,
        requestDetails: {
          url: 'supabase.functions.invoke("transcribe-audio")',
          status: status,
          responseDetails: error
        }
      };
    }

    console.log('Transcription result:', data);

    if (!data.success) {
      // Enhanced error logging
      console.error('Transcription failed with server response:', data);
      
      return {
        success: false,
        error: data.error || data.message || 'Failed to transcribe audio',
        requestDetails: {
          url: 'supabase.functions.invoke("transcribe-audio")',
          status: status,
          responseDetails: data
        }
      };
    }

    return {
      success: true,
      data: {
        transcription: data.transcription,
        refinedText: data.refinedText,
        audioUrl: data.audioUrl,
        entryId: data.entryId,
        emotions: data.emotions,
        sentiment: data.sentiment,
        entities: data.entities,
        tempId: data.tempId || requestId
      },
      requestDetails: {
        url: 'supabase.functions.invoke("transcribe-audio")',
        status: status
      }
    };
  } catch (error: any) {
    console.error('Error sending audio for transcription:', error);
    return {
      success: false,
      error: error.message || 'Failed to send audio for transcription',
      requestDetails: {
        url: 'supabase.functions.invoke("transcribe-audio")',
        responseDetails: error
      }
    };
  }
}

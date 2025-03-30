
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
    
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: { 
        audio: base64Audio,
        userId,
        directTranscription 
      }
    });

    if (error) {
      console.error('Error from transcribe-audio function:', error);
      return {
        success: false,
        error: `Function error: ${error.message || 'Unknown error'}`
      };
    }

    console.log('Transcription result:', data);

    if (!data.success) {
      return {
        success: false,
        error: data.error || data.message || 'Failed to transcribe audio'
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
        entities: data.entities
      }
    };
  } catch (error: any) {
    console.error('Error sending audio for transcription:', error);
    return {
      success: false,
      error: error.message || 'Failed to send audio for transcription'
    };
  }
}

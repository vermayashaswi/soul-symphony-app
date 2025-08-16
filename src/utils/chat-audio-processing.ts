
/**
 * Chat-specific audio processing module
 * Handles transcription for voice chat queries without creating journal entries
 */
import { blobToBase64 } from './audio/blob-utils';
import { supabase } from '@/integrations/supabase/client';

/**
 * Process and validate the audio blob for chat
 */
function validateChatAudioBlob(audioBlob: Blob | null): boolean {
  if (!audioBlob) {
    console.error('[ChatAudioProcessing] No audio data to process');
    return false;
  }
  
  if (audioBlob.size < 100) {
    console.error('[ChatAudioProcessing] Audio blob too small');
    return false;
  }
  
  return true;
}

/**
 * Processes an audio recording for chat transcription only
 * Does NOT create journal entries - only returns transcription
 */
export async function processChatVoiceRecording(
  audioBlob: Blob | null, 
  userId: string | undefined
): Promise<{
  success: boolean;
  transcription?: string;
  error?: string;
}> {
  console.log('[ChatAudioProcessing] Starting chat transcription with blob:', audioBlob?.size, audioBlob?.type);
  
  // Validate the audio blob
  if (!validateChatAudioBlob(audioBlob)) {
    return { 
      success: false, 
      error: 'No valid audio data to process' 
    };
  }
  
  if (!userId) {
    return {
      success: false,
      error: 'User authentication required'
    };
  }
  
  try {
    // Convert blob to base64
    const base64Audio = await blobToBase64(audioBlob!);
    
    // Get the duration of the audio
    let recordingTime = 0;
    if ('duration' in audioBlob!) {
      recordingTime = Math.round((audioBlob as any).duration * 1000);
    }
    
    // Prepare the payload for chat transcription
    const payload = {
      audio: base64Audio,
      recordingTime
    };
    
    console.log('[ChatAudioProcessing] Calling transcribe-chat-audio Edge Function');
    
    // Call the chat-specific Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('transcribe-chat-audio', {
      body: payload
    });
    
    if (error) {
      console.error('[ChatAudioProcessing] Edge function error:', error);
      return { success: false, error: error.message };
    }
    
    if (!data || !data.success) {
      console.error('[ChatAudioProcessing] Transcription failed:', data);
      return { success: false, error: data?.error || 'Transcription failed' };
    }
    
    console.log('[ChatAudioProcessing] Transcription successful:', {
      textLength: data.transcription?.length || 0,
      sampleText: data.transcription?.substring(0, 100) + "..."
    });
    
    return { 
      success: true, 
      transcription: data.transcription 
    };
    
  } catch (error: any) {
    console.error('[ChatAudioProcessing] Error processing chat voice recording:', error);
    return { 
      success: false, 
      error: error.message || 'Unknown error during chat transcription' 
    };
  }
}

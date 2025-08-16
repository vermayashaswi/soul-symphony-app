
/**
 * Chat-specific audio processing module
 * Handles transcription for voice chat queries without creating journal entries
 */
import { blobToBase64, normalizeAudioBlob, validateAudioBlob } from './audio/blob-utils';
import { supabase } from '@/integrations/supabase/client';

/**
 * Process and validate the audio blob for chat
 */
function validateChatAudioBlob(audioBlob: Blob | null): boolean {
  if (!audioBlob) {
    console.error('[ChatAudioProcessing] No audio data to process');
    return false;
  }
  
  const validation = validateAudioBlob(audioBlob);
  if (!validation.isValid) {
    console.error('[ChatAudioProcessing] Audio validation failed:', validation.errorMessage);
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
    console.log('[ChatAudioProcessing] Normalizing audio blob before processing...');
    
    // Normalize the audio blob (same as journal)
    let normalizedBlob: Blob;
    try {
      normalizedBlob = await normalizeAudioBlob(audioBlob!);
      console.log('[ChatAudioProcessing] Blob normalized successfully:', {
        type: normalizedBlob.type,
        size: normalizedBlob.size,
        hasDuration: 'duration' in normalizedBlob,
        duration: (normalizedBlob as any).duration || 'unknown'
      });
      
      const validation = validateAudioBlob(normalizedBlob);
      if (!validation.isValid) {
        throw new Error(validation.errorMessage || "Invalid audio data after normalization");
      }
    } catch (error) {
      console.error('[ChatAudioProcessing] Error normalizing audio blob:', error);
      return {
        success: false,
        error: "Error processing audio. Please try again."
      };
    }
    
    // Test base64 conversion before proceeding (same as journal)
    console.log('[ChatAudioProcessing] Testing base64 conversion...');
    let base64Audio: string;
    try {
      base64Audio = await blobToBase64(normalizedBlob);
      console.log('[ChatAudioProcessing] Base64 conversion successful, length:', base64Audio.length);
      
      if (base64Audio.length < 50) {
        return {
          success: false,
          error: 'Audio data appears too short or invalid'
        };
      }
    } catch (error) {
      console.error('[ChatAudioProcessing] Base64 conversion failed:', error);
      return {
        success: false,
        error: 'Error preparing audio data for processing'
      };
    }
    
    // Get the duration of the audio
    let recordingTime = 0;
    if ('duration' in normalizedBlob) {
      recordingTime = Math.round((normalizedBlob as any).duration * 1000);
    } else {
      console.log('[ChatAudioProcessing] No duration found in blob, estimating from recording time');
    }
    
    // Prepare the payload for chat transcription using existing transcribe-audio function
    const payload = {
      audio: base64Audio,
      recordingTime,
      chatMode: true // NEW: This tells the function to skip journal entry creation
    };
    
    console.log('[ChatAudioProcessing] Calling transcribe-audio Edge Function in chat mode with payload:', {
      audioLength: base64Audio.length,
      recordingTime,
      blobSize: normalizedBlob.size,
      blobType: normalizedBlob.type,
      chatMode: true
    });
    
    // Call the existing transcribe-audio Supabase Edge Function with chatMode parameter
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
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

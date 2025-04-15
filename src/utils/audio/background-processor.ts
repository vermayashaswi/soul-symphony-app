
/**
 * Background processor for audio recording
 * Handles the actual API calls and updates to process recordings
 */
import { clearAllToasts } from '@/services/notificationService';
import { supabase } from '@/integrations/supabase/client';
import { setProcessingLock, setIsEntryBeingProcessed } from './processing-state';
import { blobToBase64 } from './blob-utils';
import { setEntryIdForProcessingId } from '../audio-processing';

// Function to process a recording in the background
export async function processRecordingInBackground(
  audioBlob: Blob,
  userId: string | undefined,
  tempId: string
): Promise<{
  success: boolean;
  entryId?: number; 
  error?: string;
}> {
  console.log('[BackgroundProcessor] Starting background processing for tempId:', tempId);
  
  try {
    if (!audioBlob) {
      console.error('[BackgroundProcessor] No audio data to process');
      return { success: false, error: 'No audio data to process' };
    }
    
    if (!userId) {
      console.error('[BackgroundProcessor] User ID is required for processing');
      return { success: false, error: 'User ID is required' };
    }
    
    // Convert audio to base64
    const audioBase64 = await blobToBase64(audioBlob);
    console.log('[BackgroundProcessor] Audio converted to base64, size:', audioBase64.length);
    
    // Call Supabase Edge Function to process the audio
    console.log('[BackgroundProcessor] Calling transcribe-audio function');
    
    const { data: functionData, error: functionError } = await supabase.functions.invoke(
      'transcribe-audio',
      {
        body: {
          audio: audioBase64,
          userId: userId,
          recordingTime: 'duration' in audioBlob ? (audioBlob as any).duration * 1000 : undefined,
          directTranscription: false,
          highQuality: true
        }
      }
    );
    
    if (functionError) {
      console.error('[BackgroundProcessor] Edge function error:', functionError);
      throw new Error(`Edge function error: ${functionError.message}`);
    }
    
    if (!functionData) {
      console.error('[BackgroundProcessor] No data returned from edge function');
      throw new Error('No data returned from processing');
    }
    
    console.log('[BackgroundProcessor] Transcription successful, entryId:', functionData.entryId);
    
    // Create a mapping between the temporary ID and the new entry ID
    if (functionData.entryId) {
      console.log(`[BackgroundProcessor] Setting mapping: tempId ${tempId} -> entryId ${functionData.entryId}`);
      setEntryIdForProcessingId(tempId, functionData.entryId);
      
      // Dispatch an event to immediately update UI components
      window.dispatchEvent(new CustomEvent('processingEntryMapped', {
        detail: { 
          tempId, 
          entryId: functionData.entryId, 
          timestamp: Date.now(),
          isComplete: true 
        }
      }));
    }
    
    // Release the processing locks
    setTimeout(() => {
      setProcessingLock(false);
      setIsEntryBeingProcessed(false);
    }, 500);
    
    return { 
      success: true,
      entryId: functionData.entryId
    };
  } catch (error: any) {
    console.error('[BackgroundProcessor] Error processing recording:', error);
    
    // Clean up on error
    setProcessingLock(false);
    setIsEntryBeingProcessed(false);
    clearAllToasts();
    
    return { 
      success: false, 
      error: error.message || 'Unknown error in background processing' 
    };
  }
}

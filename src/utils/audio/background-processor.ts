
import { blobToBase64 } from './blob-utils';
import { sendAudioForTranscription } from './transcription-service';
import { setProcessingLock, setIsEntryBeingProcessed, updateProcessingEntries } from './processing-state';

/**
 * Processes an audio recording in the background
 * This is the main function that handles the API call to the transcription service
 */
export async function processRecordingInBackground(
  audioBlob: Blob | null,
  userId: string | undefined,
  tempId: string
): Promise<{
  success: boolean;
  entryId?: number;
  error?: string;
}> {
  console.log('[BackgroundProcessor] Starting background processing with tempId:', tempId);
  
  try {
    if (!audioBlob) {
      throw new Error('No audio data to process');
    }
    
    // Ensure the audioBlob has a duration property
    if (!('duration' in audioBlob) || (audioBlob as any).duration <= 0) {
      console.warn('[BackgroundProcessor] Audio blob missing duration property, using default');
    }
    
    // Log the audio details
    console.log('[BackgroundProcessor] Audio blob details:', {
      size: audioBlob.size,
      type: audioBlob.type,
      hasDuration: 'duration' in audioBlob,
      duration: (audioBlob as any).duration || 'unknown'
    });
    
    // Convert blob to base64
    console.log('[BackgroundProcessor] Converting blob to base64');
    const base64Audio = await blobToBase64(audioBlob);
    console.log(`[BackgroundProcessor] Converted to base64 successfully, length: ${base64Audio.length}`);
    
    if (base64Audio.length < 50) {
      throw new Error('Audio data is too small to process');
    }
    
    // Send to transcription service
    console.log('[BackgroundProcessor] Sending to transcription service');
    const result = await sendAudioForTranscription(base64Audio, userId, false);
    
    if (!result.success) {
      console.error('[BackgroundProcessor] Transcription failed:', result.error);
      
      // Clean up processing state
      setIsEntryBeingProcessed(false);
      setProcessingLock(false);
      updateProcessingEntries(tempId, 'remove');
      
      return {
        success: false,
        error: result.error || 'Transcription failed'
      };
    }
    
    // Extract entryId from the result
    const entryId = result.data?.entryId;
    
    if (!entryId) {
      console.error('[BackgroundProcessor] No entry ID returned from transcription service');
      
      // Clean up processing state
      setIsEntryBeingProcessed(false);
      setProcessingLock(false);
      updateProcessingEntries(tempId, 'remove');
      
      return {
        success: false,
        error: 'No entry ID returned from transcription'
      };
    }
    
    console.log(`[BackgroundProcessor] Processing complete for tempId: ${tempId}, got entryId: ${entryId}`);
    
    // Update the processing entries in localStorage
    const updatedEntries = updateProcessingEntries(tempId, 'remove');
    
    // Notify UI that entries have changed
    window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
      detail: { entries: updatedEntries, lastUpdate: Date.now() }
    }));
    
    // Clear processing state
    setIsEntryBeingProcessed(false);
    setProcessingLock(false);
    
    return {
      success: true,
      entryId: entryId
    };
  } catch (error: any) {
    console.error('[BackgroundProcessor] Error in background processing:', error);
    
    // Clean up processing state
    setIsEntryBeingProcessed(false);
    setProcessingLock(false);
    updateProcessingEntries(tempId, 'remove');
    
    return {
      success: false,
      error: error.message || 'Unknown error in background processing'
    };
  }
}

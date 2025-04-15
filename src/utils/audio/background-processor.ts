
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
    
    // Additional validation of audio blob
    console.log('[BackgroundProcessor] Validating audio blob:', {
      size: audioBlob.size,
      type: audioBlob.type,
      isDefined: !!audioBlob
    });
    
    if (audioBlob.size < 100) {
      throw new Error('Audio data is too small to process (size < 100 bytes)');
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
    
    // Notify UI about processing status to ensure placeholder is visible
    window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
      detail: { 
        entries: [tempId], 
        lastUpdate: Date.now(),
        forceUpdate: true 
      }
    }));
    
    // Convert blob to base64
    console.log('[BackgroundProcessor] Converting blob to base64');
    const base64Audio = await blobToBase64(audioBlob);
    console.log(`[BackgroundProcessor] Converted to base64 successfully, length: ${base64Audio.length}`);
    
    if (base64Audio.length < 50) {
      throw new Error('Audio data is too small to process (base64 length < 50)');
    }
    
    // Log a sample of the base64 data to verify it looks right
    console.log('[BackgroundProcessor] Base64 audio sample (first 50 chars):', base64Audio.substring(0, 50));
    
    // Check if the user ID is present for proper storage
    if (!userId) {
      console.warn('[BackgroundProcessor] No user ID provided - entry may not be properly associated');
    }
    
    // Send to transcription service
    console.log('[BackgroundProcessor] Sending to transcription service');
    const result = await sendAudioForTranscription(base64Audio, userId, false);
    
    if (!result.success) {
      console.error('[BackgroundProcessor] Transcription failed:', result.error);
      
      // Log more details about the error
      console.error('[BackgroundProcessor] Transcription error details:', {
        errorMessage: result.error,
        userId: userId || 'not provided',
        audioSize: base64Audio.length,
        tempId
      });
      
      // Clean up processing state
      setIsEntryBeingProcessed(false);
      setProcessingLock(false);
      updateProcessingEntries(tempId, 'remove');
      
      // Notify UI about failed processing
      window.dispatchEvent(new CustomEvent('processingEntryFailed', {
        detail: { 
          tempId, 
          error: result.error,
          timestamp: Date.now()
        }
      }));
      
      return {
        success: false,
        error: result.error || 'Transcription failed'
      };
    }
    
    // Extract entryId from the result
    const entryId = result.data?.entryId;
    
    if (!entryId) {
      console.error('[BackgroundProcessor] No entry ID returned from transcription service');
      console.error('[BackgroundProcessor] Response data:', result.data);
      
      // Clean up processing state
      setIsEntryBeingProcessed(false);
      setProcessingLock(false);
      updateProcessingEntries(tempId, 'remove');
      
      // Notify UI about failed processing
      window.dispatchEvent(new CustomEvent('processingEntryFailed', {
        detail: { 
          tempId, 
          error: 'No entry ID returned from transcription',
          timestamp: Date.now() 
        }
      }));
      
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
    
    // Notify UI about successful processing
    window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
      detail: { 
        tempId, 
        entryId,
        timestamp: Date.now() 
      }
    }));
    
    return {
      success: true,
      entryId: entryId
    };
  } catch (error: any) {
    console.error('[BackgroundProcessor] Error in background processing:', error);
    
    // Log more details about the error
    console.error('[BackgroundProcessor] Processing error details:', {
      errorMessage: error.message,
      errorStack: error.stack,
      userId: userId || 'not provided',
      tempId
    });
    
    // Clean up processing state
    setIsEntryBeingProcessed(false);
    setProcessingLock(false);
    updateProcessingEntries(tempId, 'remove');
    
    // Notify UI about failed processing
    window.dispatchEvent(new CustomEvent('processingEntryFailed', {
      detail: { 
        tempId, 
        error: error.message || 'Unknown error in background processing',
        timestamp: Date.now() 
      }
    }));
    
    return {
      success: false,
      error: error.message || 'Unknown error in background processing'
    };
  }
}

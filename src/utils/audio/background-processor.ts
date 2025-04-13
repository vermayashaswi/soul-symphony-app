
import { blobToBase64 } from './blob-utils';
import { sendAudioForTranscription } from '../audio/transcription-service';
import { 
  resetProcessingState,
  updateProcessingEntries,
  setIsEntryBeingProcessed,
  setProcessingLock
} from './processing-state';
import { toast } from 'sonner';

/**
 * Process a recording in the background
 * This function runs asynchronously and does not block the UI
 */
export async function processRecordingInBackground(
  audioBlob: Blob | null,
  userId: string | undefined,
  tempId: string
): Promise<void> {
  console.log('[BackgroundProcessor] Starting background processing for', tempId);
  
  try {
    if (!audioBlob) {
      throw new Error("No audio data to process");
    }
    
    // Show toast for processing start
    toast.loading('Processing your recording...', {
      id: `processing-${tempId}`,
      duration: 15000
    });
    
    // Convert blob to base64
    console.log('[BackgroundProcessor] Converting audio blob to base64');
    console.log('[BackgroundProcessor] Audio blob type:', audioBlob.type);
    console.log('[BackgroundProcessor] Audio blob size:', audioBlob.size);
    
    const base64Audio = await blobToBase64(audioBlob);
    
    if (!base64Audio) {
      throw new Error("Failed to convert audio to base64");
    }
    
    console.log('[BackgroundProcessor] Audio converted, size:', base64Audio.length);
    
    // Process audio through the transcription service
    console.log('[BackgroundProcessor] Sending audio for transcription and analysis');
    const result = await sendAudioForTranscription(base64Audio, userId);
    
    // Handle the result
    if (result.success) {
      console.log('[BackgroundProcessor] Processing completed successfully');
      toast.success('Recording processed successfully', {
        id: `processing-${tempId}`,
        duration: 3000
      });
    } else {
      console.error('[BackgroundProcessor] Processing failed:', result.error);
      toast.error(`Processing failed: ${result.error || 'Unknown error'}`, {
        id: `processing-${tempId}`,
        duration: 5000
      });
    }
  } catch (error: any) {
    console.error('[BackgroundProcessor] Error in background processing:', error);
    
    toast.error(`Processing error: ${error.message || 'Unknown error'}`, {
      id: `processing-${tempId}`,
      duration: 5000
    });
  } finally {
    console.log('[BackgroundProcessor] Cleaning up processing state');
    // Clean up the processing state
    updateProcessingEntries(tempId, 'remove');
    setIsEntryBeingProcessed(false);
    setProcessingLock(false);
  }
}

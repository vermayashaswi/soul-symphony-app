
import { sendAudioForTranscription } from './transcription-service';
import { updateProcessingEntries } from './processing-state';

/**
 * Processes a recording in the background
 * This allows the UI to remain responsive while processing happens
 */
export async function processRecordingInBackground(
  audioBlob: Blob | null, 
  userId: string | undefined,
  tempId: string
): Promise<void> {
  if (!audioBlob || !userId) {
    console.error('Missing required data for background processing');
    return;
  }
  
  try {
    console.log(`[BackgroundProcessor] Starting processing for ${tempId}`);
    
    // Convert blob to base64
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        try {
          const base64 = reader.result as string;
          const base64Data = base64.split(',')[1]; // Remove data URL prefix
          resolve(base64Data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
    });
    
    reader.readAsDataURL(audioBlob);
    const base64Audio = await base64Promise;
    
    // Send to transcription service
    console.log(`[BackgroundProcessor] Sending to transcription service`);
    const result = await sendAudioForTranscription(base64Audio, userId, false);
    
    if (!result.success) {
      throw new Error(result.error || 'Unknown error in transcription');
    }
    
    console.log(`[BackgroundProcessor] Transcription completed for ${tempId}`);
    console.log(`[BackgroundProcessor] Entry ID: ${result.data?.entryId || 'unknown'}`);
    
    // If we have an entry ID, update the temp ID to include it for future lookups
    if (result.data?.entryId) {
      // Remove old tempId and add new one with entryId included
      updateProcessingEntries(tempId, 'remove');
      const newTempId = `${tempId}-entry${result.data.entryId}`;
      updateProcessingEntries(newTempId, 'add');
      
      // After a reasonable time, remove the processing entry
      setTimeout(() => {
        updateProcessingEntries(newTempId, 'remove');
      }, 10000);
    } else {
      // Remove tempId after processing
      updateProcessingEntries(tempId, 'remove');
    }
    
    return;
  } catch (error) {
    console.error(`[BackgroundProcessor] Error processing ${tempId}:`, error);
    // Clean up the processing entry
    updateProcessingEntries(tempId, 'remove');
    throw error;
  }
}


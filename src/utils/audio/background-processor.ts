
/**
 * Background processing for audio recordings
 */
import { 
  setProcessingLock, 
  setIsEntryBeingProcessed,
  updateProcessingEntries,
  getProcessingTimeoutId,
  setProcessingTimeoutId
} from './processing-state';
import { blobToBase64 } from './blob-utils';
import { verifyUserAuthentication } from './auth-utils';
import { ensureUserProfileExists } from './profile-manager';
import { sendAudioForTranscription } from './transcription-service';
import { triggerThemeExtraction } from './theme-extractor';
import { normalizeAudioBlob } from './blob-utils';
import { clearAllToasts } from '@/services/notificationService';

/**
 * Processes a recording in the background without blocking the UI
 */
export async function processRecordingInBackground(
  audioBlob: Blob | null, 
  userId: string | undefined, 
  tempId: string
): Promise<void> {
  try {
    // Log the blob details for debugging
    console.log('[BackgroundProcessor] Audio blob details:', audioBlob?.type, audioBlob?.size);
    
    if (!audioBlob) {
      console.error('[BackgroundProcessor] No audio data to process');
      cleanupProcessing(tempId);
      return;
    }
    
    // Check if audio blob is too small to be useful
    if (audioBlob.size < 1000) {
      console.error('[BackgroundProcessor] Audio recording is too small to process');
      cleanupProcessing(tempId);
      return;
    }
    
    // 1. Convert blob to base64
    const base64Audio = await blobToBase64(audioBlob);
    
    // Validate base64 data
    if (!base64Audio || base64Audio.length < 100) {
      console.error('[BackgroundProcessor] Invalid base64 audio data');
      cleanupProcessing(tempId);
      return;
    }
    
    // Log the base64 length for debugging
    console.log(`[BackgroundProcessor] Base64 audio data length: ${base64Audio.length}`);
    
    // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
    const base64String = base64Audio.split(',')[1]; 
    
    // 2. Verify user authentication
    const authStatus = await verifyUserAuthentication();
    if (!authStatus.isAuthenticated) {
      console.error('[BackgroundProcessor] User authentication failed:', authStatus.error);
      cleanupProcessing(tempId);
      return;
    }

    console.log('[BackgroundProcessor] User authentication verified:', authStatus.userId);

    // 3. Check if the user profile exists, and create one if it doesn't
    if (authStatus.userId) {
      const profileExists = await ensureUserProfileExists(authStatus.userId);
      if (!profileExists) {
        console.error('[BackgroundProcessor] Failed to ensure user profile exists');
        cleanupProcessing(tempId);
        return;
      }
    } else {
      console.error('[BackgroundProcessor] Cannot identify user ID');
      cleanupProcessing(tempId);
      return;
    }
    
    // 4. Process the full journal entry
    let result;
    let retries = 0;
    const maxRetries = 3; // Increase retry count
    
    while (retries <= maxRetries) {
      try {
        // Set directTranscription to false to get full journal entry processing
        result = await sendAudioForTranscription(base64String, authStatus.userId, false);
        if (result.success) {
          console.log('[BackgroundProcessor] Transcription successful, breaking retry loop');
          break;
        }
        retries++;
        if (retries <= maxRetries) {
          console.log(`[BackgroundProcessor] Transcription attempt ${retries} failed, retrying after delay...`);
          // Increase delay between retries (exponential backoff)
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retries)));
        }
      } catch (err) {
        console.error(`[BackgroundProcessor] Transcription attempt ${retries + 1} error:`, err);
        retries++;
        if (retries <= maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retries)));
        }
      }
    }
    
    if (result?.success) {
      console.log('[BackgroundProcessor] Journal entry saved successfully:', result);
      
      // Remove this entry from localStorage as it's completed
      updateProcessingEntries(tempId, 'remove');
      
      // Manually trigger theme extraction when we have a new entry
      if (result.data?.entryId) {
        await triggerThemeExtraction(result.data.entryId);
      }
    } else {
      console.error('[BackgroundProcessor] Failed to process recording after multiple attempts:', result?.error);
      cleanupProcessing(tempId);
    }
  } catch (error: any) {
    console.error('[BackgroundProcessor] Error processing recording in background:', error);
    cleanupProcessing(tempId);
  } finally {
    // Always release locks
    setIsEntryBeingProcessed(false);
    setProcessingLock(false);
    
    if (getProcessingTimeoutId()) {
      clearTimeout(getProcessingTimeoutId()!);
      setProcessingTimeoutId(null);
    }
  }
}

/**
 * Cleans up after processing completes or fails
 */
function cleanupProcessing(tempId: string): void {
  updateProcessingEntries(tempId, 'remove');
  
  setIsEntryBeingProcessed(false);
  setProcessingLock(false);
  
  if (getProcessingTimeoutId()) {
    clearTimeout(getProcessingTimeoutId()!);
    setProcessingTimeoutId(null);
  }
}

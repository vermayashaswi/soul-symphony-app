
/**
 * Audio recording validation utilities
 */
import { clearAllToasts, ensureAllToastsCleared } from '@/services/unifiedNotificationService';
import { verifyUserAuthentication } from './auth-utils';
import { 
  setProcessingLock, 
  setIsEntryBeingProcessed, 
  setProcessingTimeoutId,
  getProcessingTimeoutId
} from './processing-state';
import { validateAudioBlob } from './blob-utils';

/**
 * Validates the initial state before audio processing
 * Returns a result object with success status and optional error message
 */
export async function validateInitialState(
  audioBlob: Blob | null, 
  userId: string | undefined
): Promise<{
  success: boolean;
  error?: string;
  tempId?: string;
}> {
  // Clear all toasts to ensure UI is clean before processing
  clearAllToasts();
  
  // If there's already a processing operation in progress, wait briefly
  if (await isProcessingLockActive()) {
    console.log('[AudioValidation] Processing lock detected, waiting briefly...');
    
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // If lock is still active after waiting, return an error
      if (await isProcessingLockActive()) {
        console.error('[AudioValidation] Processing lock still active, cannot process multiple recordings simultaneously');
        return { success: false, error: 'Another recording is already being processed' };
      }
    } catch (err) {
      console.error('[AudioValidation] Error waiting for processing lock:', err);
    }
  }
  
  // Validate the audio blob
  const validation = validateAudioBlob(audioBlob);
  if (!validation.isValid) {
    console.error('Audio validation failed:', validation.errorMessage);
    return { success: false, error: validation.errorMessage };
  }
  
  // Verify the user ID is valid
  if (!userId) {
    console.error('No user ID provided for audio processing');
    return { success: false, error: 'Authentication required' };
  }
  
  // Generate a temporary ID for this recording
  const tempId = `temp-${Date.now()}`;
  
  return { success: true, tempId };
}

/**
 * Sets up a timeout to ensure the processing lock is eventually released
 */
export function setupProcessingTimeout(): void {
  // Clear existing timeout if any
  if (getProcessingTimeoutId()) {
    clearTimeout(getProcessingTimeoutId()!);
  }
  
  // Set a timeout to release the lock after a maximum time to prevent deadlocks
  const timeoutId = setTimeout(() => {
    console.log('[AudioValidation] Releasing processing lock due to timeout');
    setProcessingLock(false);
    setIsEntryBeingProcessed(false);
    
    // Note: Do not auto-remove processing entries here to avoid premature UI hiding
    // UI components will be unmounted by actual completion events

  }, 30000); // 30 second maximum lock time
  
  setProcessingTimeoutId(timeoutId);
}

/**
 * Checks if the processing lock is active
 */
async function isProcessingLockActive(): Promise<boolean> {
  const { getProcessingLock } = await import('./processing-state');
  return getProcessingLock();
}

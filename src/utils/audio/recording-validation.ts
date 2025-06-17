
/**
 * Simplified audio recording validation utilities
 */
import { clearAllToasts, ensureAllToastsCleared } from '@/services/notificationService';
import { validateAudioBlob } from './blob-utils';
import { 
  setProcessingLock, 
  setIsEntryBeingProcessed, 
  setProcessingTimeoutId,
  getProcessingTimeoutId
} from './processing-state';

/**
 * Validates the initial state before audio processing
 */
export async function validateInitialState(
  audioBlob: Blob | null, 
  userId: string | undefined
): Promise<{
  success: boolean;
  error?: string;
  tempId?: string;
}> {
  // Clear all toasts
  clearAllToasts();
  
  // Validate the audio blob
  const validation = validateAudioBlob(audioBlob);
  if (!validation.isValid) {
    console.error('[AudioValidation] Audio validation failed:', validation.errorMessage);
    return { success: false, error: validation.errorMessage };
  }
  
  // Verify the user ID
  if (!userId) {
    console.error('[AudioValidation] No user ID provided');
    return { success: false, error: 'Authentication required' };
  }
  
  // Generate a temporary ID
  const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  
  return { success: true, tempId };
}

/**
 * Sets up a timeout to ensure the processing lock is eventually released
 */
export function setupProcessingTimeout(): void {
  // Clear existing timeout
  if (getProcessingTimeoutId()) {
    clearTimeout(getProcessingTimeoutId()!);
  }
  
  // Set timeout to release lock after 30 seconds
  const timeoutId = setTimeout(() => {
    console.log('[AudioValidation] Releasing processing lock due to timeout');
    setProcessingLock(false);
    setIsEntryBeingProcessed(false);
  }, 30000);
  
  setProcessingTimeoutId(timeoutId);
}

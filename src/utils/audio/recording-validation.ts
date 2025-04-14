
import { v4 as uuidv4 } from 'uuid';
import { isProcessingLocked, resetProcessingState } from './processing-state';

/**
 * Validates the initial state before audio processing begins
 */
export async function validateInitialState(audioBlob: Blob | null, userId: string | undefined): Promise<{
  success: boolean;
  tempId?: string;
  error?: string;
}> {
  // Generate a temporary ID for tracking this processing session
  const tempId = `${Date.now()}-${uuidv4()}`;
  
  // Check for processing lock
  if (isProcessingLocked()) {
    console.warn('Processing is already locked. Enforcing reset.');
    resetProcessingState();
  }
  
  // Validate audio blob
  if (!audioBlob) {
    return { success: false, error: 'No audio data provided' };
  }
  
  // Validate user ID
  if (!userId) {
    console.warn('No user ID provided, using anonymous mode');
  }
  
  // Validate blob size
  if (audioBlob.size < 100) {
    return { success: false, error: 'Audio recording is too short' };
  }
  
  return { success: true, tempId };
}

/**
 * Sets up a timeout to prevent processing deadlocks
 */
export function setupProcessingTimeout(): NodeJS.Timeout {
  // Auto-reset after 3 minutes to prevent deadlocks
  return setTimeout(() => {
    console.log('Audio processing max time elapsed, auto-resetting state');
    resetProcessingState();
  }, 3 * 60 * 1000);
}


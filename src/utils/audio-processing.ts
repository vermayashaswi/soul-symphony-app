
/**
 * Main audio processing module
 * Orchestrates the audio recording and transcription process
 */
import { clearAllToasts, ensureAllToastsCleared } from '@/services/notificationService';
import { 
  setProcessingLock, 
  setIsEntryBeingProcessed,
  updateProcessingEntries,
  isProcessingEntry,
  resetProcessingState,
  getProcessingEntries,
  removeProcessingEntryById
} from './audio/processing-state';
import { validateInitialState, setupProcessingTimeout } from './audio/recording-validation';
import { processRecordingInBackground } from './audio/background-processor';

/**
 * Processes an audio recording for transcription and analysis
 * Returns immediately with a temporary ID while processing continues in background
 */
export async function processRecording(audioBlob: Blob | null, userId: string | undefined): Promise<{
  success: boolean;
  tempId?: string;
  error?: string;
}> {
  console.log('[AudioProcessing] Starting processing with blob:', audioBlob?.size, audioBlob?.type);
  
  // Clear all toasts to ensure UI is clean before processing
  clearAllToasts();
  
  // Validate initial state and get tempId
  const validationResult = await validateInitialState(audioBlob, userId);
  if (!validationResult.success) {
    return validationResult;
  }
  
  const tempId = validationResult.tempId!;
  
  try {
    // Set processing lock to prevent multiple simultaneous processing
    setProcessingLock(true);
    setIsEntryBeingProcessed(true);
    
    // Setup timeout to prevent deadlocks
    setupProcessingTimeout();
    
    // Add this entry to localStorage to persist across navigations
    updateProcessingEntries(tempId, 'add');
    
    // Log the audio details
    console.log('Processing audio:', {
      size: audioBlob?.size || 0,
      type: audioBlob?.type || 'unknown',
      userId: userId || 'anonymous'
    });
    
    // Launch the processing without awaiting it
    processRecordingInBackground(audioBlob, userId, tempId)
      .catch(err => {
        console.error('Background processing error:', err);
        setIsEntryBeingProcessed(false);
        setProcessingLock(false);
        
        updateProcessingEntries(tempId, 'remove');
      });
    
    // Return immediately with the temp ID
    return { success: true, tempId };
  } catch (error: any) {
    console.error('Error initiating recording process:', error);
    setIsEntryBeingProcessed(false);
    setProcessingLock(false);
    
    return { success: false, error: error.message || 'Unknown error' };
  }
}

// Re-export useful functions from child modules
export { 
  isProcessingEntry, 
  resetProcessingState, 
  getProcessingEntries,
  removeProcessingEntryById 
} from './audio/processing-state';

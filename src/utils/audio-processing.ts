
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
    console.error('[AudioProcessing] Initial validation failed:', validationResult.error);
    return validationResult;
  }
  
  const tempId = validationResult.tempId!;
  console.log('[AudioProcessing] Generated temporary ID:', tempId);
  
  try {
    // Set processing lock to prevent multiple simultaneous processing
    setProcessingLock(true);
    setIsEntryBeingProcessed(true);
    console.log('[AudioProcessing] Set processing locks');
    
    // Setup timeout to prevent deadlocks
    setupProcessingTimeout();
    console.log('[AudioProcessing] Setup processing timeout');
    
    // Add this entry to localStorage to persist across navigations
    const updatedEntries = updateProcessingEntries(tempId, 'add');
    console.log('[AudioProcessing] Updated processing entries in localStorage:', updatedEntries);
    
    // Log the audio details
    console.log('[AudioProcessing] Processing audio:', {
      size: audioBlob?.size || 0,
      type: audioBlob?.type || 'unknown',
      userId: userId || 'anonymous'
    });
    
    // Launch the processing without awaiting it
    console.log('[AudioProcessing] Launching background processing');
    processRecordingInBackground(audioBlob, userId, tempId)
      .then(result => {
        console.log('[AudioProcessing] Background processing completed:', result);
      })
      .catch(err => {
        console.error('[AudioProcessing] Background processing error:', err);
        setIsEntryBeingProcessed(false);
        setProcessingLock(false);
        
        updateProcessingEntries(tempId, 'remove');
      });
    
    // Return immediately with the temp ID
    console.log('[AudioProcessing] Returning success with tempId:', tempId);
    
    // Force a custom event dispatch to ensure UI updates
    window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
      detail: { entries: updatedEntries, lastUpdate: Date.now(), forceUpdate: true }
    }));
    
    return { success: true, tempId };
  } catch (error: any) {
    console.error('[AudioProcessing] Error initiating recording process:', error);
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

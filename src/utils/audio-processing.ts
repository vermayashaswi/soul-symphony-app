
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
  console.log('[AudioProcessing] Starting processing with blob:', 
             audioBlob ? `${audioBlob.size} bytes, ${audioBlob.type}` : 'null');
  console.log('[AudioProcessing] Blob duration property:', (audioBlob as any)?.duration || 'unknown');
  
  // Validate the audio blob fundamentally
  if (!audioBlob) {
    console.error('[AudioProcessing] No audio blob provided');
    return { success: false, error: 'No audio recording provided' };
  }
  
  if (audioBlob.size < 100) {
    console.error('[AudioProcessing] Audio blob too small:', audioBlob.size, 'bytes');
    return { success: false, error: 'Recording too short or empty' };
  }
  
  // Clear all toasts to ensure UI is clean before processing
  await clearAllToasts();
  
  try {
    // Log the start of the process for debugging
    if (typeof window !== 'undefined') {
      try {
        // Access the debug methods directly from the window object
        if (window.__debugLog && window.__debugLog.addEvent) {
          window.__debugLog.addEvent(
            'audioProcessing', 
            'Started audio processing', 
            'info', 
            { 
              blobSize: audioBlob.size || 0, 
              blobType: audioBlob.type || 'unknown',
              blobDuration: (audioBlob as any)?.duration,
              timestamp: Date.now(),
              userId: userId || 'anonymous' 
            }
          );
        }
      } catch (e) {
        // Ignore errors if debug context is not available
      }
    }
    
    // Validate initial state and get tempId
    const validationResult = await validateInitialState(audioBlob, userId);
    if (!validationResult.success) {
      console.error('[AudioProcessing] Initial validation failed:', validationResult.error);
      return validationResult;
    }
    
    const tempId = validationResult.tempId!;
    console.log('[AudioProcessing] Generated temporary ID:', tempId);
    
    // Debug event for ID generation
    if (typeof window !== 'undefined' && window.__debugLog && window.__debugLog.addEvent) {
      window.__debugLog.addEvent(
        'audioProcessing', 
        'Generated temporary ID', 
        'info', 
        { tempId, timestamp: Date.now() }
      );
    }
    
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
      
      // Extract duration from blob if available, or estimate it
      const blobDuration = typeof (audioBlob as any)?.duration === 'number' ? (audioBlob as any).duration : null;
      const estimatedDuration = blobDuration !== null ? blobDuration : 
                               (audioBlob.size > 0 ? audioBlob.size / 16000 : 0);
      
      // Ensure we have a valid duration
      if (estimatedDuration < 0.1) {
        console.error('[AudioProcessing] Duration too short:', estimatedDuration, 'seconds');
        throw new Error('Recording duration too short');
      }
      
      // Log the audio details with duration
      console.log('[AudioProcessing] Processing audio:', {
        size: audioBlob.size,
        type: audioBlob.type,
        blobDuration: blobDuration,
        estimatedDuration: estimatedDuration,
        userId: userId || 'anonymous'
      });
      
      // Debug event for backend processing
      if (typeof window !== 'undefined' && window.__debugLog && window.__debugLog.addEvent) {
        window.__debugLog.addEvent(
          'audioProcessing', 
          'Starting background processing', 
          'info', 
          { 
            tempId,
            blobSize: audioBlob.size,
            blobDuration: blobDuration,
            estimatedDuration: estimatedDuration,
            timestamp: Date.now()
          }
        );
      }
      
      // Launch the processing without awaiting it
      console.log('[AudioProcessing] Launching background processing');
      const startTime = Date.now();
      
      processRecordingInBackground(audioBlob, userId, tempId, estimatedDuration)
        .then(result => {
          console.log('[AudioProcessing] Background processing completed:', result);
          
          // Debug event for processing completion
          if (typeof window !== 'undefined' && window.__debugLog && window.__debugLog.addEvent) {
            window.__debugLog.addEvent(
              'audioProcessing', 
              'Background processing completed', 
              'success', 
              { 
                tempId,
                result,
                timestamp: Date.now(),
                duration: Date.now() - startTime
              }
            );
          }
        })
        .catch(err => {
          console.error('[AudioProcessing] Background processing error:', err);
          
          // Debug event for processing error
          if (typeof window !== 'undefined' && window.__debugLog && window.__debugLog.addEvent) {
            window.__debugLog.addEvent(
              'audioProcessing', 
              'Background processing error', 
              'error', 
              { 
                tempId,
                error: err?.message || 'Unknown error',
                timestamp: Date.now()
              }
            );
          }
          
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
      
      // Debug event for processing error
      if (typeof window !== 'undefined' && window.__debugLog && window.__debugLog.addEvent) {
        window.__debugLog.addEvent(
          'audioProcessing', 
          'Error initiating recording process', 
          'error', 
          { 
            error: error?.message || 'Unknown error',
            timestamp: Date.now()
          }
        );
      }
      
      return { success: false, error: error.message || 'Unknown error' };
    }
  } catch (error: any) {
    console.error('[AudioProcessing] General error:', error);
    
    // Debug event for general error
    if (typeof window !== 'undefined' && window.__debugLog && window.__debugLog.addEvent) {
      window.__debugLog.addEvent(
        'audioProcessing', 
        'General error in processing', 
        'error', 
        { 
          error: error?.message || 'Unknown error',
          timestamp: Date.now()
        }
      );
    }
    
    return { success: false, error: error.message || 'Unknown error' };
  }
}

// Create access to debug methods in window for global debugging
if (typeof window !== 'undefined') {
  window.__debugLog = window.__debugLog || {};
  
  // Access window object directly without require
  if (!window.__debugLog.addEvent) {
    window.__debugLog.addEvent = (category: string, message: string, level: string, details?: any) => {
      // This is a fallback implementation that logs to console
      console.log(`[${level}] [${category}] ${message}`, details);
    };
  }
}

// Re-export useful functions from child modules
export { 
  isProcessingEntry, 
  resetProcessingState, 
  getProcessingEntries,
  removeProcessingEntryById 
} from './audio/processing-state';

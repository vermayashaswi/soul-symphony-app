
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
import { useDebugLog } from '@/utils/debug/DebugContext';

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
  
  try {
    // For small recordings, add padding to make them viable
    if (audioBlob && audioBlob.size < 200) {
      console.log('[AudioProcessing] Audio blob too small, adding padding');
      // Create a slightly larger blob by adding silence
      const silence = new Uint8Array(2048).fill(0);
      audioBlob = new Blob([audioBlob, silence], { type: audioBlob.type || 'audio/webm;codecs=opus' });
      console.log('[AudioProcessing] New blob size after padding:', audioBlob.size);
    }
    
    // Log the start of the process for debugging
    if (typeof window !== 'undefined') {
      try {
        const DebugContext = require('@/utils/debug/DebugContext');
        const { useDebugLog } = DebugContext;
        
        // Access the add event directly without the hook since we're outside a React component
        if (window.__debugLog && window.__debugLog.addEvent) {
          window.__debugLog.addEvent(
            'audioProcessing', 
            'Started audio processing', 
            'info', 
            { 
              blobSize: audioBlob?.size || 0, 
              blobType: audioBlob?.type || 'unknown',
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
      
      // Log the audio details
      console.log('[AudioProcessing] Processing audio:', {
        size: audioBlob?.size || 0,
        type: audioBlob?.type || 'unknown',
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
            blobSize: audioBlob?.size || 0,
            timestamp: Date.now()
          }
        );
      }
      
      // Launch the processing without awaiting it
      console.log('[AudioProcessing] Launching background processing');
      processRecordingInBackground(audioBlob, userId, tempId)
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
                duration: Date.now() - (result.startTime || Date.now())
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
  
  try {
    // Initialize debug context for global access
    const initDebugContext = () => {
      const { useDebugLog } = require('@/utils/debug/DebugContext');
      
      // Initialize debug methods if not already available
      if (!window.__debugLog.addEvent) {
        window.__debugLog.addEvent = (category, message, level, details) => {
          // This is a fallback implementation that logs to console
          // The real implementation will be set by React components using the hook
          console.log(`[${level}] [${category}] ${message}`, details);
        };
      }
    };
    
    initDebugContext();
  } catch (e) {
    console.error('Error initializing debug context:', e);
  }
}

// Re-export useful functions from child modules
export { 
  isProcessingEntry, 
  resetProcessingState, 
  getProcessingEntries,
  removeProcessingEntryById 
} from './audio/processing-state';

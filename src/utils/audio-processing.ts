/**
 * Main audio processing module
 * Orchestrates the audio recording and transcription process
 */
import { clearAllToasts, ensureAllToastsCleared } from '@/services/notificationService';
import { blobToBase64, validatePayloadSize, validateAudioBlob, testBlobProcessing } from './audio/blob-utils';
import { transcribeAudio } from './audio/transcription-service';
import { processingStateManager, EntryProcessingState } from './journal/processing-state-manager';

// Refactored from original processing-state.ts to simplify
let processingLock = false;
let processingTimeoutId: NodeJS.Timeout | null = null;

// Map to track temporary IDs to entry IDs
const processingToEntryMap = new Map<string, number>();

// Request size limits
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB
const MIN_AUDIO_SIZE = 100; // 100 bytes

/**
 * Enhanced audio blob validation with comprehensive checks
 */
function validateAudioBlobEnhanced(audioBlob: Blob | null): boolean {
  const validation = validateAudioBlob(audioBlob);
  
  if (!validation.isValid) {
    console.error('[AudioProcessing] Audio validation failed:', validation.errorMessage, validation.details);
    return false;
  }
  
  console.log('[AudioProcessing] Audio blob validation passed:', validation.details);
  return true;
}

/**
 * Set up a timeout to release the processing lock if it gets stuck
 */
function setupProcessingTimeout(): NodeJS.Timeout {
  if (processingTimeoutId) {
    clearTimeout(processingTimeoutId);
  }
  
  return setTimeout(() => {
    console.log('[AudioProcessing] Processing timeout triggered - releasing lock');
    processingLock = false;
  }, 60000); // 60 second timeout
}

/**
 * Retry wrapper for processing operations
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[AudioProcessing] Attempt ${attempt}/${maxRetries}`);
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.error(`[AudioProcessing] Attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        console.log(`[AudioProcessing] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }
  
  throw lastError!;
}

/**
 * Processes an audio recording for transcription and analysis
 * Returns immediately with a temporary ID while processing continues in background
 */
export async function processRecording(audioBlob: Blob | null, userId: string | undefined): Promise<{
  success: boolean;
  tempId?: string;
  error?: string;
  debugInfo?: any;
}> {
  console.log('[AudioProcessing] Starting enhanced processing with blob:', audioBlob?.size, audioBlob?.type);
  
  const debugInfo = {
    stage: 'initialization',
    timestamp: Date.now(),
    blobInfo: null,
    validationInfo: null,
    testResults: null,
    processingInfo: null
  };

  try {
    // Clear all toasts to ensure UI is clean before processing
    await ensureAllToastsCleared();
    
    debugInfo.stage = 'input_validation';
    
    // Validate inputs
    if (!userId) {
      console.error('[AudioProcessing] No user ID provided');
      return { 
        success: false, 
        error: 'User authentication required',
        debugInfo
      };
    }
    
    // Enhanced audio blob validation
    if (!validateAudioBlobEnhanced(audioBlob)) {
      return { 
        success: false, 
        error: 'Invalid audio data - please try recording again',
        debugInfo
      };
    }

    debugInfo.blobInfo = {
      size: audioBlob!.size,
      type: audioBlob!.type,
      constructor: audioBlob!.constructor.name,
      hasDuration: 'duration' in audioBlob!
    };

    // Stage 2: Test the complete blob processing pipeline
    console.log('[AudioProcessing] Testing complete blob processing pipeline...');
    debugInfo.stage = 'pipeline_testing';
    
    const pipelineTest = await testBlobProcessing(audioBlob!);
    debugInfo.testResults = pipelineTest;
    
    if (!pipelineTest.success) {
      console.error('[AudioProcessing] Pipeline test failed:', pipelineTest.error);
      return {
        success: false,
        error: 'Audio processing validation failed - please try recording again',
        debugInfo
      };
    }

    console.log('[AudioProcessing] Pipeline test passed successfully');

    // Stage 3: Advanced payload validation
    console.log('[AudioProcessing] Performing advanced payload validation...');
    debugInfo.stage = 'payload_validation';
    
    try {
      const dataUrl = await blobToBase64(audioBlob!);
      
      const testPayload = {
        audio: dataUrl,
        userId,
        recordingTime: (audioBlob as any).duration || 0,
        highQuality: true,
        timestamp: Date.now()
      };
      
      const sizeValidation = validatePayloadSize(testPayload);
      debugInfo.validationInfo = sizeValidation;
      
      console.log('[AudioProcessing] Payload validation result:', sizeValidation);
      
      if (!sizeValidation.isValid) {
        return {
          success: false,
          error: sizeValidation.errorMessage || 'Audio data too large for processing',
          debugInfo
        };
      }
      
    } catch (error) {
      console.error('[AudioProcessing] Pre-processing validation failed:', error);
      debugInfo.validationInfo = { error: error.message };
      return {
        success: false,
        error: 'Error preparing audio data for processing',
        debugInfo
      };
    }
    
    // Generate a unique temporary ID for this processing task
    const timestamp = Date.now();
    const tempId = `entry-${timestamp}-${Math.floor(Math.random() * 1000)}`;
    
    debugInfo.stage = 'processing_setup';
    
    // Set processing lock to prevent multiple simultaneous processing
    processingLock = true;
    console.log('[AudioProcessing] Set processing lock');
    
    // Setup timeout to prevent deadlocks
    processingTimeoutId = setupProcessingTimeout();
    console.log('[AudioProcessing] Setup processing timeout');
    
    // Register this entry with our processing state manager
    processingStateManager.startProcessing(tempId);
    
    // Log the audio details
    console.log('[AudioProcessing] Processing audio:', {
      size: audioBlob?.size || 0,
      type: audioBlob?.type || 'unknown',
      userId: userId || 'anonymous',
      audioDuration: (audioBlob as any).duration || 'unknown',
      tempId
    });
    
    debugInfo.processingInfo = {
      tempId,
      lockSet: true,
      timeoutSet: true,
      stateRegistered: true
    };
    
    // Launch the enhanced processing without awaiting it
    console.log('[AudioProcessing] Launching enhanced background processing');
    processRecordingInBackgroundEnhanced(audioBlob!, userId, tempId, debugInfo)
      .then(result => {
        console.log('[AudioProcessing] Background processing completed:', result);
        
        if (result.entryId) {
          processingStateManager.setEntryId(tempId, result.entryId);
          processingStateManager.updateEntryState(tempId, EntryProcessingState.COMPLETED);
          console.log(`[AudioProcessing] Mapped tempId ${tempId} to entryId ${result.entryId}`);
          
          setEntryIdForProcessingId(tempId, result.entryId);
        }
      })
      .catch(err => {
        console.error('[AudioProcessing] Background processing error:', err);
        processingLock = false;
        
        processingStateManager.updateEntryState(tempId, EntryProcessingState.ERROR, err.message);
        
        window.dispatchEvent(new CustomEvent('processingEntryFailed', {
          detail: { tempId, error: err.message, timestamp: Date.now() }
        }));
      })
      .finally(() => {
        processingLock = false;
        if (processingTimeoutId) {
          clearTimeout(processingTimeoutId);
          processingTimeoutId = null;
        }
      });
    
    console.log('[AudioProcessing] Returning success with tempId:', tempId);
    
    return { 
      success: true, 
      tempId,
      debugInfo
    };
    
  } catch (error: any) {
    console.error('[AudioProcessing] Error initiating recording process:', error);
    processingLock = false;
    
    debugInfo.processingInfo = {
      error: error.message,
      stage: debugInfo.stage
    };
    
    return { 
      success: false, 
      error: error.message || 'Unknown error',
      debugInfo
    };
  }
}

/**
 * Enhanced background processing with comprehensive error handling and logging
 */
async function processRecordingInBackgroundEnhanced(
  audioBlob: Blob,
  userId: string,
  tempId: string,
  initialDebugInfo: any
): Promise<{ success: boolean; entryId?: number; error?: string }> {
  try {
    console.log(`[AudioProcessing] Enhanced background processing started for ${tempId}`);
    
    const result = await withRetry(async () => {
      return await transcribeAudio(audioBlob, userId);
    }, 3, 2000);
    
    console.log(`[AudioProcessing] Enhanced transcription result for ${tempId}:`, {
      success: result.success,
      entryId: result.entryId,
      hasTranscription: !!result.transcription,
      hasRefinedText: !!result.refinedText,
      hasDebugInfo: !!result.debugInfo
    });
    
    if (!result.success) {
      console.error('[AudioProcessing] Transcription failed:', result.error);
      console.log('[AudioProcessing] Debug info:', result.debugInfo);
      throw new Error(result.error || 'Transcription service failed');
    }
    
    if (result.entryId) {
      processingStateManager.setEntryId(tempId, result.entryId);
      processingStateManager.updateEntryState(tempId, EntryProcessingState.COMPLETED);
      setEntryIdForProcessingId(tempId, result.entryId);
    }
    
    // Notify components that processing is complete
    window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
      detail: { 
        tempId, 
        entryId: result.entryId, 
        timestamp: Date.now() 
      }
    }));
    
    window.dispatchEvent(new CustomEvent('entryContentReady', {
      detail: { 
        tempId, 
        entryId: result.entryId, 
        content: result.refinedText || result.transcription, 
        timestamp: Date.now() 
      }
    }));
    
    window.dispatchEvent(new CustomEvent('journalEntriesNeedRefresh', {
      detail: { 
        tempId, 
        entryId: result.entryId, 
        timestamp: Date.now() 
      }
    }));
    
    return { 
      success: true, 
      entryId: result.entryId 
    };
    
  } catch (error: any) {
    console.error(`[AudioProcessing] Enhanced background processing failed for ${tempId}:`, error);
    
    let userFriendlyError = 'Processing failed - please try again';
    
    if (error.message?.includes('network') || error.message?.includes('fetch')) {
      userFriendlyError = 'Network error - please check your connection';
    } else if (error.message?.includes('auth') || error.message?.includes('session')) {
      userFriendlyError = 'Session expired - please log in again';
    } else if (error.message?.includes('audio') || error.message?.includes('base64')) {
      userFriendlyError = 'Audio format error - please try recording again';
    } else if (error.message?.includes('too large')) {
      userFriendlyError = 'Audio file too large - please record a shorter message';
    }
    
    processingStateManager.updateEntryState(tempId, EntryProcessingState.ERROR, userFriendlyError);
    
    return { 
      success: false, 
      error: userFriendlyError 
    };
  }
}

/**
 * Set entry ID for a processing ID (temp ID)
 */
export function setEntryIdForProcessingId(tempId: string, entryId: number): void {
  processingToEntryMap.set(tempId, entryId);
  
  processingStateManager.setEntryId(tempId, entryId);
  processingStateManager.updateEntryState(tempId, EntryProcessingState.COMPLETED);
  
  try {
    const mapStr = localStorage.getItem('processingToEntryMap') || '{}';
    const map = JSON.parse(mapStr);
    map[tempId] = entryId;
    localStorage.setItem('processingToEntryMap', JSON.stringify(map));
    console.log(`[AudioProcessing] Stored tempId -> entryId mapping in localStorage: ${tempId} -> ${entryId}`);
    
    window.dispatchEvent(new CustomEvent('processingEntryMapped', {
      detail: { 
        tempId, 
        entryId, 
        timestamp: Date.now(),
        forceNotify: true 
      }
    }));
  } catch (error) {
    console.error('[AudioProcessing] Error storing mapping in localStorage:', error);
  }
}

/**
 * Get entry ID for a processing ID (temp ID)
 */
export function getEntryIdForProcessingId(tempId: string): number | undefined {
  const entryFromManager = processingStateManager.getEntryId(tempId);
  if (entryFromManager) {
    return entryFromManager;
  }
  
  if (processingToEntryMap.has(tempId)) {
    return processingToEntryMap.get(tempId);
  }
  
  try {
    const mapStr = localStorage.getItem('processingToEntryMap') || '{}';
    const map = JSON.parse(mapStr);
    const entryId = map[tempId];
    
    if (entryId) {
      processingToEntryMap.set(tempId, Number(entryId));
      processingStateManager.setEntryId(tempId, Number(entryId));
      return Number(entryId);
    }
  } catch (error) {
    console.error('[AudioProcessing] Error getting mapping from localStorage:', error);
  }
  
  return undefined;
}

/**
 * Check if processing is currently in progress
 */
export function isProcessingEntry(): boolean {
  return processingLock;
}

/**
 * Reset processing state (useful for recovery)
 */
export function resetProcessingState(): void {
  console.log('[AudioProcessing] Manually resetting processing state');
  processingLock = false;
  
  if (processingTimeoutId) {
    clearTimeout(processingTimeoutId);
    processingTimeoutId = null;
  }
  
  processingStateManager.clearAll();
}

/**
 * Remove a processing entry by ID
 */
export function removeProcessingEntryById(entryId: number | string): void {
  const entryIdString = entryId.toString();
  processingStateManager.removeEntry(entryIdString);
  
  if (typeof entryId === 'number') {
    for (const [tempId, mappedId] of processingToEntryMap.entries()) {
      if (mappedId === entryId) {
        processingToEntryMap.delete(tempId);
        console.log(`[AudioProcessing] Removed mapping for tempId ${tempId} -> entryId ${entryId}`);
      }
    }
    
    try {
      const mapStr = localStorage.getItem('processingToEntryMap') || '{}';
      const map = JSON.parse(mapStr);
      let modified = false;
      
      Object.entries(map).forEach(([tempId, mappedId]) => {
        if (Number(mappedId) === entryId) {
          delete map[tempId];
          modified = true;
        }
      });
      
      if (modified) {
        localStorage.setItem('processingToEntryMap', JSON.stringify(map));
        console.log(`[AudioProcessing] Cleaned up localStorage mappings for entryId ${entryId}`);
      }
    } catch (error) {
      console.error('[AudioProcessing] Error cleaning up localStorage mappings:', error);
    }
  }
  
  window.dispatchEvent(new CustomEvent('processingEntryRemoved', {
    detail: {
      id: entryId,
      timestamp: Date.now()
    }
  }));
}

/**
 * Debug publisher for voice recording process
 */
export function publishDebugEvent(category: string, action: string, details: string) {
  try {
    const event = new CustomEvent('voiceRecorderDebug', {
      detail: {
        category,
        action,
        details,
        timestamp: Date.now()
      }
    });
    
    window.dispatchEvent(event);
    console.log(`[Debug] ${category}: ${action} - ${details}`);
  } catch (error) {
    console.error('Error publishing debug event:', error);
  }
}

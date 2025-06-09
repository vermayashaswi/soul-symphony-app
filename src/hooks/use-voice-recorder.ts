
/**
 * Enhanced voice recorder hook with proper state management
 */
import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { transcribeAudio } from '@/services/transcription-service';
import { processingStateManager } from '@/utils/journal/processing-state-manager';
import { toast } from 'sonner';

export interface VoiceRecorderResult {
  success: boolean;
  tempId?: string;
  entryId?: number;
  error?: string;
}

export function useVoiceRecorder() {
  const [isSaving, setIsSaving] = useState(false);
  const [lastTempId, setLastTempId] = useState<string | null>(null);
  const processingRef = useRef<boolean>(false);
  
  const { user } = useAuth();
  
  const processRecording = useCallback(async (
    audioBlob: Blob
  ): Promise<VoiceRecorderResult> => {
    if (!user?.id) {
      toast.error('You must be logged in to save recordings');
      return { success: false, error: 'Not authenticated' };
    }
    
    if (processingRef.current) {
      console.log('[useVoiceRecorder] Processing already in progress, ignoring duplicate request');
      return { success: false, error: 'Already processing' };
    }
    
    // Generate unique temporary ID
    const tempId = `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log(`[useVoiceRecorder] Starting processing for tempId: ${tempId}`);
      
      // Set processing flags
      processingRef.current = true;
      setIsSaving(true);
      setLastTempId(tempId);
      
      // CRITICAL: Start processing state immediately
      processingStateManager.startProcessing(tempId);
      
      // Dispatch immediate processing event
      window.dispatchEvent(new CustomEvent('immediateProcessingStarted', {
        detail: { tempId, source: 'voice-recorder', timestamp: Date.now() }
      }));
      
      // Call transcription service
      const result = await transcribeAudio(audioBlob, user.id, tempId);
      
      if (result.success && result.entryId) {
        console.log(`[useVoiceRecorder] Processing successful: ${tempId} -> ${result.entryId}`);
        
        return {
          success: true,
          tempId,
          entryId: result.entryId
        };
      } else {
        console.error(`[useVoiceRecorder] Processing failed for ${tempId}:`, result.error);
        
        return {
          success: false,
          tempId,
          error: result.error
        };
      }
      
    } catch (error: any) {
      console.error(`[useVoiceRecorder] Unexpected error for ${tempId}:`, error);
      
      // Update processing state to error
      processingStateManager.updateEntryState(tempId, 'error', error.message);
      
      return {
        success: false,
        tempId,
        error: error.message
      };
      
    } finally {
      // Always clean up flags
      processingRef.current = false;
      setIsSaving(false);
      
      console.log(`[useVoiceRecorder] Processing cleanup completed for ${tempId}`);
    }
  }, [user?.id]);
  
  const retryLastRecording = useCallback(async () => {
    if (!lastTempId) {
      toast.error('No recording to retry');
      return { success: false, error: 'No recording to retry' };
    }
    
    console.log(`[useVoiceRecorder] Retrying recording: ${lastTempId}`);
    processingStateManager.retryProcessing(lastTempId);
    
    return { success: true, tempId: lastTempId };
  }, [lastTempId]);
  
  const cancelProcessing = useCallback((tempId?: string) => {
    const targetTempId = tempId || lastTempId;
    
    if (targetTempId) {
      console.log(`[useVoiceRecorder] Cancelling processing: ${targetTempId}`);
      processingStateManager.removeEntry(targetTempId);
      
      if (targetTempId === lastTempId) {
        setLastTempId(null);
      }
    }
    
    processingRef.current = false;
    setIsSaving(false);
  }, [lastTempId]);
  
  return {
    isSaving,
    lastTempId,
    isProcessing: processingRef.current,
    processRecording,
    retryLastRecording,
    cancelProcessing
  };
}


/**
 * Enhanced transcription service with proper event dispatch and error handling
 */
import { supabase } from '@/integrations/supabase/client';
import { blobToBase64 } from '@/utils/audio/blob-utils';
import { processingStateManager, EntryProcessingState } from '@/utils/journal/processing-state-manager';
import { toast } from 'sonner';

export interface TranscriptionResult {
  success: boolean;
  entryId?: number;
  content?: string;
  error?: string;
  tempId?: string;
}

/**
 * Enhanced transcription function with proper state management
 */
export async function transcribeAudio(
  audioBlob: Blob, 
  userId: string,
  tempId: string
): Promise<TranscriptionResult> {
  console.log(`[TranscriptionService] Starting transcription for tempId: ${tempId}`);
  
  try {
    // Ensure processing state is set
    processingStateManager.startProcessing(tempId);
    
    // Convert blob to base64
    const base64Audio = await blobToBase64(audioBlob);
    
    // Get duration from blob if available
    const duration = (audioBlob as any).duration || 0;
    
    // Prepare form data for the edge function
    const formData = new FormData();
    const audioFile = new File([audioBlob], 'recording.webm', { type: audioBlob.type });
    formData.append('audio', audioFile);
    formData.append('userId', userId);
    
    console.log(`[TranscriptionService] Calling transcribe-audio edge function for ${tempId}`);
    
    // Call the edge function
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: formData
    });
    
    if (error) {
      console.error(`[TranscriptionService] Edge function error for ${tempId}:`, error);
      
      // Update processing state to error
      processingStateManager.updateEntryState(tempId, EntryProcessingState.ERROR, error.message);
      
      // Show user-friendly error
      toast.error('Recording failed to process. Please try again.');
      
      return { 
        success: false, 
        error: error.message,
        tempId 
      };
    }
    
    if (!data || !data.success) {
      console.error(`[TranscriptionService] Invalid response for ${tempId}:`, data);
      
      const errorMsg = data?.error || 'Unknown processing error';
      processingStateManager.updateEntryState(tempId, EntryProcessingState.ERROR, errorMsg);
      
      toast.error('Recording could not be processed. Please try again.');
      
      return { 
        success: false, 
        error: errorMsg,
        tempId 
      };
    }
    
    console.log(`[TranscriptionService] Success for ${tempId}:`, {
      entryId: data.entryId,
      hasContent: !!data.refinedText || !!data.transcription
    });
    
    // CRITICAL: Update processing state with entry ID
    if (data.entryId) {
      processingStateManager.setEntryId(tempId, data.entryId);
      processingStateManager.updateEntryState(tempId, EntryProcessingState.COMPLETED);
      
      console.log(`[TranscriptionService] Set entryId ${data.entryId} for tempId ${tempId}`);
    }
    
    // CRITICAL: Dispatch completion events for UI updates
    window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
      detail: { 
        tempId, 
        entryId: data.entryId, 
        content: data.refinedText || data.transcription,
        timestamp: Date.now() 
      }
    }));
    
    // Dispatch data-ready event
    window.dispatchEvent(new CustomEvent('entryContentReady', {
      detail: { 
        tempId, 
        entryId: data.entryId, 
        content: data.refinedText || data.transcription, 
        audioUrl: data.audioUrl,
        timestamp: Date.now() 
      }
    }));
    
    // Trigger journal entries refresh
    window.dispatchEvent(new CustomEvent('journalEntriesNeedRefresh', {
      detail: { 
        tempId, 
        entryId: data.entryId, 
        source: 'transcription-complete',
        timestamp: Date.now() 
      }
    }));
    
    // Show success message
    toast.success('Recording processed successfully!');
    
    return {
      success: true,
      entryId: data.entryId,
      content: data.refinedText || data.transcription,
      tempId
    };
    
  } catch (error: any) {
    console.error(`[TranscriptionService] Unexpected error for ${tempId}:`, error);
    
    // Update processing state to error
    processingStateManager.updateEntryState(tempId, EntryProcessingState.ERROR, error.message);
    
    // Show user-friendly error
    toast.error('An unexpected error occurred. Please try again.');
    
    // Dispatch error event
    window.dispatchEvent(new CustomEvent('processingEntryFailed', {
      detail: { 
        tempId, 
        error: error.message, 
        timestamp: Date.now() 
      }
    }));
    
    return {
      success: false,
      error: error.message,
      tempId
    };
  }
}

/**
 * Retry failed transcription
 */
export async function retryTranscription(tempId: string): Promise<void> {
  console.log(`[TranscriptionService] Retrying transcription for ${tempId}`);
  
  // Reset processing state
  processingStateManager.retryProcessing(tempId);
  
  // The actual retry would need the original audio blob and userId
  // This would typically be handled by the calling component
  toast.info('Retrying transcription...');
}

/**
 * Cancel ongoing transcription
 */
export async function cancelTranscription(tempId: string): Promise<void> {
  console.log(`[TranscriptionService] Cancelling transcription for ${tempId}`);
  
  // Remove from processing state
  processingStateManager.removeEntry(tempId);
  
  // Dispatch cancellation event
  window.dispatchEvent(new CustomEvent('processingEntryCancelled', {
    detail: { tempId, timestamp: Date.now() }
  }));
  
  toast.info('Transcription cancelled');
}

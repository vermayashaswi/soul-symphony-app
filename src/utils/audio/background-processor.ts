
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  setProcessingLock, 
  setIsEntryBeingProcessed,
  updateProcessingEntries,
  resetProcessingState
} from './processing-state';
import { sendAudioForTranscription } from './transcription-service';

/**
 * Process recording in the background
 * This is separated from the main flow to avoid UI freezes
 */
export async function processRecordingInBackground(
  audioBlob: Blob | null, 
  userId: string | undefined, 
  tempId: string
): Promise<void> {
  try {
    console.log('[BackgroundProcessor] Starting background processing for tempId:', tempId);
    
    if (!audioBlob) {
      throw new Error('No audio blob provided');
    }

    if (!userId) {
      console.warn('[BackgroundProcessor] No user ID provided, proceeding with anonymous processing');
    }

    const debugEvent = new CustomEvent('debug:audio-processing', {
      detail: {
        step: 'start',
        tempId,
        timestamp: Date.now(),
        audioSize: audioBlob.size,
        audioType: audioBlob.type
      }
    });
    window.dispatchEvent(debugEvent);

    // Validate audio blob
    if (audioBlob.size === 0) {
      throw new Error('Empty audio blob');
    }

    // Convert audio to base64
    const reader = new FileReader();
    
    let base64Audio = '';
    try {
      await new Promise<void>((resolve, reject) => {
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            base64Audio = reader.result;
            resolve();
          } else {
            reject(new Error('FileReader did not return a string'));
          }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(audioBlob);
      });
    } catch (error) {
      console.error('[BackgroundProcessor] Error reading audio file:', error);
      throw new Error('Failed to read audio file');
    }
    
    if (!base64Audio) {
      throw new Error('Failed to convert audio to base64');
    }
    
    console.log('[BackgroundProcessor] Audio converted to base64, length:', base64Audio.length);
    
    window.dispatchEvent(new CustomEvent('debug:audio-processing', {
      detail: {
        step: 'base64-conversion',
        tempId,
        timestamp: Date.now(),
        base64Length: base64Audio.length
      }
    }));
    
    // Send audio to transcription service
    console.log('[BackgroundProcessor] Sending audio to transcription service for processing');
    
    const transcriptionResult = await sendAudioForTranscription(base64Audio, userId);
    
    window.dispatchEvent(new CustomEvent('debug:audio-processing', {
      detail: {
        step: 'transcription-complete',
        tempId,
        timestamp: Date.now(),
        success: transcriptionResult.success,
        hasError: !!transcriptionResult.error,
        errorMessage: transcriptionResult.error,
        hasData: !!transcriptionResult.data,
        entryId: transcriptionResult.data?.entryId
      }
    }));
    
    if (!transcriptionResult.success) {
      // Handle transcription failure
      console.error('[BackgroundProcessor] Transcription failed:', transcriptionResult.error);
      
      toast.error('Failed to process audio', {
        description: transcriptionResult.error || 'Unknown error occurred',
        duration: 5000
      });
      
      // Clean up processing state
      updateProcessingEntries(tempId, 'remove');
      setIsEntryBeingProcessed(false);
      setProcessingLock(false);
      
      throw new Error(transcriptionResult.error || 'Transcription failed');
    }
    
    // Success path
    console.log('[BackgroundProcessor] Processing completed successfully', {
      entryId: transcriptionResult.data?.entryId,
      hasTranscription: !!transcriptionResult.data?.transcription,
      transcriptionLength: transcriptionResult.data?.transcription?.length || 0
    });
    
    // Show success notification
    toast.success('Entry saved successfully', {
      description: 'Your journal entry has been processed and saved',
      duration: 4000
    });
    
    // Clean up processing state
    updateProcessingEntries(tempId, 'remove');
    setIsEntryBeingProcessed(false);
    setProcessingLock(false);
    
    // Manually trigger a refetch of entries
    window.dispatchEvent(new CustomEvent('refetchJournalEntries'));
    
  } catch (error: any) {
    console.error('[BackgroundProcessor] Error in background processing:', error);
    
    // Handle errors that weren't caught earlier
    toast.error('Error processing audio', {
      description: error.message || 'An unexpected error occurred',
      duration: 5000
    });
    
    // Ensure processing state is cleaned up
    updateProcessingEntries(tempId, 'remove');
    setIsEntryBeingProcessed(false);
    setProcessingLock(false);
    
    window.dispatchEvent(new CustomEvent('debug:audio-processing', {
      detail: {
        step: 'error',
        tempId,
        timestamp: Date.now(),
        error: error.message,
        stack: error.stack
      }
    }));
  }
}

// Re-export useful functions from child modules
export { resetProcessingState };

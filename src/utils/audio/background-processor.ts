
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { resetProcessingState, setProcessingLock, updateProcessingEntries } from './processing-state';
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
    
    console.log('[BackgroundProcessor] Sending audio to transcription service for processing');
    
    // Calculate recording duration in seconds from blob
    const recordingTimeMs = audioBlob.size > 0 
      ? (audioBlob as any).duration ? (audioBlob as any).duration * 1000 
      : (audioBlob.size / 16000) * 1000 
      : 0;
    
    window.dispatchEvent(new CustomEvent('debug:audio-processing', {
      detail: {
        step: 'pre-transcription',
        tempId,
        timestamp: Date.now(),
        recordingTimeMs,
        audioType: audioBlob.type,
        audioSize: audioBlob.size
      }
    }));
    
    // Use the transcription service to process the audio
    const { success, data, error } = await sendAudioForTranscription(base64Audio, userId);
    
    window.dispatchEvent(new CustomEvent('debug:audio-processing', {
      detail: {
        step: 'post-transcription',
        tempId,
        timestamp: Date.now(),
        success,
        error: error || null,
        hasData: !!data,
        entryId: data?.entryId,
        transcriptionLength: data?.transcription?.length || 0,
        refinedTextLength: data?.refinedText?.length || 0
      }
    }));
    
    if (!success || error) {
      console.error('[BackgroundProcessor] Error processing audio:', error);
      throw new Error(error || 'Unknown error in audio processing');
    }
    
    // Add detailed logging to track successful processing
    console.log('[BackgroundProcessor] Audio processing complete for tempId:', tempId);
    console.log('[BackgroundProcessor] Result:', data);
    console.log('[BackgroundProcessor] EntryId:', data?.entryId);
    console.log('[BackgroundProcessor] Transcription length:', data?.transcription?.length || 0);
    console.log('[BackgroundProcessor] Refined text length:', data?.refinedText?.length || 0);
    console.log('[BackgroundProcessor] Audio URL:', data?.audioUrl || 'Not stored');
    
    window.dispatchEvent(new CustomEvent('debug:audio-processing', {
      detail: {
        step: 'complete',
        tempId,
        timestamp: Date.now(),
        entryId: data?.entryId,
        transcriptionLength: data?.transcription?.length || 0,
        refinedTextLength: data?.refinedText?.length || 0,
        audioUrl: data?.audioUrl
      }
    }));
    
    // Display success notification
    toast.success('Entry successfully processed and saved!', {
      id: `success-${tempId}`,
      duration: 3000,
    });
    
    // Stop tracking this processing task
    updateProcessingEntries(tempId, 'remove');
    
  } catch (error: any) {
    console.error('[BackgroundProcessor] Processing error:', error);
    
    window.dispatchEvent(new CustomEvent('debug:audio-processing', {
      detail: {
        step: 'error',
        tempId,
        timestamp: Date.now(),
        error: error?.message || 'Unknown error',
        stack: error?.stack
      }
    }));
    
    toast.error('Failed to process recording: ' + (error?.message || 'Unknown error'), {
      id: `error-${tempId}`,
      duration: 3000,
    });
    
    // Remove from processing entries regardless of success/failure
    updateProcessingEntries(tempId, 'remove');
    
  } finally {
    setProcessingLock(false);
    
    // Check if this was the last processing entry and clean up state if so
    const remainingProcessingEntries = localStorage.getItem('processingEntries');
    if (!remainingProcessingEntries || remainingProcessingEntries === '[]') {
      resetProcessingState();
    }
    
    window.dispatchEvent(new CustomEvent('debug:audio-processing', {
      detail: {
        step: 'cleanup',
        tempId,
        timestamp: Date.now()
      }
    }));
  }
}

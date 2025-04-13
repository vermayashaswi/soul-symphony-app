
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
      throw new Error('No user ID provided');
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

    // Convert audio to base64
    const reader = new FileReader();
    
    await new Promise<void>((resolve, reject) => {
      reader.onloadend = () => resolve();
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });
    
    if (!reader.result) {
      throw new Error('Failed to read audio file');
    }
    
    // Extract base64 content without the data URL prefix
    const base64Audio = (reader.result as string).split(',')[1];
    
    if (!base64Audio) {
      throw new Error('Invalid base64 audio data');
    }
    
    console.log('[BackgroundProcessor] Audio converted to base64');
    
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
        recordingTimeMs
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
    
    window.dispatchEvent(new CustomEvent('debug:audio-processing', {
      detail: {
        step: 'complete',
        tempId,
        timestamp: Date.now(),
        entryId: data?.entryId,
        transcriptionLength: data?.transcription?.length || 0,
        refinedTextLength: data?.refinedText?.length || 0
      }
    }));
    
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
    
    toast.error('Failed to process recording', {
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

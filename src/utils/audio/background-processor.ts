
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { resetProcessingState, setProcessingLock, updateProcessingEntries } from './processing-state';

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
    console.log('[BackgroundProcessor] Sending audio to transcribe function');
    
    // Calculate recording duration in seconds from blob
    // Since Blob doesn't have a duration property, we need to estimate it differently
    // We can calculate based on the audio blob size and sample rate as an approximation
    const recordingTimeMs = audioBlob.size > 0 
      ? (audioBlob as any).duration ? (audioBlob as any).duration * 1000 // Use custom duration if available
      : (audioBlob.size / 16000) * 1000 // Estimate based on size and 16kHz sample rate
      : 0;
    
    // Invoke the Supabase function to process the audio
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: {
        audio: base64Audio,
        userId: userId,
        recordingTime: recordingTimeMs
      }
    });
    
    if (error) {
      console.error('[BackgroundProcessor] Error invoking transcribe-audio function:', error);
      throw error;
    }
    
    console.log('[BackgroundProcessor] Audio processing complete for tempId:', tempId);
    console.log('[BackgroundProcessor] Result:', data ? 'Success' : 'Empty result');
    
    // Stop tracking this processing task
    updateProcessingEntries(tempId, 'remove');
    
  } catch (error: any) {
    console.error('[BackgroundProcessor] Processing error:', error);
    
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
  }
}

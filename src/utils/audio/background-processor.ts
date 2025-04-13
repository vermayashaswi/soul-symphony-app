

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
    console.log('[BackgroundProcessor] User ID:', userId || 'undefined');
    
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
    
    console.log('[BackgroundProcessor] Audio converted to base64, size:', base64Audio.length);
    console.log('[BackgroundProcessor] Audio blob details:', {
      size: audioBlob.size,
      type: audioBlob.type,
      duration: (audioBlob as any).duration || 'unknown'
    });
    
    // Calculate recording duration in seconds from blob
    const recordingTimeMs = audioBlob.size > 0 
      ? (audioBlob as any).duration ? (audioBlob as any).duration * 1000 // Use custom duration if available
      : (audioBlob.size / 16000) * 1000 // Estimate based on size and 16kHz sample rate
      : 0;
    
    console.log('[BackgroundProcessor] Estimated recording time:', recordingTimeMs, 'ms');
    
    // Use our transcription service directly instead of calling the edge function again
    console.log('[BackgroundProcessor] Sending audio for full transcription using transcription service');
    
    const result = await sendAudioForTranscription(base64Audio, userId, false);
    
    if (!result.success) {
      console.error('[BackgroundProcessor] Transcription service error:', result.error);
      throw new Error(result.error || 'Failed to transcribe audio');
    }
    
    const data = result.data;
    
    console.log('[BackgroundProcessor] Transcription service response received');
    
    // Add detailed logging to track successful processing
    console.log('[BackgroundProcessor] Audio processing complete for tempId:', tempId);
    console.log('[BackgroundProcessor] Result:', data);
    console.log('[BackgroundProcessor] EntryId:', data?.entryId);
    console.log('[BackgroundProcessor] Transcription length:', data?.transcription?.length || 0);
    console.log('[BackgroundProcessor] Refined text length:', data?.refinedText?.length || 0);
    console.log('[BackgroundProcessor] Predicted languages:', data?.predictedLanguages || 'None');
    
    if (!data.entryId) {
      console.error('[BackgroundProcessor] No entry ID returned from server');
      throw new Error('Failed to create journal entry');
    }
    
    // Stop tracking this processing task
    updateProcessingEntries(tempId, 'remove');
    
    toast.success('Journal entry created successfully', {
      id: `success-${tempId}`,
      duration: 3000,
    });
    
  } catch (error: any) {
    console.error('[BackgroundProcessor] Processing error:', error);
    console.error('[BackgroundProcessor] Error details:', error.message || 'Unknown error');
    
    toast.error('Failed to process recording: ' + (error.message || 'Unknown error'), {
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

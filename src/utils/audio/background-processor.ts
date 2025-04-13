
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
  tempId: string,
  useGoogleSTT: boolean = false
): Promise<void> {
  try {
    console.log('[BackgroundProcessor] Starting background processing for tempId:', tempId);
    console.log('[BackgroundProcessor] Using Google STT:', useGoogleSTT ? 'Yes' : 'No');
    
    if (!audioBlob) {
      throw new Error('No audio blob provided');
    }

    if (!userId) {
      throw new Error('No user ID provided');
    }

    console.log('[BackgroundProcessor] Audio blob size:', audioBlob.size, 'type:', audioBlob.type);
    console.log('[BackgroundProcessor] User ID:', userId);

    // Convert audio to base64
    const reader = new FileReader();
    
    await new Promise<void>((resolve, reject) => {
      reader.onloadend = () => resolve();
      reader.onerror = (e) => {
        console.error('[BackgroundProcessor] Error reading audio file:', e);
        reject(new Error('Failed to read audio file: ' + e));
      };
      reader.readAsDataURL(audioBlob);
    });
    
    if (!reader.result) {
      throw new Error('Failed to read audio file - no result');
    }
    
    // Extract base64 content without the data URL prefix
    const base64Audio = (reader.result as string).split(',')[1];
    
    if (!base64Audio) {
      throw new Error('Invalid base64 audio data');
    }
    
    console.log('[BackgroundProcessor] Audio converted to base64, length:', base64Audio.length);
    console.log('[BackgroundProcessor] Sending audio to transcribe function');
    
    // Calculate recording duration in seconds from blob
    // Since Blob doesn't have a duration property, we need to estimate it differently
    // We can calculate based on the audio blob size and sample rate as an approximation
    const recordingTimeMs = audioBlob.size > 0 
      ? (audioBlob as any).duration ? (audioBlob as any).duration * 1000 // Use custom duration if available
      : (audioBlob.size / 16000) * 1000 // Estimate based on size and 16kHz sample rate
      : 0;
    
    // Check user auth status before processing
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      console.error('[BackgroundProcessor] Auth error or no session:', sessionError);
      throw new Error('Authentication required');
    }
    
    // Use the transcription service instead of direct invocation
    const result = await sendAudioForTranscription(
      base64Audio,
      userId,
      false, // Not direct transcription
      useGoogleSTT // Use Google STT if specified
    );
    
    if (!result.success) {
      console.error('[BackgroundProcessor] Error in transcription:', result.error);
      
      // Show specific message for Google STT failures
      if (useGoogleSTT) {
        toast.error(`Google Speech-to-Text failed: ${result.error || 'Unknown error'}`, {
          id: `error-${tempId}`,
          duration: 5000,
        });
      } else {
        toast.error(`Failed to process recording: ${result.error || 'Unknown error'}`, {
          id: `error-${tempId}`,
          duration: 3000,
        });
      }
      
      throw new Error(result.error || 'Unknown transcription error');
    }
    
    // Add detailed logging to track successful processing
    console.log('[BackgroundProcessor] Audio processing complete for tempId:', tempId);
    console.log('[BackgroundProcessor] Result:', result.data);
    console.log('[BackgroundProcessor] EntryId:', result.data?.entryId);
    console.log('[BackgroundProcessor] Transcription length:', result.data?.transcription?.length || 0);
    console.log('[BackgroundProcessor] Refined text length:', result.data?.refinedText?.length || 0);
    console.log('[BackgroundProcessor] Transcription service:', result.data?.transcriptionService || (useGoogleSTT ? 'google' : 'whisper'));
    
    // Show success notification
    toast.success(`Journal entry saved successfully using ${useGoogleSTT ? 'Google Speech' : 'OpenAI Whisper'}`, {
      id: `success-${tempId}`,
      duration: 3000,
    });
    
    // Stop tracking this processing task
    updateProcessingEntries(tempId, 'remove');
    
  } catch (error: any) {
    console.error('[BackgroundProcessor] Processing error:', error);
    
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

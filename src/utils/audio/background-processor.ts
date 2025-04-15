
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
  tempId: string,
  estimatedDuration?: number
): Promise<void> {
  try {
    console.log('[BackgroundProcessor] Starting background processing for tempId:', tempId);
    console.log('[BackgroundProcessor] Audio blob size:', audioBlob?.size, 'bytes, type:', audioBlob?.type);
    console.log('[BackgroundProcessor] Audio blob duration property:', (audioBlob as any)?.duration || 'not available');
    console.log('[BackgroundProcessor] Estimated duration provided:', estimatedDuration || 'unknown', 'seconds');
    
    if (!audioBlob) {
      console.error('[BackgroundProcessor] Error: No audio blob provided');
      throw new Error('No audio blob provided');
    }

    if (!userId) {
      console.error('[BackgroundProcessor] Error: No user ID provided');
      throw new Error('No user ID provided');
    }

    // Add validation check for blob size
    if (audioBlob.size < 100) {
      console.error('[BackgroundProcessor] Error: Audio blob too small:', audioBlob.size, 'bytes');
      throw new Error('Audio recording too short or empty');
    }

    // Convert audio to base64
    const reader = new FileReader();
    
    await new Promise<void>((resolve, reject) => {
      reader.onloadend = () => resolve();
      reader.onerror = (e) => {
        console.error('[BackgroundProcessor] Error reading audio file:', e);
        reject(new Error('Failed to read audio file'));
      };
      reader.readAsDataURL(audioBlob);
    });
    
    if (!reader.result) {
      console.error('[BackgroundProcessor] Error: Failed to read audio file - no result');
      throw new Error('Failed to read audio file');
    }
    
    // Extract base64 content without the data URL prefix
    const base64String = reader.result as string;
    const base64Parts = base64String.split(',');
    
    if (base64Parts.length !== 2) {
      console.error('[BackgroundProcessor] Error: Invalid base64 format:', base64String.substring(0, 50) + '...');
      throw new Error('Invalid audio data format');
    }
    
    const base64Audio = base64Parts[1];
    
    if (!base64Audio || base64Audio.length < 100) {
      console.error('[BackgroundProcessor] Error: Invalid or too small base64 audio data:', base64Audio?.length || 0, 'chars');
      throw new Error('Invalid base64 audio data');
    }
    
    console.log('[BackgroundProcessor] Audio converted to base64, length:', base64Audio.length);
    console.log('[BackgroundProcessor] Sending audio to transcribe function');
    
    // Determine the most reliable duration source
    // 1. Custom duration property if available
    // 2. Provided estimated duration
    // 3. Calculate based on blob size (fallback)
    const blobDuration = typeof (audioBlob as any).duration === 'number' ? (audioBlob as any).duration : null;
    
    // Use the most reliable source of duration
    const recordingTimeMs = blobDuration !== null ? blobDuration * 1000 : 
                           estimatedDuration ? estimatedDuration * 1000 :
                           audioBlob.size > 0 ? (audioBlob.size / 16000) * 1000 : 0;
    
    console.log('[BackgroundProcessor] Audio duration sources:', {
      blobDuration: blobDuration !== null ? `${blobDuration}s` : 'not available',
      estimatedDuration: estimatedDuration ? `${estimatedDuration}s` : 'not provided',
      calculatedFromSize: audioBlob.size > 0 ? `${(audioBlob.size / 16000)}s` : 'not calculated',
      finalRecordingTimeMs: recordingTimeMs
    });
    
    // Validate that we have a reasonable duration
    if (recordingTimeMs < 100) {
      console.error('[BackgroundProcessor] Error: Recording duration too short:', recordingTimeMs, 'ms');
      throw new Error('Recording duration too short');
    }
    
    // Invoke the Supabase function to process the audio with explicit stringified JSON
    const body = JSON.stringify({
      audio: base64Audio,
      userId: userId,
      recordingTime: recordingTimeMs,
      directTranscription: false,
      highQuality: true
    });
    
    console.log('[BackgroundProcessor] Function payload size:', body.length, 'bytes');
    console.log('[BackgroundProcessor] Function parameters:', {
      userId: userId,
      recordingTimeMs,
      directTranscription: false,
      highQuality: true
    });
    
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: {
        audio: base64Audio,
        userId: userId,
        recordingTime: recordingTimeMs,
        directTranscription: false,
        highQuality: true
      }
    });
    
    if (error) {
      console.error('[BackgroundProcessor] Error invoking transcribe-audio function:', error);
      console.error('[BackgroundProcessor] Error details:', error.message, error.context);
      throw error;
    }
    
    // Add detailed logging to track successful processing
    console.log('[BackgroundProcessor] Audio processing complete for tempId:', tempId);
    console.log('[BackgroundProcessor] Result:', data ? 'received' : 'null');
    console.log('[BackgroundProcessor] EntryId:', data?.entryId || 'not provided');
    console.log('[BackgroundProcessor] Transcription length:', data?.transcription?.length || 0, 'chars');
    console.log('[BackgroundProcessor] Refined text length:', data?.refinedText?.length || 0, 'chars');
    
    // Stop tracking this processing task
    updateProcessingEntries(tempId, 'remove');
    toast.success('Recording processed successfully', {
      id: `success-${tempId}`,
      duration: 3000,
    });
    
  } catch (error: any) {
    console.error('[BackgroundProcessor] Processing error:', error);
    console.error('[BackgroundProcessor] Error stack:', error.stack);
    
    toast.error(`Failed to process recording: ${error.message || 'Unknown error'}`, {
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

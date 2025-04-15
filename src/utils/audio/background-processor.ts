
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
    console.log('[BackgroundProcessor] Estimated duration:', estimatedDuration || 'unknown', 'seconds');
    
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
      reader.onerror = (e) => {
        console.error('[BackgroundProcessor] Error reading audio file:', e);
        reject(new Error('Failed to read audio file'));
      };
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
    
    // Use the most reliable duration source
    // 1. Custom duration property if available
    // 2. Provided estimated duration
    // 3. Calculate based on blob size
    const blobDuration = (audioBlob as any).duration;
    
    const recordingTimeMs = blobDuration ? blobDuration * 1000 : 
                            estimatedDuration ? estimatedDuration * 1000 :
                            audioBlob.size > 0 ? (audioBlob.size / 16000) * 1000 : 0;
    
    console.log('[BackgroundProcessor] Audio duration sources:', {
      blobDuration: blobDuration ? `${blobDuration}s` : 'not available',
      estimatedDuration: estimatedDuration ? `${estimatedDuration}s` : 'not provided',
      calculatedFromSize: audioBlob.size > 0 ? `${(audioBlob.size / 16000)}s` : 'not calculated'
    });
    
    console.log('[BackgroundProcessor] Using recording duration:', recordingTimeMs, 'ms');
    
    // Invoke the Supabase function to process the audio
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: {
        audio: base64Audio,
        userId: userId,
        recordingTime: recordingTimeMs,
        // Indicate this is a direct transcription without additional processing
        directTranscription: false,
        // Request high quality processing
        highQuality: true
      }
    });
    
    if (error) {
      console.error('[BackgroundProcessor] Error invoking transcribe-audio function:', error);
      throw error;
    }
    
    // Add detailed logging to track successful processing
    console.log('[BackgroundProcessor] Audio processing complete for tempId:', tempId);
    console.log('[BackgroundProcessor] Result:', data);
    console.log('[BackgroundProcessor] EntryId:', data?.entryId);
    console.log('[BackgroundProcessor] Transcription length:', data?.transcription?.length || 0);
    console.log('[BackgroundProcessor] Refined text length:', data?.refinedText?.length || 0);
    
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

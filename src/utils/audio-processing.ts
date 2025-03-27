
import { toast } from 'sonner';
import { blobToBase64, validateAudioBlob } from './audio/blob-utils';
import { verifyUserAuthentication } from './audio/auth-utils';
import { sendAudioForTranscription } from './audio/transcription-service';

/**
 * Processes an audio recording for transcription and analysis
 * Returns immediately with a temporary ID while processing continues in background
 */
export async function processRecording(audioBlob: Blob | null, userId: string | undefined): Promise<{
  success: boolean;
  tempId?: string;
  error?: string;
}> {
  // 1. Validate the audio blob
  const validation = validateAudioBlob(audioBlob);
  if (!validation.isValid) {
    toast.error(validation.errorMessage);
    return { success: false, error: validation.errorMessage };
  }
  
  try {
    // Generate a temporary ID for this recording
    const tempId = `temp-${Date.now()}`;
    
    // Start processing in background
    toast.loading('Processing your journal entry with advanced AI...', {
      id: tempId,
      duration: Infinity, // Toast remains until explicitly dismissed
    });
    
    // Launch the processing without awaiting it
    processRecordingInBackground(audioBlob, userId, tempId);
    
    // Return immediately with the temp ID
    return { success: true, tempId };
  } catch (error: any) {
    console.error('Error initiating recording process:', error);
    toast.error(`Error initiating recording process: ${error.message || 'Unknown error'}`);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Processes a recording in the background without blocking the UI
 */
async function processRecordingInBackground(audioBlob: Blob | null, userId: string | undefined, toastId: string): Promise<void> {
  try {
    // 1. Convert blob to base64
    const base64Audio = await blobToBase64(audioBlob!);
    
    // Validate base64 data
    if (!base64Audio || base64Audio.length < 100) {
      console.error('Invalid base64 audio data');
      toast.dismiss(toastId);
      toast.error('Invalid audio data. Please try again.');
      return;
    }
    
    // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
    const base64String = base64Audio.split(',')[1]; 
    
    // 2. Verify user authentication
    const authStatus = await verifyUserAuthentication();
    if (!authStatus.isAuthenticated) {
      toast.dismiss(toastId);
      toast.error(authStatus.error);
      return;
    }

    // 3. Send audio for transcription
    const result = await sendAudioForTranscription(base64String, authStatus.userId!);
    
    toast.dismiss(toastId);
    
    if (result.success) {
      toast.success('Journal entry saved successfully!');
    } else {
      toast.error(result.error || 'Failed to process recording');
    }
  } catch (error: any) {
    console.error('Error processing recording in background:', error);
    toast.dismiss(toastId);
    toast.error(`Error processing recording: ${error.message || 'Unknown error'}`);
  }
}

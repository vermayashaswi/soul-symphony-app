
import { toast } from 'sonner';
import { blobToBase64, validateAudioBlob } from './audio/blob-utils';
import { verifyUserAuthentication } from './audio/auth-utils';
import { sendAudioForTranscription } from './audio/transcription-service';

/**
 * Processes an audio recording for transcription and analysis
 */
export async function processRecording(audioBlob: Blob | null, userId: string | undefined): Promise<boolean> {
  // 1. Validate the audio blob
  const validation = validateAudioBlob(audioBlob);
  if (!validation.isValid) {
    toast.error(validation.errorMessage);
    return false;
  }
  
  try {
    toast.loading('Processing your journal entry with advanced AI...');
    
    // 2. Convert blob to base64
    const base64Audio = await blobToBase64(audioBlob!);
    
    // Validate base64 data
    if (!base64Audio || base64Audio.length < 100) {
      console.error('Invalid base64 audio data');
      toast.dismiss();
      toast.error('Invalid audio data. Please try again.');
      return false;
    }
    
    // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
    const base64String = base64Audio.split(',')[1]; 
    
    // 3. Verify user authentication
    const authStatus = await verifyUserAuthentication();
    if (!authStatus.isAuthenticated) {
      toast.dismiss();
      toast.error(authStatus.error);
      return false;
    }

    // 4. Send audio for transcription
    const result = await sendAudioForTranscription(base64String, authStatus.userId!);
    
    toast.dismiss();
    
    if (result.success) {
      toast.success('Journal entry saved successfully!');
      return true;
    } else {
      toast.error(result.error || 'Failed to process recording');
      return false;
    }
  } catch (error: any) {
    console.error('Error processing recording:', error);
    toast.dismiss();
    toast.error(`Error processing recording: ${error.message || 'Unknown error'}`);
    return false;
  }
}

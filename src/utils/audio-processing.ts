
import { toast } from 'sonner';
import { blobToBase64, validateAudioBlob } from './audio/blob-utils';
import { verifyUserAuthentication, ensureUserProfile } from './audio/auth-utils';
import { sendAudioForTranscription } from './audio/transcription-service';
import { supabase } from '@/integrations/supabase/client';

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
    toast.error(validation.errorMessage || 'Invalid recording');
    return { success: false, error: validation.errorMessage };
  }
  
  if (!userId) {
    toast.error("You must be signed in to save journal entries");
    return { success: false, error: "Authentication required" };
  }
  
  try {
    // Generate a temporary ID for this recording
    const tempId = `temp-${Date.now()}`;
    
    // Start processing in background
    toast.loading('Processing your journal entry with advanced AI...', {
      id: tempId,
      duration: 120000, // Toast remains for 2 minutes or until explicitly dismissed
    });
    
    // Check if user profile exists before proceeding
    try {
      const profileResult = await ensureUserProfile(userId);
      if (!profileResult.success) {
        console.warn('Profile creation warning in processRecording:', profileResult.error);
        // Continue with processing since profile might get created later
      }
    } catch (profileError) {
      console.error('Profile check error:', profileError);
      // Don't fail the recording process due to profile issues
    }
      
    // Launch the processing without awaiting it
    processRecordingInBackground(audioBlob, userId, tempId).catch(error => {
      console.error('Background processing error:', error);
      toast.dismiss(tempId);
      toast.error('Error processing recording');
    });
    
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
async function processRecordingInBackground(audioBlob: Blob | null, userId: string, toastId: string): Promise<void> {
  try {
    if (!audioBlob) {
      toast.dismiss(toastId);
      toast.error('No audio data available');
      return;
    }
    
    console.log("Processing blob in background:", audioBlob);
    console.log("Blob type:", audioBlob.type);
    console.log("Blob size:", audioBlob.size);
    console.log("User ID:", userId);
    
    // 1. Convert blob to base64
    const base64Audio = await blobToBase64(audioBlob);
    
    // Validate base64 data
    if (!base64Audio || base64Audio.length < 100) {
      console.error('Invalid base64 audio data');
      toast.dismiss(toastId);
      toast.error('Invalid audio data. Please try again.');
      return;
    }
    
    // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
    const base64String = base64Audio.split(',')[1]; 
    
    console.log("Base64 audio length:", base64String.length);
    
    // 2. Verify user authentication
    try {
      const authStatus = await verifyUserAuthentication(false); // Don't show toast here
      if (!authStatus.isAuthenticated) {
        toast.dismiss(toastId);
        toast.error(authStatus.error || 'Authentication failed');
        return;
      }
    } catch (authError) {
      console.error('Authentication verification error:', authError);
      toast.dismiss(toastId);
      toast.error('Authentication check failed');
      return;
    }

    // Final check for profile existence
    try {
      const profileResult = await ensureUserProfile(userId);
      if (!profileResult.success) {
        console.warn('Profile creation issue before transcription, continuing anyway:', profileResult.error);
        // We continue anyway as the transcription service will also try to create the profile
      }
    } catch (profileError) {
      console.error('Profile check error before transcription:', profileError);
      // Continue despite errors with profile checking
    }

    // 3. Send audio for transcription and AI analysis
    try {
      const result = await sendAudioForTranscription(base64String, userId);
      
      toast.dismiss(toastId);
      
      if (result.success) {
        toast.success('Journal entry processed and saved successfully!', {
          description: "Your entry has been analyzed for themes and emotions."
        });
        
        // Add the processing entry to the URL to show it in the journal list
        if (window.location.pathname === '/journal') {
          // Already on journal page, just update the URL
          const url = new URL(window.location.href);
          url.searchParams.set('processing', toastId);
          window.history.replaceState({}, document.title, url.toString());
          
          // Force a reload to show the new entry
          window.location.reload();
        } else {
          // Redirect to journal page with processing parameter
          window.location.href = `/journal?processing=${toastId}`;
        }
      } else {
        toast.error(result.error || 'Failed to process recording');
      }
    } catch (transcriptionError) {
      console.error('Transcription error:', transcriptionError);
      toast.dismiss(toastId);
      toast.error('Failed to transcribe audio. Please try again.');
    }
  } catch (error: any) {
    console.error('Error processing recording in background:', error);
    toast.dismiss(toastId);
    toast.error(`Error processing recording: ${error.message || 'Unknown error'}`);
  }
}

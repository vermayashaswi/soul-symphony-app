
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
      console.log('Ensuring user profile exists for userId:', userId);
      const profileResult = await ensureUserProfile(userId);
      if (!profileResult.success) {
        console.warn('Profile creation warning in processRecording:', profileResult.error);
      } else {
        console.log('Profile check completed successfully:', profileResult);
      }
    } catch (profileError) {
      console.error('Profile check error:', profileError);
      // Continue anyway - non-blocking
    }
      
    // Launch the processing without awaiting it
    processRecordingInBackground(audioBlob, userId, tempId).catch(error => {
      console.error('Background processing error:', error);
      toast.dismiss(tempId);
      toast.error('Error processing recording. Please try again.');
    });
    
    // Return immediately with the temp ID
    return { success: true, tempId };
  } catch (error: any) {
    console.error('Error initiating recording process:', error);
    toast.error(`Error initiating recording process. Please try again later.`);
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
    
    console.log("Processing blob in background - Type:", audioBlob.type, "Size:", audioBlob.size, "User ID:", userId);
    
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
    
    console.log("Base64 audio converted - length:", base64String.length);
    
    // 2. Verify user authentication
    try {
      console.log('Verifying user authentication for userId:', userId);
      const authStatus = await verifyUserAuthentication(false); // Don't show toast here
      if (!authStatus.isAuthenticated) {
        console.error('Authentication verification failed:', authStatus.error);
        toast.dismiss(toastId);
        toast.error('Authentication failed. Please try signing in again.');
        return;
      }
      
      // Double check that we have the user ID from auth
      if (authStatus.user && authStatus.user.id !== userId) {
        console.warn('User ID mismatch detected, using auth user ID instead of:', userId);
        userId = authStatus.user.id;
        console.log('Updated userId to:', userId);
      }
    } catch (authError) {
      console.error('Authentication verification error:', authError);
      toast.dismiss(toastId);
      toast.error('Authentication check failed. Please try again.');
      return;
    }

    // Profile check is non-blocking - we continue with transcription regardless
    try {
      const profileResult = await ensureUserProfile(userId);
      if (!profileResult.success) {
        console.warn('Profile creation issue before transcription:', profileResult.error);
      } else {
        console.log('Profile check completed before transcription');
      }
    } catch (profileError) {
      console.error('Profile check error before transcription:', profileError);
    }

    // 3. Send audio for transcription and AI analysis
    try {
      console.log('Sending audio for transcription - userId:', userId, 'base64Length:', base64String.length);
      const result = await sendAudioForTranscription(base64String, userId);
      
      toast.dismiss(toastId);
      
      if (result.success) {
        console.log('Transcription successful:', result);
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
        console.error('Transcription service error:', result.error);
        toast.error('Failed to process recording. Please try again later.');
      }
    } catch (transcriptionError: any) {
      console.error('Transcription error:', transcriptionError);
      toast.dismiss(toastId);
      
      const errorMessage = transcriptionError?.message || 'Unknown error';
      console.error('Detailed transcription error:', errorMessage);
      
      toast.error(`Failed to transcribe audio: ${errorMessage.substring(0, 100)}...`);
      
      // Log the error to console instead of trying to insert into a non-existent table
      console.error('Audio processing error:', {
        user_id: userId,
        error_source: 'audio_processing',
        error_message: errorMessage,
        error_details: JSON.stringify(transcriptionError)
      });
    }
  } catch (error: any) {
    console.error('Error processing recording in background:', error);
    toast.dismiss(toastId);
    toast.error(`Error processing recording: ${error.message || 'Unknown error'}`);
  }
}


import { toast } from 'sonner';
import { blobToBase64, validateAudioBlob } from './audio/blob-utils';
import { verifyUserAuthentication } from './audio/auth-utils';
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
    // Log the blob details for debugging
    console.log('Audio blob details:', audioBlob?.type, audioBlob?.size);
    
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

    // 3. Check if the user profile exists, and create one if it doesn't
    await ensureUserProfileExists(authStatus.userId);

    // 4. First try a direct transcription to verify the audio is valid
    console.log('Testing audio with direct transcription...');
    
    const directTranscriptionResult = await sendAudioForTranscription(base64String, authStatus.userId!, true);
    if (!directTranscriptionResult.success || !directTranscriptionResult.data?.transcription) {
      console.error('Direct transcription test failed:', directTranscriptionResult.error);
      toast.dismiss(toastId);
      toast.error('Audio recording test failed. Please try again with clearer speech.');
      return;
    }
    
    console.log('Direct transcription successful:', directTranscriptionResult.data.transcription);
    
    // 5. Process the full journal entry
    let result;
    let retries = 0;
    const maxRetries = 2;
    
    while (retries <= maxRetries) {
      try {
        result = await sendAudioForTranscription(base64String, authStatus.userId!, false);
        if (result.success) break;
        retries++;
        if (retries <= maxRetries) {
          console.log(`Transcription attempt ${retries} failed, retrying...`);
          // Wait a bit before retrying
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (err) {
        console.error(`Transcription attempt ${retries + 1} error:`, err);
        retries++;
        if (retries <= maxRetries) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
    
    toast.dismiss(toastId);
    
    if (result?.success) {
      console.log('Journal entry saved successfully:', result);
      
      // Verify the entry was saved by querying the database
      if (result.data?.entryId) {
        const { data: savedEntry, error: fetchError } = await supabase
          .from('Journal Entries')
          .select('id')
          .eq('id', result.data.entryId)
          .single();
          
        if (fetchError || !savedEntry) {
          console.error('Failed to verify journal entry was saved:', fetchError);
          toast.error('Journal entry processing completed but verification failed. Please check your entries.');
        } else {
          console.log('Journal entry verified in database:', savedEntry);
          toast.success('Journal entry saved successfully!');
        }
      } else {
        toast.success('Journal entry processed, but no entry ID returned.');
      }
    } else {
      console.error('Failed to process recording after multiple attempts:', result?.error);
      toast.error(result?.error || 'Failed to process recording after multiple attempts');
    }
  } catch (error: any) {
    console.error('Error processing recording in background:', error);
    toast.dismiss(toastId);
    toast.error(`Error processing recording: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Ensures that a user profile exists for the given user ID
 * Creates one if it doesn't exist
 */
async function ensureUserProfileExists(userId: string | undefined): Promise<void> {
  if (!userId) return;
  
  try {
    // Check if user profile exists
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
      
    // If profile doesn't exist, create one
    if (fetchError || !profile) {
      console.log('User profile not found, creating one...');
      
      // Get user data from auth
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      
      // Create profile
      const { error: insertError } = await supabase
        .from('profiles')
        .insert([{ 
          id: userId,
          email: userData.user?.email,
          full_name: userData.user?.user_metadata?.full_name || '',
          avatar_url: userData.user?.user_metadata?.avatar_url || ''
        }]);
        
      if (insertError) {
        console.error('Error creating user profile:', insertError);
        throw insertError;
      }
      
      console.log('User profile created successfully');
    }
  } catch (error) {
    console.error('Error ensuring user profile exists:', error);
    // We don't throw here to allow the process to continue
    // The foreign key constraint will fail later if this fails
  }
}

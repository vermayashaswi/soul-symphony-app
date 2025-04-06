
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
    
    // Log the audio details
    console.log('Processing audio:', {
      size: audioBlob?.size || 0,
      type: audioBlob?.type || 'unknown',
      userId: userId || 'anonymous'
    });
    
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
    
    if (!audioBlob) {
      toast.dismiss(toastId);
      toast.error('No audio data to process');
      return;
    }
    
    // Check if audio blob is too small to be useful
    if (audioBlob.size < 1000) {
      toast.dismiss(toastId);
      toast.error('Audio recording is too small to process. Please try recording again with more speech.');
      return;
    }
    
    // 1. Convert blob to base64
    const base64Audio = await blobToBase64(audioBlob);
    
    // Validate base64 data
    if (!base64Audio || base64Audio.length < 100) {
      console.error('Invalid base64 audio data');
      toast.dismiss(toastId);
      toast.error('Invalid audio data. Please try again.');
      return;
    }
    
    // Log the base64 length for debugging
    console.log(`Base64 audio data length: ${base64Audio.length}`);
    
    // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
    const base64String = base64Audio.split(',')[1]; 
    
    // 2. Verify user authentication
    const authStatus = await verifyUserAuthentication();
    if (!authStatus.isAuthenticated) {
      toast.dismiss(toastId);
      toast.error(authStatus.error || 'User authentication failed');
      return;
    }

    console.log('User authentication verified:', authStatus.userId);

    // 3. Check if the user profile exists, and create one if it doesn't
    if (authStatus.userId) {
      await ensureUserProfileExists(authStatus.userId);
    } else {
      toast.dismiss(toastId);
      toast.error('Cannot identify user ID. Please sign in again.');
      return;
    }

    // Update toast message to show progress
    toast.loading('Processing with AI...', { id: toastId });
    
    // 4. Process the full journal entry
    let result;
    let retries = 0;
    const maxRetries = 2; // Reduce retries for new users
    
    while (retries <= maxRetries) {
      try {
        // Set directTranscription to false to get full journal entry processing
        result = await sendAudioForTranscription(base64String, authStatus.userId, false);
        if (result.success) break;
        retries++;
        if (retries <= maxRetries) {
          console.log(`Transcription attempt ${retries} failed, retrying...`);
          // Wait a bit before retrying
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch (err) {
        console.error(`Transcription attempt ${retries + 1} error:`, err);
        retries++;
        if (retries <= maxRetries) {
          await new Promise(r => setTimeout(r, 1500));
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
          .select('id, "refined text", duration')
          .eq('id', result.data.entryId)
          .single();
          
        if (fetchError || !savedEntry) {
          console.error('Failed to verify journal entry was saved:', fetchError);
          toast.success('Journal entry is being processed. Please refresh the page after a few moments to see your entry.');
        } else {
          console.log('Journal entry verified in database:', savedEntry);
          const duration = savedEntry.duration || 'unknown';
          const text = savedEntry['refined text'] || '';
          const snippet = text.length > 40 ? text.substring(0, 37) + '...' : text;
          
          toast.success(`Journal entry saved successfully! (${duration}s) "${snippet}"`);
        }
      } else {
        toast.success('Journal entry processed and saved successfully.');
      }
    } else {
      console.error('Failed to process recording after multiple attempts:', result?.error);
      toast.error('Your journal entry is being processed in the background. Please check back in a few minutes.');
      
      // For first-time users, give a more helpful message
      setTimeout(() => {
        toast.info('If your entry doesn\'t appear, try recording a slightly longer message with clear speech.');
      }, 3000);
    }
  } catch (error: any) {
    console.error('Error processing recording in background:', error);
    toast.dismiss(toastId);
    toast.error(`Error processing recording, but your data was saved. Please try refreshing the page in a moment.`);
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
          avatar_url: userData.user?.user_metadata?.avatar_url || '',
          onboarding_completed: false
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

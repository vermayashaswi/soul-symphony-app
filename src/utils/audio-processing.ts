
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
    
    // Check if the user exists in the profiles table
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
      
    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Profile check error:', profileError);
      toast.error('Error checking user profile. Please try again.');
      toast.dismiss(tempId);
      return { success: false, error: 'Error checking user profile' };
    }
      
    // If profile doesn't exist, create one
    if (!profileData) {
      console.log('No profile found in audio processing, creating profile for user:', userId);
      
      // Get user details from auth
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('Error getting user data:', userError);
        toast.error('Failed to get user information. Please try again later.');
        toast.dismiss(tempId);
        return { success: false, error: 'Failed to get user information' };
      }
      
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({ 
          id: userId,
          email: userData.user.email,
          full_name: userData.user.user_metadata?.full_name || null,
          avatar_url: userData.user.user_metadata?.avatar_url || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
      if (insertError) {
        console.error('Failed to create profile:', insertError);
        
        // If duplicate key error, profile probably got created in another process
        if (insertError.code === '23505') {
          console.log('Profile creation conflict - profile likely created by another process');
        } else {
          toast.error('Failed to create user profile. Please try again later.');
          toast.dismiss(tempId);
          return { success: false, error: 'Failed to create user profile' };
        }
      } else {
        console.log('Successfully created profile for user in audio processing:', userId);
      }
    } else {
      console.log('User profile exists, proceeding with journal entry:', profileData.id);
    }
    
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
    const authStatus = await verifyUserAuthentication();
    if (!authStatus.isAuthenticated) {
      toast.dismiss(toastId);
      toast.error(authStatus.error || 'Authentication failed');
      return;
    }

    // Check profile existence one more time before sending to transcription
    const { data: profileCheck, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
      
    if (profileCheckError) {
      console.error('Final profile check error before transcription:', profileCheckError);
      if (profileCheckError.code !== 'PGRST116') {
        toast.dismiss(toastId);
        toast.error('Error verifying user profile. Please try again.');
        return;
      }
    }
    
    if (!profileCheck) {
      console.log('No profile found in final check before transcription. Attempting one more creation.');
      // Last attempt to create profile before transcription
      const { data: userData } = await supabase.auth.getUser();
      
      const { error: createError } = await supabase
        .from('profiles')
        .insert({ 
          id: userId,
          email: userData.user?.email,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
      if (createError && createError.code !== '23505') {
        console.error('Final attempt to create profile failed:', createError);
        toast.dismiss(toastId);
        toast.error('Unable to create user profile. Please try refreshing the page and trying again.');
        return;
      }
    }

    // 3. Send audio for transcription and AI analysis
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
  } catch (error: any) {
    console.error('Error processing recording in background:', error);
    toast.dismiss(toastId);
    toast.error(`Error processing recording: ${error.message || 'Unknown error'}`);
  }
}

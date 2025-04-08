
import { blobToBase64, validateAudioBlob } from './audio/blob-utils';
import { verifyUserAuthentication } from './audio/auth-utils';
import { sendAudioForTranscription } from './audio/transcription-service';
import { supabase } from '@/integrations/supabase/client';
import { clearAllToasts } from '@/services/notificationService';
import { toast } from 'sonner';

// Flag to track if an entry is being processed to prevent duplicate notifications
let isEntryBeingProcessed = false;
let processingLock = false;
let processingTimeoutId: NodeJS.Timeout | null = null;

/**
 * Processes an audio recording for transcription and analysis
 * Returns immediately with a temporary ID while processing continues in background
 */
export async function processRecording(audioBlob: Blob | null, userId: string | undefined): Promise<{
  success: boolean;
  tempId?: string;
  error?: string;
}> {
  console.log('[AudioProcessing] Starting processing with blob:', audioBlob?.size, audioBlob?.type);
  
  // Clear all toasts to ensure UI is clean before processing
  clearAllToasts();
  
  // If there's already a processing operation in progress, wait briefly
  if (processingLock) {
    console.log('[AudioProcessing] Processing lock detected, waiting briefly...');
    
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // If lock is still active after waiting, return an error
      if (processingLock) {
        console.error('[AudioProcessing] Processing lock still active, cannot process multiple recordings simultaneously');
        return { success: false, error: 'Another recording is already being processed' };
      }
    } catch (err) {
      console.error('[AudioProcessing] Error waiting for processing lock:', err);
    }
  }
  
  // 1. Validate the audio blob
  const validation = validateAudioBlob(audioBlob);
  if (!validation.isValid) {
    console.error('Audio validation failed:', validation.errorMessage);
    return { success: false, error: validation.errorMessage };
  }
  
  try {
    // Set processing lock to prevent multiple simultaneous processing
    processingLock = true;
    
    // Set a timeout to release the lock after a maximum time to prevent deadlocks
    if (processingTimeoutId) {
      clearTimeout(processingTimeoutId);
    }
    
    processingTimeoutId = setTimeout(() => {
      console.log('[AudioProcessing] Releasing processing lock due to timeout');
      processingLock = false;
      isEntryBeingProcessed = false;
    }, 30000); // 30 second maximum lock time
    
    // Generate a temporary ID for this recording
    const tempId = `temp-${Date.now()}`;
    isEntryBeingProcessed = true;
    
    // Log the audio details
    console.log('Processing audio:', {
      size: audioBlob?.size || 0,
      type: audioBlob?.type || 'unknown',
      userId: userId || 'anonymous'
    });
    
    // Verify the user ID is valid
    if (!userId) {
      console.error('No user ID provided for audio processing');
      isEntryBeingProcessed = false;
      processingLock = false;
      
      if (processingTimeoutId) {
        clearTimeout(processingTimeoutId);
        processingTimeoutId = null;
      }
      
      return { success: false, error: 'Authentication required' };
    }
    
    // Check authentication status
    const auth = await verifyUserAuthentication();
    if (!auth.isAuthenticated) {
      console.error('User authentication failed:', auth.error);
      toast.error('Authentication error. Please sign in again.');
      isEntryBeingProcessed = false;
      processingLock = false;
      
      if (processingTimeoutId) {
        clearTimeout(processingTimeoutId);
        processingTimeoutId = null;
      }
      
      return { success: false, error: 'Authentication required' };
    }
    
    // Launch the processing without awaiting it
    processRecordingInBackground(audioBlob, userId, tempId)
      .catch(err => {
        console.error('Background processing error:', err);
        toast.error('Error processing recording');
        isEntryBeingProcessed = false;
        processingLock = false;
        
        if (processingTimeoutId) {
          clearTimeout(processingTimeoutId);
          processingTimeoutId = null;
        }
      });
    
    toast.success('Recording submitted for processing');
    
    // Return immediately with the temp ID
    return { success: true, tempId };
  } catch (error: any) {
    console.error('Error initiating recording process:', error);
    isEntryBeingProcessed = false;
    processingLock = false;
    
    if (processingTimeoutId) {
      clearTimeout(processingTimeoutId);
      processingTimeoutId = null;
    }
    
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Processes a recording in the background without blocking the UI
 */
async function processRecordingInBackground(audioBlob: Blob | null, userId: string | undefined, tempId: string): Promise<void> {
  try {
    // Log the blob details for debugging
    console.log('Audio blob details:', audioBlob?.type, audioBlob?.size);
    
    if (!audioBlob) {
      console.error('No audio data to process');
      toast.error('No audio data to process');
      isEntryBeingProcessed = false;
      processingLock = false;
      
      if (processingTimeoutId) {
        clearTimeout(processingTimeoutId);
        processingTimeoutId = null;
      }
      
      return;
    }
    
    // Check if audio blob is too small to be useful
    if (audioBlob.size < 1000) {
      console.error('Audio recording is too small to process');
      toast.error('Recording is too short to process');
      isEntryBeingProcessed = false;
      processingLock = false;
      
      if (processingTimeoutId) {
        clearTimeout(processingTimeoutId);
        processingTimeoutId = null;
      }
      
      return;
    }
    
    // 1. Convert blob to base64
    const base64Audio = await blobToBase64(audioBlob);
    
    // Validate base64 data
    if (!base64Audio || base64Audio.length < 100) {
      console.error('Invalid base64 audio data');
      toast.error('Failed to convert audio');
      isEntryBeingProcessed = false;
      processingLock = false;
      
      if (processingTimeoutId) {
        clearTimeout(processingTimeoutId);
        processingTimeoutId = null;
      }
      
      return;
    }
    
    // Log the base64 length for debugging
    console.log(`Base64 audio data length: ${base64Audio.length}`);
    
    // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
    const base64String = base64Audio.split(',')[1]; 
    
    // 2. Verify user authentication
    const authStatus = await verifyUserAuthentication();
    if (!authStatus.isAuthenticated) {
      console.error('User authentication failed:', authStatus.error);
      toast.error('Authentication error. Please sign in again.');
      isEntryBeingProcessed = false;
      processingLock = false;
      
      if (processingTimeoutId) {
        clearTimeout(processingTimeoutId);
        processingTimeoutId = null;
      }
      
      return;
    }

    console.log('User authentication verified:', authStatus.userId);

    // 3. Check if the user profile exists, and create one if it doesn't
    if (authStatus.userId) {
      const profileExists = await ensureUserProfileExists(authStatus.userId);
      if (!profileExists) {
        console.error('Failed to ensure user profile exists');
        toast.error('Error with user profile');
        isEntryBeingProcessed = false;
        processingLock = false;
        
        if (processingTimeoutId) {
          clearTimeout(processingTimeoutId);
          processingTimeoutId = null;
        }
        
        return;
      }
    } else {
      console.error('Cannot identify user ID');
      toast.error('User ID could not be determined');
      isEntryBeingProcessed = false;
      processingLock = false;
      
      if (processingTimeoutId) {
        clearTimeout(processingTimeoutId);
        processingTimeoutId = null;
      }
      
      return;
    }
    
    // 4. Process the full journal entry
    let result;
    let retries = 0;
    const maxRetries = 3; // Increase retry count
    
    while (retries <= maxRetries) {
      try {
        toast.loading('Processing your journal entry...', { id: 'processing-entry' });
        
        // Set directTranscription to false to get full journal entry processing
        result = await sendAudioForTranscription(base64String, authStatus.userId, false);
        
        toast.dismiss('processing-entry');
        
        if (result.success) {
          console.log('Transcription successful, breaking retry loop');
          toast.success('Journal entry created successfully');
          break;
        }
        
        retries++;
        if (retries <= maxRetries) {
          console.log(`Transcription attempt ${retries} failed, retrying after delay...`);
          toast.error(`Processing failed (attempt ${retries}/${maxRetries}). Retrying...`);
          // Increase delay between retries (exponential backoff)
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retries)));
        } else {
          toast.error('Failed to process recording after multiple attempts');
        }
      } catch (err) {
        console.error(`Transcription attempt ${retries + 1} error:`, err);
        toast.error(`Error during processing: ${err instanceof Error ? err.message : 'Unknown error'}`);
        retries++;
        if (retries <= maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retries)));
        }
      }
    }
    
    if (result?.success) {
      console.log('Journal entry saved successfully:', result);
      
      // Release locks
      isEntryBeingProcessed = false;
      processingLock = false;
      
      if (processingTimeoutId) {
        clearTimeout(processingTimeoutId);
        processingTimeoutId = null;
      }
      
      // Manually trigger theme extraction when we have a new entry
      if (result.data?.entryId) {
        try {
          console.log("Manually triggering theme extraction for entry:", result.data.entryId);
          
          // Get the entry text
          const { data: entryData, error: fetchError } = await supabase
            .from('Journal Entries')
            .select('id, "refined text", "transcription text"')
            .eq('id', result.data.entryId)
            .single();
            
          if (fetchError) {
            console.error("Error fetching entry for theme extraction:", fetchError);
          } else if (entryData) {
            const text = entryData["refined text"] || entryData["transcription text"] || "";
            
            if (text) {
              // Call the generate-themes function directly
              console.log("Calling generate-themes with text:", text.substring(0, 50) + "...");
              const { error } = await supabase.functions.invoke('generate-themes', {
                body: {
                  text: text,
                  entryId: result.data.entryId
                }
              });
              
              if (error) {
                console.error("Error calling generate-themes:", error);
              } else {
                console.log("Successfully triggered theme extraction");
              }
            } else {
              console.error("No text content found for theme extraction");
            }
          }
        } catch (themeErr) {
          console.error("Error manually triggering theme extraction:", themeErr);
        }
      }
    } else {
      console.error('Failed to process recording after multiple attempts:', result?.error);
      toast.error('Failed to process recording: ' + (result?.error || 'Unknown error'));
      isEntryBeingProcessed = false;
      processingLock = false;
      
      if (processingTimeoutId) {
        clearTimeout(processingTimeoutId);
        processingTimeoutId = null;
      }
    }
  } catch (error: any) {
    console.error('Error processing recording in background:', error);
    toast.error('Error processing recording: ' + (error?.message || 'Unknown error'));
    isEntryBeingProcessed = false;
    processingLock = false;
    
    if (processingTimeoutId) {
      clearTimeout(processingTimeoutId);
      processingTimeoutId = null;
    }
  }
}

// Check if a journal entry is currently being processed
export function isProcessingEntry(): boolean {
  return isEntryBeingProcessed;
}

// Release all locks and reset processing state (useful for recovery)
export function resetProcessingState(): void {
  console.log('[AudioProcessing] Manually resetting processing state');
  isEntryBeingProcessed = false;
  processingLock = false;
  
  if (processingTimeoutId) {
    clearTimeout(processingTimeoutId);
    processingTimeoutId = null;
  }
  
  // Clear all toasts to ensure UI is clean
  clearAllToasts();
}

// Variable to check if user has previous entries
let hasPreviousEntries = false;

/**
 * Ensures that a user profile exists for the given user ID
 * Creates one if it doesn't exist
 */
async function ensureUserProfileExists(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  
  try {
    // Check if user profile exists
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, onboarding_completed')
      .eq('id', userId)
      .single();
      
    // Check if user has existing journal entries
    const { data: entries, error: entriesError } = await supabase
      .from('Journal Entries')
      .select('id')
      .eq('user_id', userId)
      .limit(1);
      
    hasPreviousEntries = !entriesError && entries && entries.length > 0;
    console.log('User has previous entries:', hasPreviousEntries);
      
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
    } else {
      console.log('Profile exists:', profile.id);
    }
    
    return true;
  } catch (error) {
    console.error('Error ensuring user profile exists:', error);
    return false;
  }
}

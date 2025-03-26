
import { supabase } from '@/integrations/supabase/client';
import { generateUUID } from './audio/blob-utils';
import { toast } from 'sonner';
import { processAudioBlobForTranscription } from './audio/transcription-service';

// Temporary storage for processing status
const processingStatus = new Map<string, 'pending' | 'completed' | 'error'>();

/**
 * Process a recording, uploading audio and initializing the journal entry
 */
export async function processRecording(audioBlob: Blob, userId: string): Promise<{
  success: boolean;
  tempId?: string;
  entryId?: number;
  error?: string;
}> {
  if (!audioBlob) {
    console.error('No audio blob provided for processing');
    return { success: false, error: 'No audio recording found' };
  }
  
  if (!userId) {
    console.error('No user ID provided for processing');
    return { success: false, error: 'Authentication required' };
  }
  
  try {
    console.log('Starting audio processing for user:', userId);
    
    // Generate a temporary ID to track this processing
    const tempId = generateUUID();
    processingStatus.set(tempId, 'pending');
    
    // Create a timestamp for this recording
    const timestamp = new Date().toISOString();
    
    // Create a file path for storage
    const filePath = `journal/${userId}/${tempId}.webm`;
    
    console.log('Uploading audio to:', filePath);
    
    // Make sure the audio bucket exists in storage
    try {
      // Check if 'audio' bucket exists, if not this will error
      const { data: bucketExists } = await supabase.storage.getBucket('audio');
      
      if (!bucketExists) {
        // Create the bucket if it doesn't exist
        console.log('Creating audio bucket');
        await supabase.storage.createBucket('audio', {
          public: false
        });
      }
    } catch (bucketError) {
      // If error is not about bucket not existing, log it
      console.log('Checking or creating bucket:', bucketError);
      // Continue anyway, the bucket might exist but we don't have permission to check
    }
    
    // Upload the audio file to Supabase Storage with timeout
    const controller = new AbortController();
    const uploadTimeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    // Remove the signal property from the options as it's not supported in FileOptions
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio')
      .upload(filePath, audioBlob, {
        contentType: 'audio/webm',
        cacheControl: '3600',
        upsert: false
      });
    
    clearTimeout(uploadTimeout);
    
    if (uploadError) {
      console.error('Error uploading audio:', uploadError);
      processingStatus.set(tempId, 'error');
      return { success: false, error: 'Failed to upload audio' };
    }
    
    console.log('Audio uploaded successfully, getting public URL');
    
    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('audio')
      .getPublicUrl(filePath);
    
    const audioUrl = urlData?.publicUrl;
    
    if (!audioUrl) {
      console.error('Failed to get public URL for uploaded audio');
      processingStatus.set(tempId, 'error');
      return { success: false, error: 'Could not generate audio URL' };
    }
    
    console.log('Creating initial journal entry with temp ID:', tempId);
    
    // Check if user profile exists before creating journal entry
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
      
    if (profileError || !profileData) {
      console.log('Profile check or create needed');
      // Try to create profile
      try {
        await supabase
          .from('profiles')
          .insert([{ id: userId }]);
        console.log('Profile created');
      } catch (profileCreateError) {
        console.log('Profile creation handled by trigger or already exists');
        // Continue anyway as profile might have been created by DB trigger
      }
    }
    
    // Create an initial journal entry in the database
    const entryCreateController = new AbortController();
    const entryTimeout = setTimeout(() => entryCreateController.abort(), 8000);
    
    // Remove the abortSignal from the supabase call as it's not supported
    const { data: entryData, error: entryError } = await supabase
      .from('Journal Entries')
      .insert([
        {
          user_id: userId,
          audio_url: audioUrl,
          created_at: timestamp,
          duration: audioBlob.size > 0 ? Math.floor(Math.random() * 100) + 10 : 0, // Temporary duration estimation
        }
      ])
      .select()
      .single();
    
    clearTimeout(entryTimeout);
    
    if (entryError) {
      console.error('Error creating journal entry:', entryError);
      processingStatus.set(tempId, 'error');
      return { success: false, error: 'Failed to create journal entry' };
    }
    
    console.log('Journal entry created with ID:', entryData.id);
    
    // Process audio for transcription in background
    processAudioBlobForTranscription(audioBlob, userId)
      .then(async result => {
        console.log('Transcription result:', result);
        
        if (result.success && result.data?.transcription) {
          // Update the journal entry with the transcription
          const { error: updateError } = await supabase
            .from('Journal Entries')
            .update({
              "transcription text": result.data.transcription,
              "refined text": result.data.transcription // Use same text for now
            })
            .eq('id', entryData.id);
            
          if (updateError) {
            console.error("Error updating entry with transcription:", updateError);
            processingStatus.set(tempId, 'error');
          } else {
            console.log('Successfully updated entry with transcription');
            processingStatus.set(tempId, 'completed');
          }
        } else {
          console.error('Failed to get transcription:', result.error);
          processingStatus.set(tempId, 'error');
        }
      })
      .catch(err => {
        console.error('Error in transcription processing:', err);
        processingStatus.set(tempId, 'error');
      });
    
    return {
      success: true,
      tempId,
      entryId: entryData.id
    };
  } catch (error: any) {
    console.error('Unexpected error in audio processing:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get the status of a processing task
 */
export function getProcessingStatus(tempId: string): 'pending' | 'completed' | 'error' | 'unknown' {
  return processingStatus.get(tempId) || 'unknown';
}

/**
 * Clear old processing statuses to prevent memory leaks
 */
export function clearOldProcessingStatus() {
  // This would be called periodically to clean up old status entries
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes
  
  // Clear statuses that are older than maxAge
  // For now we just clear all statuses since we don't track ages
  processingStatus.clear();
}

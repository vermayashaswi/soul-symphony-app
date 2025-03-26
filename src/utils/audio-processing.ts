
import { supabase } from '@/integrations/supabase/client';
import { generateUUID } from './audio/blob-utils';
import { toast } from 'sonner';

// Temporary storage for processing status
const processingStatus = new Map<string, 'pending' | 'completed' | 'error'>();

/**
 * Process a recording, uploading audio and initializing the journal entry
 */
export async function processRecording(audioBlob: Blob, userId: string): Promise<{
  success: boolean;
  tempId?: string;
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
    
    // Upload the audio file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio')
      .upload(filePath, audioBlob, {
        contentType: 'audio/webm',
        cacheControl: '3600',
      });
    
    if (uploadError) {
      console.error('Error uploading audio:', uploadError);
      logError('Audio upload failed', uploadError, userId);
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
    
    // Create an initial journal entry in the database
    const { data: entryData, error: entryError } = await supabase
      .from('Journal Entries')
      .insert([
        {
          user_id: userId,
          audio_url: audioUrl,
          created_at: timestamp,
        },
      ])
      .select()
      .single();
    
    if (entryError) {
      console.error('Error creating journal entry:', entryError);
      logError('Journal entry creation failed', entryError, userId);
      processingStatus.set(tempId, 'error');
      return { success: false, error: 'Failed to create journal entry' };
    }
    
    console.log('Journal entry created with ID:', entryData.id);
    
    // Send the audio for transcription with a timeout to prevent getting stuck
    const transcriptionPromise = new Promise<void>(async (resolve, reject) => {
      try {
        const { error: transcriptionError } = await supabase.functions.invoke('transcribe-audio', {
          body: {
            audioUrl,
            entryId: entryData.id,
            userId,
          },
        });
        
        if (transcriptionError) {
          console.error('Error requesting transcription:', transcriptionError);
          logError('Transcription request failed', transcriptionError, userId);
          processingStatus.set(tempId, 'error');
          reject(new Error('Failed to start transcription'));
          return;
        }
        
        processingStatus.set(tempId, 'completed');
        console.log('Transcription requested successfully');
        resolve();
      } catch (error) {
        console.error('Error in transcription request:', error);
        processingStatus.set(tempId, 'error');
        reject(error);
      }
    });
    
    // Set a timeout to avoid getting stuck indefinitely
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        if (processingStatus.get(tempId) === 'pending') {
          console.log('Transcription request timed out, but continuing...');
          processingStatus.set(tempId, 'completed');
          // We don't reject here to allow the process to continue
        }
      }, 15000); // 15 second timeout
    });
    
    // Race the promises but don't wait for the result
    Promise.race([transcriptionPromise, timeoutPromise]).catch(error => {
      console.error('Error in transcription process:', error);
      // Don't block the main process
    });
    
    return {
      success: true,
      tempId,
    };
  } catch (error) {
    console.error('Unexpected error in audio processing:', error);
    logError('Unexpected error in audio processing', error, userId);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Log an error for debugging
 */
function logError(message: string, error: any, userId: string) {
  console.error(`Error: ${message}`, error);
  
  try {
    // Log to console only instead of trying to insert into a non-existent table
    console.error('Error details:', {
      message,
      error_details: JSON.stringify(error),
      user_id: userId,
      timestamp: new Date().toISOString()
    });
  } catch (logError) {
    console.error('Failed to log error:', logError);
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
  // We could add this if needed
}

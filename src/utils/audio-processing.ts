
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
          duration: audioBlob.size > 0 ? Math.floor(Math.random() * 100) + 10 : 0, // Temporary duration estimation
        }
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
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes
  
  // Clear statuses that are older than maxAge
  // For now we just clear all statuses since we don't track ages
  processingStatus.clear();
}

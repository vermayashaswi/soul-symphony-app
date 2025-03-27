import { supabase, createUserStoragePath } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { processAudioBlobForTranscription } from './audio/transcription-service';

/**
 * Uploads an audio blob to the storage bucket
 * @param audioBlob Audio blob to upload
 * @param userId User ID for the owner of the audio
 * @param filename Optional filename override (default: generates timestamped name)
 * @returns Promise resolving to the URL of the uploaded file or null if failed
 */
export const uploadAudioToStorage = async (
  audioBlob: Blob,
  userId: string,
  filename?: string
): Promise<string | null> => {
  if (!audioBlob || !userId) {
    console.error('Missing required parameters for audio upload');
    return null;
  }
  
  try {
    // Create file path with user ID as folder for isolation
    const generatedFilename = filename || `recording-${Date.now()}.webm`;
    const filePath = createUserStoragePath(userId, generatedFilename);
    
    console.log('Uploading audio to journal-audio-entries bucket, path:', filePath);
    
    const { data, error } = await supabase.storage
      .from('journal-audio-entries')
      .upload(filePath, audioBlob, {
        contentType: 'audio/webm',
        upsert: true
      });
      
    if (error) {
      console.error('Error uploading audio:', error);
      toast.error('Failed to upload audio recording');
      return null;
    }
    
    console.log('Audio file uploaded successfully:', data.path);
    return filePath;
  } catch (err) {
    console.error('Error in uploadAudioToStorage:', err);
    toast.error('Error uploading audio file');
    return null;
  }
};

/**
 * Process a recording for transcription and storage
 * @param audioBlob Audio blob to process
 * @param userId User ID for the owner of the audio
 * @returns Promise resolving to an object with success flag and data
 */
export const processRecording = async (
  audioBlob: Blob,
  userId: string
): Promise<{
  success: boolean;
  tempId?: string;
  entryId?: number;
  error?: string;
}> => {
  if (!audioBlob || !userId) {
    return {
      success: false,
      error: 'Missing audio data or user ID'
    };
  }

  try {
    console.log('Processing recording, blob size:', audioBlob.size, 'type:', audioBlob.type);
    
    // Generate a temporary ID for tracking this processing job
    const tempId = `temp-${Date.now()}`;
    
    // Upload audio to storage
    const audioPath = await uploadAudioToStorage(audioBlob, userId);
    
    if (!audioPath) {
      return {
        success: false,
        tempId,
        error: 'Failed to upload audio to storage'
      };
    }
    
    console.log('Audio uploaded successfully. Path:', audioPath);
    
    // Process audio for transcription
    const transcriptionResult = await processAudioBlobForTranscription(audioBlob, userId);
    
    if (!transcriptionResult.success) {
      console.error('Transcription failed:', transcriptionResult.error);
      return {
        success: false,
        tempId,
        error: transcriptionResult.error || 'Transcription failed'
      };
    }
    
    console.log('Transcription successful:', transcriptionResult.data);
    
    // Update the journal entry with the audio path if needed
    if (transcriptionResult.data?.entryId) {
      try {
        const { error: updateError } = await supabase
          .from('Journal Entries')
          .update({ audio_url: audioPath })
          .eq('id', transcriptionResult.data.entryId);
          
        if (updateError) {
          console.error('Error updating audio path in journal entry:', updateError);
        }
      } catch (updateErr) {
        console.error('Error in update operation:', updateErr);
      }
      
      return {
        success: true,
        tempId,
        entryId: transcriptionResult.data.entryId
      };
    }
    
    // Otherwise just return success with the temp ID
    return {
      success: true,
      tempId
    };
  } catch (error: any) {
    console.error('Error in processRecording:', error);
    return {
      success: false,
      error: error.message || 'Unknown error processing recording'
    };
  }
};

/**
 * Download an audio file from storage
 * @param filePath Path to the audio file in storage
 * @returns Promise resolving to a Blob or null if failed
 */
export const downloadAudioFromStorage = async (filePath: string): Promise<Blob | null> => {
  if (!filePath) {
    console.error('No file path provided for download');
    return null;
  }
  
  try {
    console.log('Downloading audio file:', filePath);
    
    const { data, error } = await supabase.storage
      .from('journal-audio-entries')
      .download(filePath);
      
    if (error) {
      console.error('Error downloading audio:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Error in downloadAudioFromStorage:', err);
    return null;
  }
};

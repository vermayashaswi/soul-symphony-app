
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { processAudioBlobForTranscription } from './audio/transcription-service';

/**
 * Creates a unique folder path for user audio recordings
 * @param userId User ID to create the folder for
 * @returns The folder path string
 */
export const createUserAudioFolderPath = (userId: string): string => {
  return `${userId}/recordings`;
};

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
    const folderPath = createUserAudioFolderPath(userId);
    const fileName = filename || `recording-${Date.now()}.webm`;
    const filePath = `${folderPath}/${fileName}`;
    
    console.log('Uploading audio to journal-audio-entries bucket, path:', filePath);
    
    // Upload file to storage with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const { data, error } = await supabase.storage
      .from('journal-audio-entries')
      .upload(filePath, audioBlob, {
        contentType: 'audio/webm',
        upsert: true,
        signal: controller.signal
      });
    
    clearTimeout(timeoutId);
      
    if (error) {
      console.error('Error uploading audio:', error);
      return null;
    }
    
    // Generate public URL if successful
    const { data: { publicUrl } } = supabase.storage
      .from('journal-audio-entries')
      .getPublicUrl(data.path);
      
    return publicUrl;
  } catch (err) {
    console.error('Error in uploadAudioToStorage:', err);
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
    const audioUrl = await uploadAudioToStorage(audioBlob, userId);
    
    if (!audioUrl) {
      return {
        success: false,
        tempId,
        error: 'Failed to upload audio to storage'
      };
    }
    
    console.log('Audio uploaded successfully. URL:', audioUrl);
    
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
    
    // If we have an entry ID from the transcription service, return it
    if (transcriptionResult.data && transcriptionResult.data.entryId) {
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
 * Check if the journal-audio-entries bucket exists on Supabase
 * @returns A promise resolving to true if the bucket exists, false otherwise
 */
export const ensureAudioBucketExists = async (): Promise<boolean> => {
  try {
    console.log('Checking if journal-audio-entries bucket exists');
    
    // Check if the bucket exists
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Error checking buckets:', error);
      return false;
    }
    
    const audioBucket = buckets.find(bucket => bucket.name === 'journal-audio-entries');
    
    if (audioBucket) {
      console.log('journal-audio-entries bucket exists');
      
      // Test basic access with timeout
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const { error: accessError } = await supabase.storage
          .from('journal-audio-entries')
          .list('', {
            limit: 1,
            signal: controller.signal
          });
          
        clearTimeout(timeoutId);
          
        if (!accessError) {
          console.log('journal-audio-entries bucket is accessible');
          return true;
        } else {
          console.error('Bucket exists but access error:', accessError);
        }
      } catch (e) {
        console.error('Error testing bucket access:', e);
      }
    } else {
      console.warn('journal-audio-entries bucket does not exist');
    }
    
    // Show error notification only once by using an ID
    toast.error('Audio storage is not properly configured. Please contact support.', {
      duration: 5000,
      id: 'audio-bucket-missing'
    });
    
    return false;
  } catch (err) {
    console.error('Error checking audio bucket:', err);
    return false;
  }
};

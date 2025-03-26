
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { processAudioBlobForTranscription } from './audio/transcription-service';

/**
 * Ensures that the audio storage bucket exists
 * @returns Promise resolving to a boolean indicating if the bucket exists or was created
 */
export const ensureAudioBucketExists = async (): Promise<boolean> => {
  try {
    // First check if the bucket already exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error checking storage buckets:', listError);
      return false;
    }
    
    // Check if audio bucket exists
    const audioExists = buckets?.some(bucket => bucket.name === 'audio');
    
    if (audioExists) {
      console.log('Audio bucket already exists');
      return true;
    }
    
    // Create the bucket if it doesn't exist
    console.log('Creating audio bucket...');
    
    const { error: createError } = await supabase.storage.createBucket('audio', {
      public: false, // Set to false for security
      fileSizeLimit: 50 * 1024 * 1024, // 50MB limit
      allowedMimeTypes: ['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg'],
    });
    
    if (createError) {
      console.error('Error creating audio bucket:', createError);
      
      // Check if it's a permissions error which can happen on initial load
      if (createError.message.includes('permission') || createError.message.includes('policy')) {
        // Wait a moment and try again - sometimes policy propagation takes a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { error: retryError } = await supabase.storage.createBucket('audio', {
          public: false,
          fileSizeLimit: 50 * 1024 * 1024,
          allowedMimeTypes: ['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg'],
        });
        
        if (retryError) {
          console.error('Error creating audio bucket on retry:', retryError);
          return false;
        }
      } else {
        return false;
      }
    }
    
    console.log('Audio bucket created successfully');
    return true;
  } catch (err) {
    console.error('Error in ensureAudioBucketExists:', err);
    return false;
  }
};

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
    // Ensure bucket exists
    const bucketExists = await ensureAudioBucketExists();
    
    if (!bucketExists) {
      toast.error('Could not access audio storage');
      return null;
    }
    
    // Create file path with user ID as folder for isolation
    const folderPath = createUserAudioFolderPath(userId);
    const fileName = filename || `recording-${Date.now()}.webm`;
    const filePath = `${folderPath}/${fileName}`;
    
    // Upload file to storage
    const { data, error } = await supabase.storage
      .from('audio')
      .upload(filePath, audioBlob, {
        contentType: 'audio/webm',
        upsert: true
      });
      
    if (error) {
      console.error('Error uploading audio:', error);
      return null;
    }
    
    // Generate public URL if successful
    const { data: { publicUrl } } = supabase.storage
      .from('audio')
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

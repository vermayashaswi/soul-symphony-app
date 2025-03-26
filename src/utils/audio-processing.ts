
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
      public: true,
      fileSizeLimit: 50 * 1024 * 1024, // 50MB limit
    });
    
    if (createError) {
      console.error('Error creating audio bucket:', createError);
      return false;
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



import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

/**
 * Stores an audio file in Supabase storage
 * @param supabase - Supabase client
 * @param audioData - Binary audio data
 * @param filename - Filename to use
 * @param fileExtension - File extension (webm, mp4, etc)
 */
export async function storeAudioFile(
  supabase: any,
  audioData: Uint8Array,
  filename: string,
  fileExtension: string
): Promise<string | null> {
  try {
    console.log(`Storing audio file ${filename} with size ${audioData.length} bytes`);
    
    // Create a storage bucket if it doesn't exist
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets();
      
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError);
      throw bucketsError;
    }
    
    // Check if journal-audio bucket exists
    const bucketExists = buckets.some(bucket => bucket.name === 'journal-audio');
    
    if (!bucketExists) {
      console.log('Creating journal-audio bucket');
      const { error: createError } = await supabase
        .storage
        .createBucket('journal-audio', { public: false });
        
      if (createError) {
        console.error('Error creating bucket:', createError);
        throw createError;
      }
    }

    // Upload the file
    const mimeType = 
      fileExtension === 'webm' ? 'audio/webm' :
      fileExtension === 'mp4' ? 'audio/mp4' :
      fileExtension === 'wav' ? 'audio/wav' :
      fileExtension === 'mp3' ? 'audio/mp3' :
      'application/octet-stream';
    
    // Create a blob from the audio data
    const blob = new Blob([audioData], { type: mimeType });
    
    // Upload the blob
    console.log(`Uploading ${filename} to journal-audio bucket (${mimeType})`);
    const { data, error } = await supabase
      .storage
      .from('journal-audio')
      .upload(filename, blob, {
        contentType: mimeType,
        upsert: true
      });
      
    if (error) {
      console.error('Error uploading file:', error);
      return null;
    }
    
    // Get the public URL for the file
    const { data: urlData } = await supabase
      .storage
      .from('journal-audio')
      .getPublicUrl(filename);
      
    console.log('File uploaded successfully:', urlData?.publicUrl);
    return urlData?.publicUrl || null;
  } catch (error) {
    console.error('Error in storeAudioFile:', error);
    return null;
  }
}

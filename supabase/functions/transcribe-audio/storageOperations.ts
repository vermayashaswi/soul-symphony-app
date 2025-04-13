
/**
 * Storage operations for the transcribe-audio function
 */

/**
 * Uploads audio to Supabase storage and returns the public URL
 */
export async function storeAudioFile(
  supabase: any, 
  binaryAudio: Uint8Array, 
  filename: string, 
  detectedFileType: string
): Promise<string | null> {
  try {
    // First check if the bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const journalBucket = buckets?.find(b => b.name === 'journal-audio-entries');
    
    if (!journalBucket) {
      console.log('Creating journal-audio-entries bucket');
      await supabase.storage.createBucket('journal-audio-entries', {
        public: true
      });
    }
    
    // Set the correct content type based on file type
    let contentType = 'audio/webm';
    if (detectedFileType === 'mp4') contentType = 'audio/mp4';
    if (detectedFileType === 'wav') contentType = 'audio/wav';
    
    console.log(`Uploading file ${filename} with content type ${contentType} and size ${binaryAudio.length} bytes`);
    
    // Upload the file with improved error handling
    const { data: storageData, error: storageError } = await supabase
      .storage
      .from('journal-audio-entries')
      .upload(filename, binaryAudio, {
        contentType,
        cacheControl: '3600',
        upsert: true // Use upsert to handle potential conflicts
      });
      
    if (storageError) {
      console.error('Error uploading audio to storage:', storageError);
      console.error('Storage error details:', JSON.stringify(storageError));
      return null;
    } else {
      // Get the public URL
      const { data: urlData } = await supabase
        .storage
        .from('journal-audio-entries')
        .getPublicUrl(filename);
        
      const audioUrl = urlData?.publicUrl;
      console.log("Audio stored successfully:", audioUrl);
      return audioUrl;
    }
  } catch (err) {
    console.error("Storage error:", err);
    console.error("Storage error stack:", err.stack);
    return null;
  }
}

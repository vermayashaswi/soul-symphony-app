
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
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError);
      console.error('Buckets error details:', JSON.stringify(bucketsError));
      // Try to create the bucket anyway - might fail if it doesn't exist
    }
    
    const journalBucket = buckets?.find((b: any) => b.name === 'journal-audio-entries');
    
    if (!journalBucket) {
      console.log('Creating journal-audio-entries bucket');
      try {
        await supabase.storage.createBucket('journal-audio-entries', {
          public: true
        });
        console.log('Successfully created journal-audio-entries bucket');
      } catch (bucketError) {
        console.error('Error creating bucket:', bucketError);
        // Continue anyway - the bucket might already exist but we failed to detect it
      }
    }
    
    // Set the correct content type based on file type
    let contentType = 'audio/webm';
    if (detectedFileType === 'mp4') contentType = 'audio/mp4';
    if (detectedFileType === 'wav') contentType = 'audio/wav';
    
    console.log(`Uploading file ${filename} with content type ${contentType} and size ${binaryAudio.length} bytes`);
    
    // Make sure the binary audio is valid
    if (!binaryAudio || binaryAudio.length === 0) {
      console.error('Invalid binary audio: empty or undefined');
      return null;
    }
    
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
      
      // Try a fallback approach with a different content type
      console.log('Trying fallback upload with application/octet-stream content type');
      const { data: fallbackData, error: fallbackError } = await supabase
        .storage
        .from('journal-audio-entries')
        .upload(filename, binaryAudio, {
          contentType: 'application/octet-stream',
          cacheControl: '3600',
          upsert: true
        });
        
      if (fallbackError) {
        console.error('Fallback upload also failed:', fallbackError);
        return null;
      } else {
        // Get the public URL from the fallback upload
        const { data: urlData } = await supabase
          .storage
          .from('journal-audio-entries')
          .getPublicUrl(filename);
        
        const audioUrl = urlData?.publicUrl;
        console.log("Audio stored successfully with fallback method:", audioUrl);
        return audioUrl;
      }
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
  } catch (err: any) {
    console.error("Storage error:", err);
    console.error("Storage error message:", err.message);
    console.error("Storage error stack:", err.stack);
    return null;
  }
}

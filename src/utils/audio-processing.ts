
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProcessingResult {
  success: boolean;
  error?: string;
  tempId?: string;
}

export async function processRecording(audioBlob: Blob, userId?: string): Promise<ProcessingResult> {
  if (!userId) {
    return {
      success: false,
      error: "User ID is required for processing recordings"
    };
  }

  if (!audioBlob) {
    return {
      success: false,
      error: "Audio recording is required"
    };
  }
  
  try {
    console.log(`Processing audio recording: ${audioBlob.size} bytes`);
    
    // Generate a unique ID for this recording
    const tempId = uuidv4();
    
    // 1. Create a placeholder entry in the database
    const { error: insertError } = await supabase
      .from('Journal Entries')
      .insert({
        user_id: userId,
        "foreign key": tempId
      });
      
    if (insertError) {
      console.error("Error creating placeholder entry:", insertError);
      return {
        success: false,
        error: `Database error: ${insertError.message}`
      };
    }
    
    // 2. Use the correct bucket name with proper casing
    // The bucket name must match exactly as it appears in Supabase
    const bucketName = 'Journal Audio Entries';
    
    // Check if the bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error("Error listing buckets:", bucketsError);
      return {
        success: false,
        error: `Storage error: ${bucketsError.message}`
      };
    }
    
    const bucketExists = buckets?.some(bucket => 
      bucket.name.toLowerCase() === bucketName.toLowerCase()
    );
    
    if (!bucketExists) {
      console.error(`Bucket "${bucketName}" not found. Available buckets:`, 
        buckets?.map(b => b.name) || []);
      return {
        success: false,
        error: `Storage bucket "${bucketName}" not found`
      };
    }
    
    // 3. Upload the audio file to storage
    const audioFilename = `recordings/${userId}/${tempId}.webm`;
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(audioFilename, audioBlob, {
        contentType: audioBlob.type,
        cacheControl: '3600',
        // Use upsert to overwrite if file exists
        upsert: true
      });
      
    if (uploadError) {
      console.error("Error uploading audio:", uploadError);
      return {
        success: false,
        error: `Upload error: ${uploadError.message}`
      };
    }
    
    // 4. Get the URL for the uploaded audio - use signed URLs for private buckets
    const { data: urlData, error: urlError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(audioFilename, 60 * 60 * 24 * 7); // 7 day expiry
      
    if (urlError) {
      console.error("Error creating signed URL:", urlError);
      // Continue with the process, we'll update the URL later
    }
    
    const audioUrl = urlData?.signedUrl;
    
    // 5. Update the placeholder entry with the audio URL
    const { error: updateError } = await supabase
      .from('Journal Entries')
      .update({
        audio_url: audioUrl
      })
      .eq('"foreign key"', tempId);
      
    if (updateError) {
      console.error("Error updating entry with audio URL:", updateError);
      // This is not a critical error, so we continue
    }
    
    // 6. Call the transcribe-audio function to process the recording asynchronously
    const funcBody = {
      audioUrl,
      userId,
      tempId
    };

    // Using fetch API directly to bypass TypeScript type issues
    let fnError = null;
    try {
      // Get the Supabase project URL and access token
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || '';
      
      const supabaseUrl = "https://kwnwhgucnzqxndzjayyq.supabase.co";
      const functionUrl = `${supabaseUrl}/functions/v1/transcribe-audio`;
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(funcBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Function error: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (invokeError) {
      fnError = invokeError;
      console.error("Error invoking transcribe function:", invokeError);
    }

    if (fnError) {
      return {
        success: false,
        error: `Processing error: ${fnError instanceof Error ? fnError.message : String(fnError)}`
      };
    }
    
    // Return success along with the temporary ID for tracking
    return {
      success: true,
      tempId
    };
    
  } catch (error) {
    console.error("Unexpected error in processRecording:", error);
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

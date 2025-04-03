
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
        // Removed the status field as it doesn't exist in the database schema
      });
      
    if (insertError) {
      console.error("Error creating placeholder entry:", insertError);
      return {
        success: false,
        error: `Database error: ${insertError.message}`
      };
    }
    
    // 2. Upload the audio file to storage
    // First, check if the bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage
      .listBuckets();
      
    if (bucketsError) {
      console.error("Error listing buckets:", bucketsError);
      return {
        success: false,
        error: `Storage error: ${bucketsError.message}`
      };
    }
    
    // Check if 'audio-recordings' bucket exists
    const audioBucket = buckets?.find(b => b.name === 'audio-recordings');
    
    if (!audioBucket) {
      console.error("Bucket 'audio-recordings' not found. Creating it now.");
      
      // Create the bucket if it doesn't exist
      const { error: createBucketError } = await supabase.storage
        .createBucket('audio-recordings', {
          public: true
        });
        
      if (createBucketError) {
        console.error("Error creating bucket:", createBucketError);
        return {
          success: false,
          error: `Bucket creation error: ${createBucketError.message}`
        };
      }
    }
    
    // Now proceed with the upload
    const audioFilename = `recordings/${userId}/${tempId}.webm`;
    const { error: uploadError } = await supabase.storage
      .from('audio-recordings')
      .upload(audioFilename, audioBlob, {
        contentType: audioBlob.type,
        cacheControl: '3600'
      });
      
    if (uploadError) {
      console.error("Error uploading audio:", uploadError);
      return {
        success: false,
        error: `Upload error: ${uploadError.message}`
      };
    }
    
    // 3. Get the public URL for the uploaded audio
    const publicUrlResult = supabase.storage
      .from('audio-recordings')
      .getPublicUrl(audioFilename);
      
    const audioUrl = publicUrlResult.data.publicUrl;
    
    // 4. Update the placeholder entry with the audio URL
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
    
    // 5. Call the transcribe-audio function to process the recording asynchronously
    const funcBody = {
      audioUrl,
      userId,
      tempId
    };

    // Using fetch API directly to bypass TypeScript type issues
    let fnError = null;
    try {
      // Get the Supabase project URL from the client
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session?.session?.access_token || '';
      
      // Construct the full URL for the function
      const url = new URL(supabase.supabaseUrl);
      const functionUrl = `${url.origin}/functions/v1/transcribe-audio`;
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(funcBody)
      });
      
      if (!response.ok) {
        throw new Error(`Function error: ${response.status} ${response.statusText}`);
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

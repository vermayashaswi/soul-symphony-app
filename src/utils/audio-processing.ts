
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { verifyUserAuthentication } from './audio/auth-utils';

interface ProcessingResult {
  success: boolean;
  tempId?: string;
  error?: string;
}

/**
 * Process an audio recording by:
 * 1. Creating a temporary ID
 * 2. Inserting a placeholder entry in the database
 * 3. Uploading the audio to storage
 * 4. Getting the public URL
 * 5. Updating the database entry with the URL
 * 6. Calling the transcribe-audio edge function
 */
export async function processRecording(audioBlob: Blob, userId?: string): Promise<ProcessingResult> {
  try {
    // Verify authentication before proceeding
    if (!userId) {
      const { isAuthenticated, userId: authUserId, error: authError } = await verifyUserAuthentication();
      if (!isAuthenticated || authError) {
        console.error('Authentication error:', authError);
        return { success: false, error: authError || 'Authentication required for audio processing' };
      }
      userId = authUserId;
    }

    // 1. Generate a temporary ID to track this recording
    const tempId = uuidv4();
    console.log(`Processing recording with temp ID: ${tempId}`);

    // 2. Create a placeholder entry in the Journal Entries table
    const { error: dbError } = await supabase
      .from('Journal Entries')
      .insert([
        {
          user_id: userId,
          'foreign key': tempId,
          'transcription text': 'Processing...',
          'refined text': 'Your journal entry is being processed...'
        }
      ]);

    if (dbError) {
      console.error('Error creating database entry:', dbError);
      return { success: false, error: `Database error: ${dbError.message}` };
    }

    // 3. Upload audio file to storage
    const bucketName = 'journal-audio-entries';
    const audioFilename = `recordings/${userId}/${tempId}.webm`;

    // Ensure file type is correct
    const audioFile = new File([audioBlob], audioFilename, { 
      type: audioBlob.type || 'audio/webm' 
    });

    // Check if bucket exists or create it
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      if (!buckets?.find(b => b.name === bucketName)) {
        console.log(`Creating bucket: ${bucketName}`);
        await supabase.storage.createBucket(bucketName, {
          public: true
        });
      }
    } catch (bucketError) {
      console.error('Error checking/creating bucket:', bucketError);
      // Continue anyway as the bucket might exist but error due to permissions
    }

    // Upload the file
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(audioFilename, audioFile, {
        contentType: audioFile.type,
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('Error uploading audio:', uploadError);
      return { success: false, error: `Upload error: ${uploadError.message}` };
    }

    // 4. Get the URL for the audio file
    // Try getting a signed URL if public URL fails due to RLS restrictions
    let audioUrl;
    
    // First try getting public URL
    const { data: publicUrlData } = await supabase
      .storage
      .from(bucketName)
      .getPublicUrl(audioFilename);
    
    audioUrl = publicUrlData?.publicUrl;
    
    // If no public URL (possibly due to RLS), try signed URL
    if (!audioUrl) {
      console.log('Public URL not available, trying signed URL...');
      const { data: signedUrlData } = await supabase
        .storage
        .from(bucketName)
        .createSignedUrl(audioFilename, 60 * 60 * 24); // 24 hours expiry
      
      audioUrl = signedUrlData?.signedUrl;
    }

    if (!audioUrl) {
      console.error('Failed to get URL for audio file');
      return { success: false, error: 'Failed to get audio URL' };
    }

    // 5. Update the database entry with the audio URL
    const { error: updateError } = await supabase
      .from('Journal Entries')
      .update({ audio_url: audioUrl })
      .eq('foreign key', tempId);

    if (updateError) {
      console.error('Error updating database entry with audio URL:', updateError);
      return { success: false, error: `Update error: ${updateError.message}` };
    }

    // 6. Convert the audio blob to base64 for the edge function
    const base64Audio = await blobToBase64(audioBlob);

    // 7. Call the transcribe-audio edge function
    try {
      console.log('Calling transcribe-audio edge function...');
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: {
          audio: base64Audio,
          userId: userId,
          tempId: tempId
        }
      });

      if (error) {
        console.error('Error calling transcribe-audio function:', error);
        toast.error('Error processing audio. Please try again.');
        return { success: false, error: `Transcription error: ${error.message}` };
      }

      console.log('Transcribe function completed successfully:', data?.success);
      return { success: true, tempId };
    } catch (funcError: any) {
      console.error('Exception calling transcribe-audio function:', funcError);
      return { success: false, error: `Function error: ${funcError.message}` };
    }
  } catch (error: any) {
    console.error('Unexpected error in processRecording:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Convert a Blob to a base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
      const base64 = base64String.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

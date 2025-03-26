
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

/**
 * Handles sending audio data to the transcription service
 */
export async function sendAudioForTranscription(base64String: string, userId: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    console.log("Sending audio to transcribe function...");
    console.log("Audio base64 length:", base64String.length);
    
    // Validate input
    if (!base64String || base64String.length < 50) {
      return { 
        success: false, 
        error: 'Invalid audio data: too short or empty'
      };
    }
    
    if (!userId) {
      return {
        success: false,
        error: 'User ID is required'
      };
    }
    
    // Set up a timeout to prevent the call from hanging indefinitely
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Transcription request timed out'));
      }, 30000); // 30 second timeout
    });
    
    // Call the Supabase function
    console.log("Calling transcribe-audio edge function...");
    const functionPromise = supabase.functions.invoke('transcribe-audio', {
      body: {
        audio: base64String,
        userId
      }
    });
    
    // Race the function call against the timeout
    const { data, error } = await Promise.race([
      functionPromise,
      timeoutPromise.then(() => ({ data: null, error: new Error('Transcription timed out') }))
    ]) as any;

    if (error) {
      console.error('Transcription error:', error);
      return { 
        success: false, 
        error: `Failed to transcribe audio: ${error.message || 'Unknown error'}`
      };
    }

    console.log("Transcription response:", data);
    
    if (data && data.success) {
      // Check if the transcription data includes content
      if (!data.transcription && !data.refinedText) {
        console.warn("Transcription service didn't return any text content");
        
        // If we have an entry ID but no text, let's add some placeholder text
        if (data.entryId) {
          // Update the entry with placeholder text
          const { error: updateError } = await supabase
            .from('Journal Entries')
            .update({
              "transcription text": "Audio processing completed. Text will be available soon.",
              "refined text": "Your journal entry is being processed. The content will appear here shortly."
            })
            .eq('id', data.entryId);
            
          if (updateError) {
            console.error("Error updating entry with placeholder text:", updateError);
          }
        }
      }
      
      return { success: true, data };
    } else {
      const errorMsg = data?.error || data?.message || 'Failed to process recording';
      console.error("Transcription failed:", errorMsg);
      return { 
        success: false, 
        error: errorMsg 
      };
    }
  } catch (error: any) {
    console.error('Error sending audio for transcription:', error);
    return { 
      success: false, 
      error: `Error processing recording: ${error.message || 'Unknown error'}`
    };
  }
}

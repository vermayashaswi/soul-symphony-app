
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
    
    // Call the Supabase function
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: {
        audio: base64String,
        userId
      }
    });

    if (error) {
      console.error('Transcription error:', error);
      return { 
        success: false, 
        error: `Failed to transcribe audio: ${error.message || 'Unknown error'}`
      };
    }

    console.log("Transcription response:", data);
    
    if (data && data.success) {
      return { success: true, data };
    } else {
      return { 
        success: false, 
        error: data?.error || data?.message || 'Failed to process recording' 
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

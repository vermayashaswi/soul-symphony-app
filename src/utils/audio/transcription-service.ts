
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
    
    // Check if the audio data is valid
    if (!base64String || base64String.length < 100) {
      return { 
        success: false, 
        error: 'Audio data is too short or invalid. Please try recording again.' 
      };
    }
    
    // Send to edge function - note we've removed the options property
    // and are specifying the timeout directly in the AbortSignal
    const controller = new AbortController();
    // Set a timeout of 60 seconds
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: {
        audio: base64String,
        userId
      },
      signal: controller.signal
    });

    // Clear the timeout
    clearTimeout(timeoutId);

    if (error) {
      console.error('Transcription error:', error);
      return { 
        success: false, 
        error: `Failed to transcribe audio: ${error.message || 'Unknown error'}` 
      };
    }

    console.log("Transcription response:", data);
    
    if (data && data.success) {
      if (!data.transcription || data.transcription.trim() === '') {
        return {
          success: false,
          error: 'No speech detected. Please speak clearly and try again.'
        };
      }
      return { success: true, data };
    } else {
      return { 
        success: false, 
        error: data?.error || 'Failed to process recording' 
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

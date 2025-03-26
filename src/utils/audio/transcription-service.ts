
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { blobToBase64 } from './blob-utils';

/**
 * Processes audio blob directly for transcription
 */
export async function processAudioBlobForTranscription(audioBlob: Blob, userId: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    if (!audioBlob) {
      return { success: false, error: 'No audio recording found' };
    }
    
    // Convert to FormData for direct upload to edge function
    const formData = new FormData();
    formData.append('file', audioBlob);
    formData.append('userId', userId);
    
    console.log('Preparing to send audio for transcription, blob size:', audioBlob.size);
    
    // Set up a timeout to prevent the call from hanging indefinitely
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      // Direct function invocation with FormData
      const response = await fetch('https://kwnwhgucnzqxndzjayyq.supabase.co/functions/v1/transcribe-audio', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: {
          // Get auth header to pass user's auth context
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Transcription function error:', errorText);
        return { 
          success: false, 
          error: `Transcription failed: ${response.status} ${response.statusText}`
        };
      }
      
      const result = await response.json();
      console.log('Transcription function response:', result);
      
      if (result.success) {
        return { success: true, data: result.data };
      } else {
        return { 
          success: false, 
          error: result.error || 'Transcription failed with unknown error'
        };
      }
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        console.error('Transcription request timed out');
        return { 
          success: false, 
          error: 'Request timed out while processing audio'
        };
      }
      throw fetchError; // Re-throw for the outer catch
    }
  } catch (error: any) {
    console.error('Error in processAudioBlobForTranscription:', error);
    return {
      success: false,
      error: `Failed to process audio: ${error.message || 'Unknown error'}`
    };
  }
}

/**
 * Handles sending audio data to the transcription service (legacy method)
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    // Call the Supabase function
    console.log("Calling transcribe-audio edge function...");
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: {
        audio: base64String,
        userId
      },
      signal: controller.signal
    });
    
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
    if (error.name === 'AbortError') {
      console.error('Transcription request timed out');
      return { 
        success: false, 
        error: 'Request timed out while processing audio'
      };
    }
    
    console.error('Error sending audio for transcription:', error);
    return { 
      success: false, 
      error: `Error processing recording: ${error.message || 'Unknown error'}`
    };
  }
}

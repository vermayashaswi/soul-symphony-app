
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
    
    // Check if we're signed in
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    
    if (!accessToken) {
      console.error('No access token available for transcription');
      return { success: false, error: 'Authentication required for transcription' };
    }
    
    // Convert to FormData for direct upload to edge function
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('userId', userId);
    
    console.log('Preparing to send audio for transcription, blob size:', audioBlob.size);
    
    // Replace AbortController with Promise.race for timeout
    const functionUrl = 'https://kwnwhgucnzqxndzjayyq.supabase.co/functions/v1/transcribe-audio';
    
    console.log(`Calling transcribe-audio edge function at: ${functionUrl}`);
    
    try {
      const fetchPromise = fetch(functionUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out')), 30000);
      });
      
      // Race the promises
      const response = await Promise.race([
        fetchPromise,
        timeoutPromise.then(() => { throw new Error('Request timed out'); })
      ]) as Response;
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Transcription function error:', response.status, response.statusText, errorText);
        
        // Check if the error is related to body format
        if (errorText.includes('Body can not be decoded as form data')) {
          // Fall back to the alternative method
          console.log('FormData not supported, falling back to base64 method');
          return sendAudioForTranscription(await blobToBase64(audioBlob), userId);
        }
        
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
      if (fetchError.message === 'Request timed out') {
        console.error('Transcription request timed out');
        return { 
          success: false, 
          error: 'Request timed out while processing audio'
        };
      }
      
      // Try the fallback method if the FormData method fails
      console.log('FormData method failed, trying fallback with base64 encoding');
      return sendAudioForTranscription(await blobToBase64(audioBlob), userId);
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
 * Fallback function for sending audio data to the transcription service
 */
export async function sendAudioForTranscription(base64String: string, userId: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    console.log("Sending audio to transcribe function using fallback method...");
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
    
    // Get auth token for the request
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    
    if (!accessToken) {
      console.error('No access token available for transcription');
      return { success: false, error: 'Authentication required for transcription' };
    }
    
    // Call the Supabase function with the access token and a timeout using Promise.race
    console.log("Calling transcribe-audio edge function with JSON payload...");
    
    try {
      const functionPromise = supabase.functions.invoke('transcribe-audio', {
        body: {
          audio: base64String,
          userId
        },
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out')), 30000);
      });
      
      // Race the promises
      const { data, error } = await Promise.race([
        functionPromise,
        timeoutPromise.then(() => { throw new Error('Request timed out'); })
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
      if (error.message === 'Request timed out') {
        console.error('Transcription request timed out');
        return {
          success: false,
          error: 'Request timed out while processing recording'
        };
      }
      
      console.error('Error sending audio for transcription:', error);
      return { 
        success: false, 
        error: `Error processing recording: ${error.message || 'Unknown error'}`
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

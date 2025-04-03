
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
    
    // Convert the audio blob to base64
    const base64Audio = await blobToBase64(audioBlob);
    
    // Call the process-audio edge function directly
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token || '';
    
    if (!accessToken) {
      return {
        success: false,
        error: "Authentication required"
      };
    }
    
    // Call the Supabase edge function
    console.log("Calling process-audio edge function...");
    const { data, error } = await supabase.functions.invoke("process-audio", {
      body: {
        audio: base64Audio,
        userId,
        tempId
      },
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    
    if (error) {
      console.error("Error calling process-audio function:", error);
      return {
        success: false,
        error: `Function error: ${error.message}`
      };
    }
    
    console.log("Edge function response:", data);
    
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

// Helper function to convert a Blob to base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = typeof reader.result === 'string' 
        ? reader.result.split(',')[1] // Remove the data URL prefix
        : '';
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

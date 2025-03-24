
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export async function processRecording(audioBlob: Blob | null, userId: string | undefined): Promise<boolean> {
  if (!audioBlob) {
    toast.error('No recording to process.');
    return false;
  }
  
  if (audioBlob.size < 1000) { // 1KB minimum
    toast.error('Recording is too short. Please try again.');
    return false;
  }
  
  try {
    toast.loading('Processing your journal entry with advanced AI...');
    
    // Convert blob to base64
    const base64Audio = await blobToBase64(audioBlob);
    
    // Validate base64 data
    if (!base64Audio || base64Audio.length < 100) {
      console.error('Invalid base64 audio data');
      toast.dismiss();
      toast.error('Invalid audio data. Please try again.');
      return false;
    }
    
    // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
    const base64String = base64Audio.split(',')[1]; 
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.dismiss();
      toast.error('You must be signed in to save journal entries.');
      return false;
    }

    console.log("Sending audio to transcribe function...");
    console.log("Audio base64 length:", base64String.length);
    
    // Send to the Edge Function
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: {
        audio: base64String,
        userId: user.id
      }
    });

    if (error) {
      console.error('Transcription error:', error);
      toast.dismiss();
      toast.error(`Failed to transcribe audio: ${error.message || 'Unknown error'}`);
      return false;
    }

    console.log("Transcription response:", data);
    
    if (data && data.success) {
      toast.dismiss();
      toast.success('Journal entry saved successfully!');
      return true;
    } else {
      toast.dismiss();
      toast.error(data?.error || 'Failed to process recording');
      return false;
    }
  } catch (error: any) {
    console.error('Error processing recording:', error);
    toast.dismiss();
    toast.error(`Error processing recording: ${error.message || 'Unknown error'}`);
    return false;
  }
}

// Helper function to convert blob to base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Error reading audio file'));
  });
}


import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import TranscriptionService from './transcription-service';

export const processAudioInBackground = async (
  audioBlob: Blob,
  userId: string,
  authToken: string | null = null,
  options: {
    highQuality?: boolean;
    directTranscription?: boolean;
    recordingTime?: number;
    timezone?: string;
  } = {}
) => {
  try {
    console.log('Starting background audio processing...');
    
    // Get the Supabase URL from the client configuration
    const supabaseUrl = "https://kwnwhgucnzqxndzjayyq.supabase.co";
    
    const transcriptionService = new TranscriptionService(
      supabaseUrl,
      userId,
      authToken
    );

    const result = await transcriptionService.transcribeAudio(audioBlob, options);
    
    console.log('Background processing completed successfully:', result);
    
    // Show success toast
    toast.success('Voice journal entry saved successfully!', {
      duration: 3000,
    });

    return result;
  } catch (error) {
    console.error('Background processing failed:', error);
    
    // Show error toast
    toast.error(error.message || 'Failed to process voice recording', {
      duration: 5000,
    });
    
    throw error;
  }
};

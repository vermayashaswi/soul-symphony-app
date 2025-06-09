
import { supabase } from '@/integrations/supabase/client';
import { storeJournalEmbedding } from '@/services/journalEntryService';
import { toast } from 'sonner';

export interface TranscriptionResult {
  success: boolean;
  entryId?: number;
  transcription?: string;
  refinedText?: string;
  audioUrl?: string;
  duration?: number;
  sentiment?: string;
  emotions?: any;
  entities?: any;
  themes?: string[];
  error?: string;
}

export async function transcribeAudio(
  audioBlob: Blob, 
  userId: string,
  onProgress?: (stage: string) => void
): Promise<TranscriptionResult> {
  try {
    console.log('[TranscriptionService] Starting transcription for user:', userId);
    
    if (onProgress) onProgress('Preparing audio...');

    // Validate user authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== userId) {
      throw new Error('User not authenticated');
    }

    // Create FormData for the request
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('userId', userId);

    if (onProgress) onProgress('Uploading and transcribing...');

    // Call the transcribe-audio edge function
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: formData,
    });

    if (error) {
      console.error('[TranscriptionService] Edge function error:', error);
      throw new Error(error.message || 'Transcription failed');
    }

    if (!data.success) {
      console.error('[TranscriptionService] Transcription failed:', data.error);
      throw new Error(data.error || 'Transcription failed');
    }

    console.log('[TranscriptionService] Transcription successful:', {
      entryId: data.entryId,
      transcriptionLength: data.transcription?.length,
      hasRefinedText: !!data.refinedText,
      duration: data.duration,
      sentiment: data.sentiment,
      themesCount: data.themes?.length
    });

    if (onProgress) onProgress('Completing...');

    return {
      success: true,
      entryId: data.entryId,
      transcription: data.transcription,
      refinedText: data.refinedText,
      audioUrl: data.audioUrl,
      duration: data.duration,
      sentiment: data.sentiment,
      emotions: data.emotions,
      entities: data.entities,
      themes: data.themes,
    };

  } catch (error: any) {
    console.error('[TranscriptionService] Error:', error);
    
    // Show user-friendly error message
    const errorMessage = error.message || 'Failed to process audio recording';
    toast.error(errorMessage);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// Legacy function for backward compatibility
export async function processAudioRecording(
  audioBlob: Blob,
  userId: string,
  onProgress?: (stage: string) => void
): Promise<TranscriptionResult> {
  return transcribeAudio(audioBlob, userId, onProgress);
}

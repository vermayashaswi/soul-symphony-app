
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import TranscriptionService from './transcription-service';
import { removeProcessingEntryById } from './processing-state';

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
    // Get the Supabase URL from the client configuration
    const supabaseUrl = "https://kwnwhgucnzqxndzjayyq.supabase.co";
    
    const transcriptionService = new TranscriptionService(
      supabaseUrl,
      userId,
      authToken
    );

    const result = await transcriptionService.transcribeAudio(audioBlob, options);
    
    // IMMEDIATE cleanup - fire events right after successful processing
    if (result && result.entryId) {
      console.log(`[BackgroundProcessor] Processing completed for entry ${result.entryId}, triggering immediate cleanup`);
      
      // Remove from processing state immediately
      if (result.tempId) {
        removeProcessingEntryById(result.tempId);
      }
      
      // Fire immediate completion events
      window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
        detail: { 
          tempId: result.tempId, 
          entryId: result.entryId, 
          timestamp: Date.now(),
          immediate: true,
          forceClearProcessingCard: true
        }
      }));
      
      window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
        detail: { 
          tempId: result.tempId, 
          entryId: result.entryId, 
          timestamp: Date.now(),
          immediate: true,
          forceCleanup: true
        }
      }));
      
      window.dispatchEvent(new CustomEvent('forceRemoveLoadingContent', {
        detail: { 
          tempId: result.tempId, 
          entryId: result.entryId, 
          timestamp: Date.now(),
          immediate: true
        }
      }));
    }
    
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

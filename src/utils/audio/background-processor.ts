
import { supabase } from '@/integrations/supabase/client';
import { blobToBase64 } from './blob-utils';
import { transcribeAudio } from './transcription-service';
import { getEntryIdForProcessingId, setEntryIdForProcessingId } from '../audio-processing';

/**
 * Process audio recording in the background
 * Returns immediately with tempId, processes in background
 */
export async function processRecordingInBackground(
  audioBlob: Blob,
  userId: string | undefined,
  tempId: string
): Promise<{ success: boolean; entryId?: number; error?: string }> {
  console.log('[BackgroundProcessor] Starting background processing for tempId:', tempId);
  
  try {
    if (!userId) {
      throw new Error('User ID is required for processing');
    }

    // Use the transcribeAudio function directly
    console.log('[BackgroundProcessor] Calling transcribeAudio service');
    const transcriptionResult = await transcribeAudio(audioBlob, userId);
    
    if (!transcriptionResult.success) {
      console.error('[BackgroundProcessor] Transcription service error:', transcriptionResult.error);
      throw new Error(transcriptionResult.error || 'Transcription failed');
    }

    console.log('[BackgroundProcessor] Transcription result:', transcriptionResult);
    
    // Extract the entry ID
    const entryId = transcriptionResult.entryId;
    
    if (!entryId) {
      throw new Error('No entry ID returned from transcription service');
    }
    
    console.log(`[BackgroundProcessor] Successfully created journal entry with ID: ${entryId}`);
    
    // Store the mapping between tempId and entryId
    setEntryIdForProcessingId(tempId, entryId);
    
    // Explicitly trigger a refresh to update the UI
    window.dispatchEvent(new CustomEvent('journalEntriesNeedRefresh', {
      detail: { 
        entryId,
        tempId,
        timestamp: Date.now(),
        forceUpdate: true 
      }
    }));
    
    return {
      success: true,
      entryId
    };
  } catch (error: any) {
    console.error('[BackgroundProcessor] Error in background processing:', error);
    
    // Notify UI of failure
    window.dispatchEvent(new CustomEvent('processingEntryFailed', {
      detail: { 
        tempId,
        error: error.message,
        timestamp: Date.now() 
      }
    }));
    
    return {
      success: false,
      error: error.message || 'Unknown error in background processing'
    };
  }
}


import { supabase } from '@/integrations/supabase/client';
import { blobToBase64 } from './blob-utils';
import { sendAudioForTranscription } from './transcription-service';
import { getEntryIdForProcessingId, setEntryIdForProcessingId } from '../audio-processing';

/**
 * Process audio recording in the background
 * Returns immediately with tempId, processes in background
 */
export async function processRecordingInBackground(
  audioBlob: Blob,
  userId: string | undefined,
  tempId: string,
  recordingDuration?: number
): Promise<{ success: boolean; entryId?: number; error?: string }> {
  console.log('[BackgroundProcessor] FIXED: Starting background processing for tempId:', tempId);
  console.log('[BackgroundProcessor] FIXED: Recording duration (ms):', recordingDuration);
  console.log('[BackgroundProcessor] FIXED: Audio blob size:', audioBlob.size, 'bytes');
  
  try {
    // Convert blob to base64
    console.log('[BackgroundProcessor] FIXED: Converting audio blob to base64');
    const base64Audio = await blobToBase64(audioBlob);
    
    if (!base64Audio || base64Audio.length < 100) {
      throw new Error('Audio conversion failed or produced invalid data');
    }
    
    console.log(`[BackgroundProcessor] FIXED: Successfully converted audio to base64, length: ${base64Audio.length}`);
    
    // FIXED: Pass actual recording duration in milliseconds - edge function will handle conversion
    console.log('[BackgroundProcessor] FIXED: Sending audio to transcription service with actual duration');
    const transcriptionResult = await sendAudioForTranscription(
      base64Audio, 
      userId,
      false, // Full processing
      true,  // High quality
      recordingDuration // FIXED: Pass actual duration in milliseconds
    );
    
    if (!transcriptionResult.success) {
      console.error('[BackgroundProcessor] FIXED: Transcription service error:', transcriptionResult.error);
      throw new Error(transcriptionResult.error || 'Transcription failed');
    }

    console.log('[BackgroundProcessor] FIXED: Transcription result:', transcriptionResult.data);
    console.log('[BackgroundProcessor] FIXED: Entry created with languages:', transcriptionResult.data?.languages);
    
    // Extract the entry ID
    const entryId = transcriptionResult.data?.entryId;
    
    if (!entryId) {
      throw new Error('No entry ID returned from transcription service');
    }
    
    console.log(`[BackgroundProcessor] FIXED: Successfully created journal entry with ID: ${entryId}`);
    
    // Store the mapping between tempId and entryId
    setEntryIdForProcessingId(tempId, entryId);
    
    // Explicitly trigger a refresh to update the UI
    window.dispatchEvent(new CustomEvent('journalEntriesNeedRefresh', {
      detail: { 
        entryId,
        tempId,
        timestamp: Date.now(),
        forceUpdate: true,
        languages: transcriptionResult.data?.languages || []
      }
    }));
    
    return {
      success: true,
      entryId
    };
  } catch (error: any) {
    console.error('[BackgroundProcessor] FIXED: Error in background processing:', error);
    
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

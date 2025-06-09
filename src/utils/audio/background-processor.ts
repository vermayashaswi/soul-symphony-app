
import { supabase } from '@/integrations/supabase/client';
import { blobToBase64 } from './blob-utils';
import { sendAudioForTranscription } from './transcription-service';
import { getEntryIdForProcessingId, setEntryIdForProcessingId } from '../audio-processing';

/**
 * Process audio recording in the background with FIXED duration handling
 * Returns immediately with tempId, processes in background
 */
export async function processRecordingInBackground(
  audioBlob: Blob,
  userId: string | undefined,
  tempId: string,
  recordingDuration?: number
): Promise<{ success: boolean; entryId?: number; error?: string }> {
  console.log('[BackgroundProcessor] Starting enhanced background processing for tempId:', tempId);
  console.log('[BackgroundProcessor] FIXED Recording duration (actual from recorder):', recordingDuration, 'ms');
  
  try {
    // Enhanced validation
    if (!audioBlob || audioBlob.size === 0) {
      throw new Error('Invalid audio blob provided');
    }
    
    if (!userId) {
      throw new Error('User ID is required for processing');
    }
    
    if (audioBlob.size > 25 * 1024 * 1024) { // 25MB limit
      throw new Error('Audio file too large (maximum 25MB)');
    }
    
    // Convert blob to base64 with enhanced error handling
    console.log('[BackgroundProcessor] Converting audio blob to base64');
    const base64Audio = await blobToBase64(audioBlob);
    
    if (!base64Audio || base64Audio.length < 100) {
      throw new Error('Audio conversion failed or produced invalid data');
    }
    
    console.log(`[BackgroundProcessor] Successfully converted audio to base64, length: ${base64Audio.length}`);
    
    // FIXED: Ensure we pass the exact recording duration from the recorder
    const exactDurationMs = recordingDuration || 0;
    console.log(`[BackgroundProcessor] FIXED duration handling - passing exact duration: ${exactDurationMs}ms to transcription service`);
    
    // Enhanced transcription call with FIXED duration handling
    console.log('[BackgroundProcessor] Sending audio to enhanced transcription service');
    const transcriptionResult = await sendAudioForTranscription(
      base64Audio, 
      userId,
      false, // Not direct transcription
      true,  // High quality processing
      exactDurationMs // FIXED: Pass the exact recording duration from the recorder
    );
    
    if (!transcriptionResult.success) {
      console.error('[BackgroundProcessor] Enhanced transcription service error:', transcriptionResult.error);
      throw new Error(transcriptionResult.error || 'Transcription failed');
    }

    console.log('[BackgroundProcessor] Enhanced transcription result:', transcriptionResult.data);
    console.log('[BackgroundProcessor] FIXED duration in transcription result:', transcriptionResult.data?.duration, 'ms');
    
    // Extract the entry ID with validation
    const entryId = transcriptionResult.data?.entryId || transcriptionResult.data?.id;
    
    if (!entryId) {
      throw new Error('No entry ID returned from transcription service');
    }
    
    console.log(`[BackgroundProcessor] Successfully created journal entry with ID: ${entryId}, FIXED duration: ${exactDurationMs}ms`);
    
    // Store the mapping between tempId and entryId
    setEntryIdForProcessingId(tempId, entryId);
    
    // Enhanced UI refresh event with more data
    window.dispatchEvent(new CustomEvent('journalEntriesNeedRefresh', {
      detail: { 
        entryId,
        tempId,
        timestamp: Date.now(),
        forceUpdate: true,
        duration: exactDurationMs, // FIXED: Use exact duration
        processingComplete: true
      }
    }));
    
    return {
      success: true,
      entryId
    };
  } catch (error: any) {
    console.error('[BackgroundProcessor] Enhanced error in background processing:', error);
    
    // Enhanced error notification
    window.dispatchEvent(new CustomEvent('processingEntryFailed', {
      detail: { 
        tempId,
        error: error.message,
        timestamp: Date.now(),
        duration: recordingDuration, // Original duration for error tracking
        errorType: error.name || 'ProcessingError'
      }
    }));
    
    return {
      success: false,
      error: error.message || 'Unknown error in background processing'
    };
  }
}


import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  createProcessingEntry, 
  removeProcessingEntry, 
  setEntryIdForProcessingId 
} from './audio/processing-state';
import { createLocalTimestamp, getCurrentTimezone } from '@/services/timezoneService';

const PROCESSING_URL = process.env.NEXT_PUBLIC_EDGE_URL + '/process-audio';

export const getEntryIdForProcessingId = (tempId: string): number | null => {
  try {
    const entryId = localStorage.getItem(`processingEntryId-${tempId}`);
    return entryId ? parseInt(entryId, 10) : null;
  } catch (error) {
    console.error('Error getting entry ID from local storage:', error);
    return null;
  }
};

export const removeProcessingEntryById = (entryId: number) => {
  try {
    localStorage.removeItem(`processingEntryId-${entryId}`);
  } catch (error) {
    console.error('Error removing entry ID from local storage:', error);
  }
};

export const processRecording = async (
  audioBlob: Blob, 
  userId: string
): Promise<{ success: boolean; tempId?: string; error?: string }> => {
  try {
    const tempId = uuidv4();
    console.log(`[processRecording] Starting processing for tempId: ${tempId}`);
    
    // Get timezone information
    const { timezoneName, timezoneOffset } = createLocalTimestamp();
    
    // Create a processing entry
    createProcessingEntry(userId, tempId);
    
    // Prepare form data
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');
    formData.append('userId', userId);
    formData.append('tempId', tempId);
    
    // Include timezone data in the form
    formData.append('timezoneName', timezoneName);
    formData.append('timezoneOffset', timezoneOffset.toString());
    
    // Upload the audio file to the Edge Function
    const response = await fetch(PROCESSING_URL, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[processRecording] Processing failed:', errorData);
      removeProcessingEntry(tempId);
      return { success: false, error: errorData.error || 'Processing failed' };
    }
    
    console.log(`[processRecording] Processing initiated successfully for tempId: ${tempId}`);
    return { success: true, tempId };
  } catch (error: any) {
    console.error('[processRecording] Error during processing:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
};

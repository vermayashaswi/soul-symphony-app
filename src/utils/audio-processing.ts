// utils/audio-processing.ts

import { supabase } from '@/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { getStorageBucket } from '@/services/storageService';
import { analyzeJournalEntry } from './ai-processing';
import { formatTime } from './format-time';

export const uploadAudio = async (audioBlob: Blob, userId: string): Promise<string | null> => {
  const bucketName = getStorageBucket();
  const filename = `${uuidv4()}.webm`;
  const filePath = `audio/${userId}/${filename}`;

  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, audioBlob, {
        contentType: 'audio/webm',
        upsert: false
      });

    if (error) {
      console.error('Error uploading audio to storage:', error);
      return null;
    }

    console.log('Audio uploaded successfully:', data);
    return filePath;
  } catch (error: any) {
    console.error('Unexpected error uploading audio:', error);
    return null;
  }
};

export const processRecording = async (audioBlob: Blob, userId: string): Promise<{ success: boolean, tempId?: string, error?: string }> => {
  try {
    const tempId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    const audioDuration = await getAudioDuration(audioBlob);
    console.log(`Audio duration calculated: ${audioDuration} seconds`);
    
    const audioPath = await uploadAudio(audioBlob, userId);
    if (!audioPath) {
      return { success: false, error: 'Failed to upload audio' };
    }

    const { data: insertData, error: insertError } = await supabase
      .from('Journal Entries')
      .insert([
        {
          user_id: userId,
          audio_path: audioPath,
          date: new Date().toISOString(),
          duration: audioDuration
        }
      ])
      .select()

    if (insertError) {
      console.error('Error inserting journal entry:', insertError);
      return { success: false, error: 'Failed to save journal entry' };
    }

    if (!insertData || insertData.length === 0) {
      console.error('No data returned after insert');
      return { success: false, error: 'Failed to retrieve saved journal entry' };
    }

    const newEntry = insertData[0];
    console.log('Journal entry saved successfully:', newEntry);

    const { success: aiSuccess, error: aiError } = await analyzeJournalEntry(newEntry.id);

    if (!aiSuccess) {
      console.error('AI analysis failed:', aiError);
      return { success: true, tempId };
    }

    return { success: true, tempId };
  } catch (error) {
    console.error('Error processing recording:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

const getAudioDuration = (audioBlob: Blob): Promise<number> => {
  return new Promise((resolve) => {
    const audioElement = new Audio();
    audioElement.preload = 'metadata';
    
    audioElement.addEventListener('loadedmetadata', () => {
      resolve(audioElement.duration);
      URL.revokeObjectURL(audioElement.src);
    });
    
    audioElement.addEventListener('error', () => {
      console.error('Error loading audio metadata');
      const estimatedDurationSec = audioBlob.size / (16 * 1024);
      resolve(Math.min(300, Math.max(1, estimatedDurationSec)));
      URL.revokeObjectURL(audioElement.src);
    });
    
    audioElement.src = URL.createObjectURL(audioBlob);
  });
};

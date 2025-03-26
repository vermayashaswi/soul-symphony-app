
import { supabase } from '@/integrations/supabase/client';
import { JournalEntry } from '@/types/journal';
import { toast } from 'sonner';

interface JournalEntryInput {
  id?: number;
  user_id: string;
  audio_url: string | null;
  "transcription text"?: string;
  "refined text"?: string;
  emotions?: string[] | null;
  master_themes?: string[] | null;
  created_at: string;
}

/**
 * Saves a journal entry to the database
 * @param entryData The journal entry data to save
 * @param userId The user ID
 * @returns The saved journal entry
 */
export const saveJournalEntry = async (entryData: JournalEntryInput, userId: string) => {
  if (!userId) throw new Error('User ID is required to save journal entries');
  
  try {
    const dbEntry = {
      ...entryData.id ? { id: entryData.id } : {},
      user_id: userId,
      audio_url: entryData.audio_url,
      "transcription text": entryData["transcription text"] || '',
      "refined text": entryData["refined text"] || '',
      created_at: entryData.created_at,
      emotions: entryData.emotions,
      master_themes: entryData.master_themes
    };
    
    let result;
    
    if (entryData.id) {
      result = await supabase
        .from('Journal Entries')
        .update(dbEntry)
        .eq('id', entryData.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('Journal Entries')
        .insert(dbEntry)
        .select()
        .single();
    }
    
    const { data, error } = result;
    
    if (error) {
      console.error('Error saving journal entry:', error);
      toast.error('Failed to save journal entry');
      throw error;
    }
    
    try {
      const textToEmbed = data["refined text"] || data["transcription text"] || '';
      if (textToEmbed.trim().length > 0) {
        console.log('Automatically generating embedding for entry:', data.id);
        
        const { error: embeddingError } = await supabase.functions.invoke('create-embedding', {
          body: { 
            text: textToEmbed, 
            journalEntryId: data.id 
          }
        });
        
        if (embeddingError) {
          console.error('Error automatically generating embedding:', embeddingError);
        } else {
          console.log('Embedding generated successfully');
        }
      }
    } catch (embeddingError) {
      console.error('Error in automatic embedding generation:', embeddingError);
    }
    
    return data;
  } catch (error) {
    console.error('Error in saveJournalEntry:', error);
    throw error;
  }
};

/**
 * Deletes a journal entry from the database
 * @param id The ID of the journal entry to delete
 * @returns A promise that resolves when the entry is deleted
 */
export const deleteJournalEntry = async (id: number) => {
  try {
    const { error } = await supabase
      .from('Journal Entries')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting journal entry:', error);
      toast.error('Failed to delete journal entry');
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error('Error in deleteJournalEntry:', error);
    throw error;
  }
};

/**
 * Fetches journal entries for a user
 * @param userId The user ID to fetch entries for
 * @returns The fetched journal entries
 */
export const fetchJournalEntries = async (userId: string) => {
  if (!userId) {
    throw new Error('User ID is required to fetch journal entries');
  }
  
  console.log(`Fetching entries for user ${userId}`);
  
  const { data, error } = await supabase
    .from('Journal Entries')
    .select('id, "refined text", "transcription text", created_at, emotions, master_themes, user_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching entries:', error);
    console.error('Error details:', JSON.stringify(error));
    throw error;
  }
  
  console.log(`Fetched ${data?.length || 0} entries successfully`);
  
  return data as JournalEntry[];
};

/**
 * Processes unprocessed journal entries
 * @param userId The user ID to process entries for
 * @returns Object with processing results
 */
export const processUnprocessedEntries = async (userId: string) => {
  if (!userId) {
    console.log('Cannot process entries: No user ID provided');
    return { success: false, processed: 0 };
  }
  
  try {
    console.log('Processing unprocessed entries for user:', userId);
    return { success: true, processed: 0 };
  } catch (error) {
    console.error('Error in processUnprocessedEntries:', error);
    toast.error('An unexpected error occurred. Please try again.');
    return { success: false, processed: 0 };
  }
};

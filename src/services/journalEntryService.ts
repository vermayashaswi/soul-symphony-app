
import { supabase } from '@/integrations/supabase/client';
import { JournalEntry } from '@/types/journal';

export const createJournalEntry = async (entryData: Partial<JournalEntry>, userId: string): Promise<JournalEntry | null> => {
  try {
    const { data, error } = await supabase
      .from('Journal Entries')
      .insert({
        ...entryData,
        user_id: userId, // Ensure user_id is set for RLS
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating journal entry:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception creating journal entry:', error);
    return null;
  }
};

export const updateJournalEntry = async (entryId: number, entryData: Partial<JournalEntry>, userId: string): Promise<JournalEntry | null> => {
  try {
    const { data, error } = await supabase
      .from('Journal Entries')
      .update(entryData)
      .eq('id', entryId)
      .eq('user_id', userId) // Ensure user can only update their own entries
      .select()
      .single();

    if (error) {
      console.error('Error updating journal entry:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception updating journal entry:', error);
    return null;
  }
};

export const deleteJournalEntry = async (entryId: number, userId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('Journal Entries')
      .delete()
      .eq('id', entryId)
      .eq('user_id', userId); // Ensure user can only delete their own entries

    if (error) {
      console.error('Error deleting journal entry:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception deleting journal entry:', error);
    return false;
  }
};

export const getJournalEntries = async (userId: string, limit?: number, offset?: number): Promise<JournalEntry[]> => {
  try {
    let query = supabase
      .from('Journal Entries')
      .select('*')
      .eq('user_id', userId) // RLS will handle this, but explicit for clarity
      .order('created_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    if (offset) {
      query = query.range(offset, offset + (limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching journal entries:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching journal entries:', error);
    return [];
  }
};

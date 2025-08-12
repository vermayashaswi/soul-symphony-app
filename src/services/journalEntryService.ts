
import { supabase } from '@/integrations/supabase/client';
import { JournalEntry } from '@/types/journal';

export const createJournalEntry = async (entryData: Partial<JournalEntry>, userId: string): Promise<JournalEntry | null> => {
  try {
    // RLS policies automatically handle user_id - we still include it for explicit clarity
    const insertData = {
      ...entryData,
      user_id: userId, // Set for RLS validation
      created_at: new Date().toISOString(),
    } as any;

    // Ensure sentiment is a number for DB insert
    if (insertData.sentiment !== undefined && insertData.sentiment !== null) {
      const s = Number(insertData.sentiment);
      if (!isNaN(s)) insertData.sentiment = s; else delete insertData.sentiment;
    }

    console.log('[JournalEntryService] Creating entry for authenticated user:', userId);

    const { data, error } = await supabase
      .from('Journal Entries')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating journal entry:', error);
      // Provide more helpful error messages
      if (error.message.includes('row-level security')) {
        console.error('RLS policy violation - ensure user is authenticated and user_id is set correctly');
      }
      return null;
    }

    // Map the database result to match JournalEntry interface
    return {
      ...data,
      content: data['refined text'] || data['transcription text'] || '',
      entities: Array.isArray(data.entities) ? data.entities.map((entity: any) => ({
        type: entity.type || '',
        name: entity.name || '',
        text: entity.text
      })) : []
    } as JournalEntry;
  } catch (error) {
    console.error('Exception creating journal entry:', error);
    return null;
  }
};

export const updateJournalEntry = async (entryId: number, entryData: Partial<JournalEntry>, userId: string): Promise<JournalEntry | null> => {
  try {
    // Prepare update data with proper field mapping
    const updateData: any = { ...entryData };
    
    // If content is being updated, map it to the appropriate database fields
    if (entryData.content) {
      updateData['refined text'] = entryData.content;
      updateData['transcription text'] = entryData.content;
      // Remove the content field as it's not a database column
      delete updateData.content;
    }

    const { data, error } = await supabase
      .from('Journal Entries')
      .update(updateData)
      .eq('id', entryId)
      // RLS policies ensure user can only update their own entries
      .select()
      .single();

    if (error) {
      console.error('Error updating journal entry:', error);
      return null;
    }

    // Map the database result to match JournalEntry interface
    return {
      ...data,
      content: data['refined text'] || data['transcription text'] || '',
      entities: Array.isArray(data.entities) ? data.entities.map((entity: any) => ({
        type: entity.type || '',
        name: entity.name || '',
        text: entity.text
      })) : []
    } as JournalEntry;
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
      .eq('id', entryId);
      // RLS policies ensure user can only delete their own entries

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
    console.log('[JournalEntryService] Fetching entries for user:', userId);

    let query = supabase
      .from('Journal Entries')
      .select('*')
      // RLS policies automatically filter to user's entries
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
      // Provide more helpful error messages
      if (error.message.includes('row-level security')) {
        console.error('RLS policy issue - ensure user is authenticated');
      }
      return [];
    }

    console.log(`[JournalEntryService] Successfully fetched ${data?.length || 0} entries`);

    // Map the database results to match JournalEntry interface
    return (data || []).map(entry => ({
      ...entry,
      content: entry['refined text'] || entry['transcription text'] || '',
      entities: Array.isArray(entry.entities) ? entry.entities.map((entity: any) => ({
        type: entity.type || '',
        name: entity.name || '',
        text: entity.text
      })) : []
    })) as JournalEntry[];
  } catch (error) {
    console.error('Exception fetching journal entries:', error);
    return [];
  }
};

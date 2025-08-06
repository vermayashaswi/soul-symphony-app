
import { supabase } from '@/integrations/supabase/client';
import { JournalEntry } from '@/types/journal';

// Define the return type for the delete function
interface DeleteAllEntriesResult {
  success: boolean;
  deleted_entries: number;
  deleted_embeddings: number;
  error?: string;
}

export const deleteAllUserJournalEntries = async (userId: string) => {
  try {
    console.log('[JournalService] Attempting to delete all journal entries for user:', userId);
    
    const { data, error } = await supabase.rpc('delete_all_user_journal_entries', {
      p_user_id: userId
    });
    
    if (error) {
      console.error('[JournalService] Error deleting all entries:', error);
      throw new Error(`Failed to delete entries: ${error.message}`);
    }
    
    // Type assertion for the response data with proper unknown conversion first
    const result = (data as unknown) as DeleteAllEntriesResult;
    
    if (!result.success) {
      console.error('[JournalService] Function returned error:', result.error);
      throw new Error(result.error || 'Failed to delete entries');
    }
    
    console.log('[JournalService] Successfully deleted entries:', result);
    return {
      success: true,
      deletedEntries: result.deleted_entries,
      deletedEmbeddings: result.deleted_embeddings
    };
  } catch (error) {
    console.error('[JournalService] Exception in deleteAllUserJournalEntries:', error);
    throw error;
  }
};

export const checkUserProfile = async (userId: string): Promise<boolean> => {
  try {
    console.log('[JournalService] Checking user profile for:', userId);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    
    if (error) {
      console.error('[JournalService] Error checking user profile:', error);
      return false;
    }
    
    return !!data;
  } catch (error) {
    console.error('[JournalService] Exception in checkUserProfile:', error);
    return false;
  }
};

export const createUserProfile = async (userId: string): Promise<boolean> => {
  try {
    console.log('[JournalService] Creating user profile for:', userId);
    
    const { error } = await supabase
      .from('profiles')
      .insert({ id: userId });
    
    if (error) {
      console.error('[JournalService] Error creating user profile:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[JournalService] Exception in createUserProfile:', error);
    return false;
  }
};

export const fetchJournalEntries = async (userId: string, timeoutRef?: React.MutableRefObject<NodeJS.Timeout | null>): Promise<JournalEntry[]> => {
  try {
    console.log('[JournalService] Fetching journal entries for user:', userId);
    
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('*')
      // RLS policies automatically filter to user's entries
      .order('created_at', { ascending: false });
    
    if (timeoutRef?.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    if (error) {
      console.error('[JournalService] Error fetching journal entries:', error);
      throw new Error(`Failed to fetch entries: ${error.message}`);
    }
    
    // Map the database response to JournalEntry format, handling type conversions
    const mappedEntries: JournalEntry[] = (data || []).map(entry => ({
      ...entry,
      content: entry["refined text"] || entry["transcription text"] || '', // Map content from refined or transcription text
      entities: Array.isArray(entry.entities) ? entry.entities.map((entity: any) => ({
        type: entity.type || '',
        name: entity.name || '',
        text: entity.text
      })) : [], // Properly transform entities to expected structure
      languages: Array.isArray(entry.languages) ? 
                 entry.languages.filter((lang: any) => typeof lang === 'string') as string[] :
                 (entry.languages && typeof entry.languages === 'object' && !Array.isArray(entry.languages)) ?
                 [] : // If it's an object but not an array, return empty array
                 [], // Default to empty array for any other case
    }));
    
    return mappedEntries;
  } catch (error) {
    console.error('[JournalService] Exception in fetchJournalEntries:', error);
    throw error;
  }
};

export const reprocessJournalEntry = async (entryId: number, newContent: string): Promise<boolean> => {
  try {
    console.log('[JournalService] Reprocessing journal entry:', entryId);
    
    const { error } = await supabase
      .from('Journal Entries')
      .update({
        'refined text': newContent,
        Edit_Status: 1
      })
      .eq('id', entryId);
    
    if (error) {
      console.error('[JournalService] Error reprocessing journal entry:', error);
      throw new Error(`Failed to reprocess entry: ${error.message}`);
    }
    
    console.log('[JournalService] Successfully updated entry, triggering full text processing:', entryId);
    
    // Import and trigger the full text processing pipeline
    const { triggerFullTextProcessing } = await import('@/utils/audio/theme-extractor');
    await triggerFullTextProcessing(entryId);
    
    console.log('[JournalService] Successfully reprocessed entry:', entryId);
    return true;
  } catch (error) {
    console.error('[JournalService] Exception in reprocessJournalEntry:', error);
    throw error;
  }
};

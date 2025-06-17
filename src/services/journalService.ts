
import { supabase } from '@/integrations/supabase/client';

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
    
    if (!data.success) {
      console.error('[JournalService] Function returned error:', data.error);
      throw new Error(data.error || 'Failed to delete entries');
    }
    
    console.log('[JournalService] Successfully deleted entries:', data);
    return {
      success: true,
      deletedEntries: data.deleted_entries,
      deletedEmbeddings: data.deleted_embeddings
    };
  } catch (error) {
    console.error('[JournalService] Exception in deleteAllUserJournalEntries:', error);
    throw error;
  }
};

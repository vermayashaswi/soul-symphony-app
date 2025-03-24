
import { supabase } from '@/integrations/supabase/client';
import { JournalEntry, EmbeddingReference } from '@/types/journal';

/**
 * Fetches journal entries for a user
 * @param userId User ID to fetch entries for
 * @returns Array of journal entries or null if error
 */
export async function fetchJournalEntriesWithText(userId: string): Promise<JournalEntry[] | null> {
  try {
    console.log('Fetching journal entries for user:', userId);
    
    // Get all journal entries for this user that have refined text
    const { data: entriesData, error: entriesError } = await supabase
      .from('Journal Entries')
      .select('id, refined text')
      .eq('user_id', userId)
      .not('refined text', 'is', null)
      .order('created_at', { ascending: false });
      
    if (entriesError) {
      console.error('Error fetching journal entries:', entriesError);
      return null;
    }
    
    if (!entriesData || entriesData.length === 0) {
      console.log('No journal entries with text found for user');
      return null;
    }
    
    console.log(`Found ${entriesData.length} journal entries for embedding check`);
    
    // Cast to any[] first and then filter out entries without valid refined text
    const entries = entriesData as any[];
    const validEntries = entries.filter(entry => 
      entry && 
      typeof entry.id === 'number' && 
      entry["refined text"] && 
      typeof entry["refined text"] === 'string' &&
      entry["refined text"].trim().length > 0
    ) as JournalEntry[];
    
    if (validEntries.length === 0) {
      console.error('No valid journal entries with text found');
      return null;
    }
    
    console.log(`Found ${validEntries.length} entries with valid text content`);
    return validEntries;
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    return null;
  }
}

/**
 * Checks which entries already have embeddings
 * @param entryIds Array of entry IDs to check
 * @returns Array of entry IDs that already have embeddings, or null if error
 */
export async function checkExistingEmbeddings(entryIds: number[]): Promise<number[] | null> {
  try {
    // Check which entries already have embeddings
    const { data: existingEmbeddings, error: embeddingsError } = await supabase
      .from('journal_embeddings')
      .select('journal_entry_id')
      .in('journal_entry_id', entryIds);
      
    if (embeddingsError) {
      console.error('Error checking existing embeddings:', embeddingsError);
      return null;
    }
    
    // Extract entry IDs from the results
    const existingEmbeddingIds = (existingEmbeddings as EmbeddingReference[] || []).map(e => e.journal_entry_id);
    return existingEmbeddingIds;
  } catch (error) {
    console.error('Error checking existing embeddings:', error);
    return null;
  }
}

/**
 * Counts how many embeddings exist for a set of entries
 * @param entryIds Array of entry IDs to check
 * @returns Count of embeddings or null if error
 */
export async function countEmbeddings(entryIds: number[]): Promise<number | null> {
  try {
    const { count, error: countError } = await supabase
      .from('journal_embeddings')
      .select('*', { count: 'exact', head: true })
      .in('journal_entry_id', entryIds);
      
    if (countError) {
      console.error('Error counting embeddings:', countError);
      return null;
    }
    
    return count;
  } catch (error) {
    console.error('Error counting embeddings:', error);
    return null;
  }
}

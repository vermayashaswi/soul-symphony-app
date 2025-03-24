
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Checks if embeddings exist for journal entries and requests generation if missing
 */
export async function ensureJournalEntriesHaveEmbeddings(userId: string): Promise<boolean> {
  try {
    // Get all journal entries for this user
    const { data: entries, error: entriesError } = await supabase
      .from('Journal Entries')
      .select('id, refined text')
      .eq('user_id', userId);
      
    if (entriesError) {
      console.error('Error fetching journal entries:', entriesError);
      return false;
    }
    
    if (!entries || entries.length === 0) {
      console.log('No journal entries found for user');
      return false;
    }
    
    console.log(`Found ${entries.length} journal entries for embedding check`);
    
    // Get entry IDs
    const entryIds = entries.map(entry => {
      // Make sure entry is valid and has an id property
      if (!entry || typeof entry !== 'object' || !('id' in entry)) {
        console.error('Invalid journal entry without ID:', entry);
        return null;
      }
      return entry.id;
    }).filter(id => id !== null) as string[];
    
    if (entryIds.length === 0) {
      console.error('No valid journal entry IDs found');
      return false;
    }
    
    // Check which entries already have embeddings
    const { data: existingEmbeddings, error: embeddingsError } = await supabase
      .from('journal_embeddings')
      .select('journal_entry_id')
      .in('journal_entry_id', entryIds);
      
    if (embeddingsError) {
      console.error('Error checking existing embeddings:', embeddingsError);
      return false;
    }
    
    // Find entries without embeddings
    const existingEmbeddingIds = existingEmbeddings?.map(e => e.journal_entry_id) || [];
    const entriesWithoutEmbeddings = entries.filter(entry => 
      entry && typeof entry === 'object' && 'id' in entry && !existingEmbeddingIds.includes(entry.id)
    );
    
    if (entriesWithoutEmbeddings.length === 0) {
      console.log('All journal entries have embeddings');
      return true;
    }
    
    console.log(`Found ${entriesWithoutEmbeddings.length} entries without embeddings, generating...`);
    toast.info(`Preparing your journal entries for chat (${entriesWithoutEmbeddings.length} entries)...`);
    
    // Generate embeddings for entries that don't have them
    for (const entry of entriesWithoutEmbeddings) {
      if (!entry || typeof entry !== 'object' || !('id' in entry) || !entry["refined text"]) {
        console.log(`Entry is invalid or has no refined text, skipping embedding generation`);
        continue;
      }
      
      // Call the generate-embeddings function
      const { error: genError } = await supabase.functions.invoke('generate-embeddings', {
        body: { 
          entryId: entry.id,
          text: entry["refined text"]
        }
      });
      
      if (genError) {
        console.error(`Error generating embedding for entry ${entry.id}:`, genError);
      }
    }
    
    toast.success('Journal entries prepared for chat');
    return true;
  } catch (error) {
    console.error('Error ensuring journal entries have embeddings:', error);
    return false;
  }
}

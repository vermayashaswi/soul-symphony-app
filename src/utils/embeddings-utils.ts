
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Define a type for journal entries
interface JournalEntry {
  id: number;
  "refined text"?: string;
  [key: string]: any;
}

// Define a type for what Supabase might return (which could include error objects)
interface SupabaseEntry {
  id?: number;
  "refined text"?: string;
  [key: string]: any;
}

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
    console.log('Sample entry:', entries[0]); // Debug log to see entry structure
    
    // Type guard function to verify entry structure
    function isValidJournalEntry(entry: any): entry is JournalEntry {
      return entry !== null && 
             entry !== undefined && 
             typeof entry === 'object' &&
             'id' in entry && 
             typeof entry.id === 'number';
    }
    
    // Filter out any entries that don't match our expected structure
    const validEntries: JournalEntry[] = [];
    for (const entry of entries) {
      if (isValidJournalEntry(entry)) {
        validEntries.push(entry);
      } else {
        console.warn('Invalid entry format:', entry);
      }
    }
    
    if (validEntries.length === 0) {
      console.error('No valid journal entry IDs found');
      return false;
    }
    
    // Get entry IDs
    const entryIds = validEntries.map(entry => entry.id);
    
    // Check which entries already have embeddings
    const { data: existingEmbeddings, error: embeddingsError } = await supabase
      .from('journal_embeddings')
      .select('journal_entry_id')
      .in('journal_entry_id', entryIds);
      
    if (embeddingsError) {
      console.error('Error checking existing embeddings:', embeddingsError);
      return false;
    }
    
    console.log('Existing embeddings:', existingEmbeddings); // Debug log
    
    // Find entries without embeddings
    const existingEmbeddingIds = existingEmbeddings?.map(e => e.journal_entry_id) || [];
    
    const entriesWithoutEmbeddings = validEntries.filter(entry => 
      !existingEmbeddingIds.includes(entry.id)
    );
    
    if (entriesWithoutEmbeddings.length === 0) {
      console.log('All journal entries have embeddings');
      return true;
    }
    
    console.log(`Found ${entriesWithoutEmbeddings.length} entries without embeddings, generating...`);
    toast.info(`Preparing your journal entries for chat (${entriesWithoutEmbeddings.length} entries)...`);
    
    // Generate embeddings for entries that don't have them
    for (const entry of entriesWithoutEmbeddings) {
      // Skip entries without refined text
      if (!entry["refined text"]) {
        console.log(`Entry ${entry.id} has no refined text, skipping embedding generation`);
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

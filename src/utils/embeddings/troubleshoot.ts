
import { supabase } from '@/integrations/supabase/client';

/**
 * For troubleshooting RAG issues - checks if an embedding exists for a specific entry
 * @param entryId Journal entry ID to check
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function checkEmbeddingForEntry(entryId: number): Promise<boolean> {
  try {
    console.log(`Checking embedding for entry ${entryId}`);
    
    // First check if the entry exists and has text
    const { data: entry, error: entryError } = await supabase
      .from('Journal Entries')
      .select('id, refined text')
      .eq('id', entryId)
      .single();
      
    if (entryError) {
      console.error(`Error fetching entry ${entryId}:`, entryError);
      return false;
    }
    
    if (!entry || !entry["refined text"]) {
      console.error(`Entry ${entryId} not found or has no text`);
      return false;
    }
    
    // Check if embedding exists
    const { data: embedding, error: embError } = await supabase
      .from('journal_embeddings')
      .select('*')
      .eq('journal_entry_id', entryId)
      .single();
      
    if (embError) {
      console.log(`No embedding found for entry ${entryId}, generating...`);
      
      // Generate embedding
      const { error: genError } = await supabase.functions.invoke('generate-embeddings', {
        body: { 
          entryId: entryId,
          text: entry["refined text"]
        }
      });
      
      if (genError) {
        console.error(`Error generating embedding for entry ${entryId}:`, genError);
        return false;
      }
      
      console.log(`Successfully generated embedding for entry ${entryId}`);
      return true;
    }
    
    console.log(`Embedding already exists for entry ${entryId}`);
    return true;
    
  } catch (error) {
    console.error(`Error checking embedding for entry ${entryId}:`, error);
    return false;
  }
}

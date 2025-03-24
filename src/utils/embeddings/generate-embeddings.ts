
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { JournalEntry } from '@/types/journal';

/**
 * Generates embeddings for a batch of journal entries
 * @param entries Array of journal entries to generate embeddings for
 * @returns Number of successfully generated embeddings
 */
export async function generateEmbeddingsForBatch(entries: JournalEntry[]): Promise<number> {
  console.log(`Processing batch with ${entries.length} entries`);
  
  // Process each entry in the batch with Promise.all for parallel processing
  const results = await Promise.all(entries.map(async (entry) => {
    try {
      if (!entry["refined text"]) {
        console.log(`Entry ${entry.id} has no refined text, skipping embedding generation`);
        return null;
      }
      
      // Call the generate-embeddings function
      console.log(`Generating embedding for entry ${entry.id} with text length: ${entry["refined text"]?.length}`);
      const { data, error: genError } = await supabase.functions.invoke('generate-embeddings', {
        body: { 
          entryId: entry.id,
          text: entry["refined text"]
        }
      });
      
      if (genError) {
        console.error(`Error generating embedding for entry ${entry.id}:`, genError);
        return null;
      }
      
      // Verify the result
      console.log(`Embedding generation result for entry ${entry.id}:`, data?.success ? 'Success' : 'Failed');
      
      return data?.success ? entry.id : null;
    } catch (error) {
      console.error(`Exception generating embedding for entry ${entry.id}:`, error);
      return null;
    }
  }));
  
  const successCount = results.filter(id => id !== null).length;
  console.log(`Batch complete: ${successCount} successful out of ${entries.length}`);
  
  return successCount;
}

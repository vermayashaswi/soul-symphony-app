
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Define a type for journal entries
interface JournalEntry {
  id: number;
  "refined text"?: string | null;
  [key: string]: any;
}

/**
 * Checks if embeddings exist for journal entries and requests generation if missing
 */
export async function ensureJournalEntriesHaveEmbeddings(userId: string): Promise<boolean> {
  try {
    console.log('Starting embeddings check for user:', userId);
    
    // Get all journal entries for this user that have refined text
    const { data: entries, error: entriesError } = await supabase
      .from('Journal Entries')
      .select('id, refined text')
      .eq('user_id', userId)
      .not('refined text', 'is', null)
      .order('created_at', { ascending: false });
      
    if (entriesError) {
      console.error('Error fetching journal entries:', entriesError);
      return false;
    }
    
    if (!entries || entries.length === 0) {
      console.log('No journal entries with text found for user');
      return false;
    }
    
    console.log(`Found ${entries.length} journal entries for embedding check`);
    
    // Cast to JournalEntry[] and filter out entries without valid refined text
    const validEntries = (entries as JournalEntry[]).filter(entry => 
      entry && 
      typeof entry.id === 'number' && 
      entry["refined text"] && 
      typeof entry["refined text"] === 'string' &&
      entry["refined text"].trim().length > 0
    );
    
    if (validEntries.length === 0) {
      console.error('No valid journal entries with text found');
      return false;
    }
    
    console.log(`Found ${validEntries.length} entries with valid text content`);
    
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
    
    // Generate embeddings for entries that don't have them, but limit to 5 at a time to avoid timeouts
    const batchSize = 5;
    const batches = Math.ceil(entriesWithoutEmbeddings.length / batchSize);
    let successCount = 0;
    
    for (let i = 0; i < batches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, entriesWithoutEmbeddings.length);
      const batch = entriesWithoutEmbeddings.slice(start, end);
      
      console.log(`Processing batch ${i+1}/${batches} with ${batch.length} entries`);
      
      // Process each entry in the batch with Promise.all for parallel processing
      const results = await Promise.all(batch.map(async (entry) => {
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
      
      const batchSuccessCount = results.filter(id => id !== null).length;
      successCount += batchSuccessCount;
      
      console.log(`Batch ${i+1} complete: ${batchSuccessCount} successful out of ${batch.length}`);
      
      // Short delay between batches to avoid rate limiting
      if (i < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`Successfully generated ${successCount} embeddings out of ${entriesWithoutEmbeddings.length} entries`);
    
    if (successCount < entriesWithoutEmbeddings.length) {
      console.warn(`Failed to generate embeddings for ${entriesWithoutEmbeddings.length - successCount} entries`);
      if (successCount === 0) {
        toast.error('Failed to prepare journal entries for chat');
        return false;
      } else {
        toast.warning(`Some journal entries (${entriesWithoutEmbeddings.length - successCount}) could not be prepared for chat`);
      }
    } else {
      toast.success('Journal entries prepared for chat');
    }
    
    // Double check embeddings after generation
    const { count, error: countError } = await supabase
      .from('journal_embeddings')
      .select('*', { count: 'exact', head: true })
      .in('journal_entry_id', entryIds);
      
    if (countError) {
      console.error('Error counting embeddings after generation:', countError);
    } else {
      console.log(`After generation: ${count} embeddings exist for ${entryIds.length} journal entries`);
    }
    
    return successCount > 0;
  } catch (error) {
    console.error('Error ensuring journal entries have embeddings:', error);
    return false;
  }
}

// For troubleshooting RAG issues
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

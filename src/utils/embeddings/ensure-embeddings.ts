import { toast } from 'sonner';
import { JournalEntry } from '@/types/journal';
import { fetchJournalEntriesWithText, checkExistingEmbeddings, countEmbeddings } from './check-embeddings';
import { generateEmbeddingsForBatch } from './generate-embeddings';

/**
 * Checks if embeddings exist for journal entries and requests generation if missing
 * @param userId User ID to check embeddings for
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function ensureJournalEntriesHaveEmbeddings(userId: string): Promise<boolean> {
  try {
    console.log('Starting embeddings check for user:', userId);
    
    // Get all journal entries with valid text content
    const validEntries = await fetchJournalEntriesWithText(userId);
    if (!validEntries) return false;
    
    // Get entry IDs
    const entryIds = validEntries.map(entry => entry.id);
    
    // Check which entries already have embeddings
    const existingEmbeddingIds = await checkExistingEmbeddings(entryIds);
    if (existingEmbeddingIds === null) return false;
    
    // Find entries without embeddings
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
      
      const batchSuccessCount = await generateEmbeddingsForBatch(batch);
      successCount += batchSuccessCount;
      
      // Short delay between batches to avoid rate limits
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
    const finalCount = await countEmbeddings(entryIds);
    if (finalCount !== null) {
      console.log(`After generation: ${finalCount} embeddings exist for ${entryIds.length} journal entries`);
    }
    
    // Fix here - use existingEmbeddingIds.length instead of existingEmbeddingIds.size
    return successCount > 0 || existingEmbeddingIds.length > 0;
  } catch (error) {
    console.error('Error ensuring journal entries have embeddings:', error);
    return false;
  }
}

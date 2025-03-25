
import { supabase } from '@/integrations/supabase/client';
import { getCurrentUserId } from './audio/auth-utils';
import { toast } from 'sonner';
import { JournalEntry } from '@/types/journal';

/**
 * Generate embedding for a journal entry
 * @param entryId The ID of the journal entry
 * @param text The text to generate embedding for
 */
export async function generateEmbeddingForEntry(entryId: number, text: string) {
  try {
    // Ensure we have a valid entry ID and text
    if (!entryId || !text?.trim()) {
      throw new Error('Entry ID and text are required for generating embeddings');
    }
    
    // Call the Supabase Edge Function to generate the embedding
    const { data, error } = await supabase.functions.invoke('generate-embeddings', {
      body: { entryId, text, forceRegenerate: false }
    });
    
    if (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    toast.error('Failed to generate embedding for journal entry');
    return { success: false, error: error.message };
  }
}

/**
 * Search for journal entries similar to the query
 * @param query The search query
 * @param threshold The similarity threshold (0-1)
 * @param limit Maximum number of results
 */
export async function searchJournalEntries(query: string, threshold = 0.3, limit = 5) {
  try {
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return { entries: [], error: 'User not authenticated' };
    }
    
    // First generate an embedding for the query
    const { data: queryEmbedding, error: embeddingError } = await supabase.functions.invoke('generate-embeddings', {
      body: { text: query, isTestQuery: true }
    });
    
    if (embeddingError || !queryEmbedding?.embedding) {
      console.error('Error generating query embedding:', embeddingError);
      throw new Error('Failed to generate query embedding');
    }
    
    // Use the match_journal_entries RPC function to find similar entries
    const { data: similarEntries, error: searchError } = await supabase.rpc(
      'match_journal_entries',
      {
        query_embedding: queryEmbedding.embedding,
        match_threshold: threshold,
        match_count: limit,
        user_id_filter: userId
      }
    );
    
    if (searchError) {
      console.error('Error searching for similar entries:', searchError);
      throw searchError;
    }
    
    // Get full details for the matched entries
    if (similarEntries && similarEntries.length > 0) {
      const entryIds = similarEntries.map(entry => entry.id);
      
      const { data: entriesDetails, error: detailsError } = await supabase
        .from('Journal Entries')
        .select('*')
        .in('id', entryIds);
        
      if (detailsError) {
        throw detailsError;
      }
      
      // Merge similarity scores with entry details
      const entriesWithSimilarity = entriesDetails.map(entry => {
        const similarEntry = similarEntries.find(se => se.id === entry.id);
        return {
          ...entry,
          similarity: similarEntry ? similarEntry.similarity : 0
        };
      });
      
      return { entries: entriesWithSimilarity, error: null };
    }
    
    return { entries: [], error: null };
  } catch (error) {
    console.error('Error in semantic search:', error);
    return { entries: [], error: error.message };
  }
}

interface EntryWithoutEmbedding {
  id: number;
  "refined text"?: string | null;
  "transcription text"?: string | null;
}

/**
 * Generate embeddings for all journal entries that don't have them
 */
export async function generateEmbeddingsForAllEntries() {
  try {
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // First, get the embedding status
    const { totalEntries, embeddedEntries, error: statusError } = await getEmbeddingStatus();
    
    if (statusError) {
      throw new Error(statusError);
    }
    
    if (totalEntries === embeddedEntries) {
      return { success: true, message: 'All entries already have embeddings', processed: 0 };
    }
    
    // Get entries without embeddings using a direct query approach
    const { data: entriesData, error: entriesError } = await supabase
      .from('Journal Entries')
      .select('id, refined text, transcription text')
      .eq('user_id', userId);
      
    if (entriesError) {
      console.error('Error getting entries:', entriesError);
      return { success: false, error: 'Failed to retrieve journal entries' };
    }

    // Safely handle null or invalid data
    if (!entriesData || !Array.isArray(entriesData) || entriesData.length === 0) {
      return { success: true, message: 'No entries need embeddings', processed: 0 };
    }
    
    // Define a type guard to ensure we're working with valid entries
    function isValidEntry(entry: unknown): entry is EntryWithoutEmbedding {
      return entry !== null && 
             typeof entry === 'object' && 
             'id' in entry && 
             typeof entry.id === 'number';
    }
    
    // Filter out invalid entries
    const validEntries: EntryWithoutEmbedding[] = entriesData.filter(isValidEntry);
    
    if (validEntries.length === 0) {
      return { success: true, message: 'No valid entries found', processed: 0 };
    }
    
    // Get existing embeddings
    const { data: embeddingsData, error: embeddingsError } = await supabase
      .from('journal_embeddings')
      .select('journal_entry_id');
      
    if (embeddingsError) {
      console.error('Error getting existing embeddings:', embeddingsError);
      return { success: false, error: 'Failed to retrieve existing embeddings' };
    }
    
    // Ensure embeddings data is an array
    const existingEmbeddings = Array.isArray(embeddingsData) ? embeddingsData : [];
    const existingEmbeddingIds = existingEmbeddings.map(e => e.journal_entry_id);
    
    // Filter entries that don't have embeddings yet
    const entriesToProcess = validEntries.filter(entry => 
      !existingEmbeddingIds.includes(entry.id)
    );
    
    if (entriesToProcess.length === 0) {
      return { success: true, message: 'All entries already have embeddings', processed: 0 };
    }
    
    // Process each entry
    let successCount = 0;
    let errorCount = 0;
    
    for (const entry of entriesToProcess) {
      // Since we've validated entries with the filter above, we know entry is not null here
      const text = entry["refined text"] || entry["transcription text"] || '';
      
      if (!text.trim()) {
        console.log(`Skipping entry ${entry.id} - no text content`);
        continue;
      }
      
      const result = await generateEmbeddingForEntry(entry.id, text);
      
      if (result && result.success !== false) {
        successCount++;
      } else {
        errorCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return { 
      success: true, 
      message: `Successfully generated ${successCount} embeddings. Failed: ${errorCount}`,
      processed: successCount
    };
  } catch (error) {
    console.error('Error generating embeddings for all entries:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get the current status of embeddings for the user's journal entries
 */
async function getEmbeddingStatus() {
  try {
    const { data, error } = await supabase.functions.invoke('get-embedding-status', {
      body: {}
    });
    
    if (error) {
      console.error('Error invoking get-embedding-status function:', error);
      return { totalEntries: 0, embeddedEntries: 0, error: error.message };
    }
    
    return { 
      totalEntries: data?.totalEntries || 0, 
      embeddedEntries: data?.embeddedEntries || 0, 
      error: null 
    };
  } catch (error) {
    console.error('Error getting embedding status:', error);
    return { totalEntries: 0, embeddedEntries: 0, error: error.message };
  }
}

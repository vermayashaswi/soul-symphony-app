
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { JournalEntry } from '@/types/journal';

// Type guard to check if an object is a valid journal entry
function isValidJournalEntry(entry: any): entry is JournalEntry {
  return (
    entry !== null &&
    typeof entry === 'object' &&
    'id' in entry &&
    typeof entry.id === 'number' &&
    'refined text' in entry &&
    typeof entry["refined text"] === 'string'
  );
}

export async function ensureJournalEntriesHaveEmbeddings(userId: string | undefined): Promise<boolean> {
  if (!userId) {
    console.error('No user ID provided for ensuring embeddings');
    return false;
  }

  try {
    console.log('Ensuring embeddings exist for user:', userId);
    
    // First, check if the user has any journal entries
    const { data: entriesData, error: entriesError } = await supabase
      .from('Journal Entries')
      .select('id, refined text')
      .eq('user_id', userId);
      
    if (entriesError) {
      console.error('Error fetching journal entries:', entriesError);
      return false;
    }
    
    if (!entriesData || entriesData.length === 0) {
      console.log('No journal entries found for user');
      return false;
    }
    
    console.log(`Found ${entriesData.length} journal entries`);
    
    // Filter valid entries with appropriate type checking
    const validEntries: Array<{id: number; "refined text": string}> = [];
    
    for (let i = 0; i < entriesData.length; i++) {
      const entry = entriesData[i];
      
      if (entry && isValidJournalEntry(entry)) {
        validEntries.push({
          id: entry.id,
          "refined text": entry["refined text"]
        });
      }
    }
    
    if (validEntries.length === 0) {
      console.log('No valid journal entries with text found');
      return false;
    }
    
    console.log(`Found ${validEntries.length} valid journal entries with text`);
    
    // Get entry IDs for embedding check
    const validEntryIds = validEntries.map(entry => entry.id);
    
    // Check which entries already have embeddings
    const { data: embeddingsData, error: embeddingsError } = await supabase
      .from('journal_embeddings')
      .select('journal_entry_id')
      .in('journal_entry_id', validEntryIds);
      
    if (embeddingsError) {
      console.error('Error checking existing embeddings:', embeddingsError);
      return false;
    }
    
    const entriesWithEmbeddings = new Set<number>();
    
    // Only process if we got data back
    if (embeddingsData && Array.isArray(embeddingsData)) {
      for (let i = 0; i < embeddingsData.length; i++) {
        const item = embeddingsData[i];
        
        if (item && 
            typeof item === 'object' && 
            'journal_entry_id' in item &&
            typeof item.journal_entry_id === 'number') {
          entriesWithEmbeddings.add(item.journal_entry_id);
        }
      }
    }
    
    console.log(`Found ${entriesWithEmbeddings.size} entries that already have embeddings`);
    
    // Filter to entries without embeddings
    const entriesToEmbed = validEntries.filter(e => !entriesWithEmbeddings.has(e.id));
    
    if (entriesToEmbed.length === 0) {
      console.log('All entries already have embeddings');
      return true;
    }
    
    console.log(`Need to generate embeddings for ${entriesToEmbed.length} entries`);
    
    // Process all entries that need embeddings (not just the first 5)
    let successCount = 0;
    const batchSize = 5;
    const totalBatches = Math.ceil(entriesToEmbed.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, entriesToEmbed.length);
      const batchEntries = entriesToEmbed.slice(start, end);
      
      console.log(`Processing batch ${batchIndex + 1}/${totalBatches} with ${batchEntries.length} entries`);
      
      for (const entry of batchEntries) {
        try {
          console.log(`Generating embedding for entry ${entry.id} with text length: ${entry["refined text"]?.length || 0}`);
          
          const { data, error } = await supabase.functions.invoke('generate-embeddings', {
            body: { 
              entryId: entry.id, 
              text: entry["refined text"]
            }
          });
          
          if (error) {
            console.error(`Error generating embedding for entry ${entry.id}:`, error);
          } else if (data?.success) {
            console.log(`Successfully generated embedding for entry ${entry.id}`);
            successCount++;
          } else {
            console.warn(`Failed to generate embedding for entry ${entry.id}: ${data?.message || 'Unknown error'}`);
          }
        } catch (error) {
          console.error(`Exception generating embedding for entry ${entry.id}:`, error);
        }
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Slightly longer delay between batches
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Double check if embeddings were successfully generated
    const { data: finalEmbeddingsData, error: finalEmbeddingsError } = await supabase
      .from('journal_embeddings')
      .select('journal_entry_id')
      .in('journal_entry_id', validEntryIds);
    
    if (!finalEmbeddingsError && finalEmbeddingsData) {
      const finalEmbeddingsCount = finalEmbeddingsData.length;
      console.log(`After processing: ${finalEmbeddingsCount} out of ${validEntryIds.length} entries have embeddings`);
      
      if (finalEmbeddingsCount > entriesWithEmbeddings.size) {
        console.log(`Successfully added ${finalEmbeddingsCount - entriesWithEmbeddings.size} new embeddings`);
        toast.success(`Journal entries prepared for chat (${finalEmbeddingsCount - entriesWithEmbeddings.size} new entries)`);
      }
    }
    
    return successCount > 0 || entriesWithEmbeddings.size > 0;
  } catch (error) {
    console.error('Error in ensureJournalEntriesHaveEmbeddings:', error);
    return false;
  }
}

// Add a new function to help troubleshoot embedding issues
export async function debugEmbeddingIssues(userId: string | undefined): Promise<string> {
  if (!userId) {
    return "No user ID provided";
  }
  
  try {
    // Check for journal entries
    const { data: entriesData, error: entriesError } = await supabase
      .from('Journal Entries')
      .select('id, refined text, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (entriesError) {
      return `Error fetching journal entries: ${entriesError.message}`;
    }
    
    if (!entriesData || entriesData.length === 0) {
      return "No journal entries found for this user";
    }
    
    // Filter valid entries
    const validEntries: Array<{id: number; "refined text"?: string; created_at: string}> = [];
    
    for (const entry of entriesData) {
      if (entry && isValidJournalEntry(entry)) {
        validEntries.push({
          id: entry.id,
          "refined text": entry["refined text"],
          created_at: entry.created_at
        });
      }
    }
    
    const entryIds = validEntries.map(e => e.id);
      
    // Check for embeddings
    const { data: embedData, error: embedError } = await supabase
      .from('journal_embeddings')
      .select('journal_entry_id')
      .in('journal_entry_id', entryIds);
      
    if (embedError) {
      return `Error checking embeddings: ${embedError.message}`;
    }
    
    const embeddingIds = new Set(
      (embedData || [])
        .filter(e => e && typeof e === 'object' && 'journal_entry_id' in e && typeof e.journal_entry_id === 'number')
        .map(e => e.journal_entry_id as number)
    );
    
    const entriesWithoutEmbeddings = validEntries
      .filter(e => !embeddingIds.has(e.id))
      .map(e => ({
        id: e.id,
        created_at: e.created_at,
        has_text: Boolean(e["refined text"]),
        text_length: e["refined text"]?.length || 0
      }));
    
    // Test the match_journal_entries function
    const testQuery = "How am I feeling today?";
    const { data: testEmbedding, error: embedGenError } = await supabase.functions.invoke('generate-embeddings', {
      body: { text: testQuery, isTestQuery: true }
    });
    
    let matchFunctionResult = "Not tested";
    if (!embedGenError && testEmbedding?.embedding) {
      try {
        const { data, error: matchError } = await supabase.rpc(
          'match_journal_entries',
          {
            query_embedding: testEmbedding.embedding,
            match_threshold: 0.0, // Very low threshold to get any matches
            match_count: 10,
            user_id_filter: userId
          }
        );
        
        if (matchError) {
          matchFunctionResult = `Error with match function: ${matchError.message}`;
        } else {
          matchFunctionResult = `Match function returned ${data?.length || 0} results`;
        }
      } catch (error: any) {
        matchFunctionResult = `Exception with match function: ${error.message}`;
      }
    } else {
      matchFunctionResult = `Could not generate test embedding: ${embedGenError?.message || 'Unknown error'}`;
    }
    
    return JSON.stringify({
      total_entries: entriesData.length,
      entries_with_embeddings: embeddingIds.size,
      entries_without_embeddings: entriesWithoutEmbeddings.length,
      match_function_test: matchFunctionResult,
      entries_missing_embeddings: entriesWithoutEmbeddings
    }, null, 2);
  } catch (error: any) {
    return `Error in debugEmbeddingIssues: ${error.message}`;
  }
}

// Individual entry troubleshooting
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
      const { data, error: genError } = await supabase.functions.invoke('generate-embeddings', {
        body: { 
          entryId: entryId,
          text: entry["refined text"],
          forceRegenerate: true
        }
      });
      
      if (genError) {
        console.error(`Error generating embedding for entry ${entryId}:`, genError);
        toast.error(`Failed to generate embedding for entry ${entryId}`);
        return false;
      }
      
      console.log(`Successfully generated embedding for entry ${entryId}`);
      toast.success(`Generated embedding for entry ${entryId}`);
      return true;
    }
    
    console.log(`Embedding already exists for entry ${entryId}`);
    toast.success(`Embedding already exists for entry ${entryId}`);
    return true;
    
  } catch (error) {
    console.error(`Error checking embedding for entry ${entryId}:`, error);
    toast.error(`Error checking embedding for entry ${entryId}`);
    return false;
  }
}

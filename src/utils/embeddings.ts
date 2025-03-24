
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { JournalEntry } from '@/types/journal';

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
    
    if (!entriesData || !Array.isArray(entriesData) || entriesData.length === 0) {
      console.log('No journal entries found for user');
      return false;
    }
    
    console.log(`Found ${entriesData.length} journal entries`);
    
    // Safely type and filter entries with text content
    const validEntries: {id: number; "refined text": string}[] = [];
    
    // We use a type guard to ensure TypeScript knows we're filtering out nulls and undefined
    const nonNullEntries = entriesData.filter((entry): entry is NonNullable<typeof entry> => 
      entry !== null && entry !== undefined
    );
    
    // Validate each entry before using it
    for (const entryData of nonNullEntries) {
      // First check if entryData is not null to satisfy TypeScript
      if (!entryData) continue;
      
      // Then do the rest of the type guard checks
      if (typeof entryData === 'object' && 
          'id' in entryData && 
          entryData.id !== undefined && 
          typeof entryData.id === 'number' && 
          'refined text' in entryData &&
          entryData["refined text"] !== null && 
          entryData["refined text"] !== undefined && 
          typeof entryData["refined text"] === 'string') {
        
        validEntries.push({
          id: entryData.id,
          "refined text": entryData["refined text"]
        });
      }
    }
    
    if (validEntries.length === 0) {
      console.log('No valid journal entries with text found');
      return false;
    }
    
    console.log(`Found ${validEntries.length} valid journal entries with text`);
    
    // Get valid entry IDs for checking
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
    
    if (!embeddingsData || !Array.isArray(embeddingsData)) {
      console.error('No embedding data returned from query');
      return false;
    }
    
    // Extract entry IDs from the results and ensure they're all valid
    const entriesWithEmbeddings = new Set<number>();
    
    // Filter null items first with a proper type guard
    const nonNullEmbeddingsData = embeddingsData.filter((item): item is NonNullable<typeof item> => 
      item !== null && item !== undefined
    );
    
    // Process non-null items
    for (const itemData of nonNullEmbeddingsData) {
      // First check if itemData is not null to satisfy TypeScript
      if (!itemData) continue;
      
      // Then do the rest of the type guard checks
      if (typeof itemData === 'object' && 
          'journal_entry_id' in itemData &&
          itemData.journal_entry_id !== undefined && 
          typeof itemData.journal_entry_id === 'number') {
        
        entriesWithEmbeddings.add(itemData.journal_entry_id);
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
    
    // Generate embeddings for entries without them (limit to 5 at a time)
    const batchSize = 5;
    const entriesToProcess = entriesToEmbed.slice(0, batchSize);
    
    for (const entry of entriesToProcess) {
      try {
        console.log(`Generating embedding for entry ${entry.id}`);
        
        const { data, error } = await supabase.functions.invoke('generate-embeddings', {
          body: { 
            entryId: entry.id, 
            text: entry["refined text"]
          }
        });
        
        if (error) {
          console.error(`Error generating embedding for entry ${entry.id}:`, error);
          // Continue with other entries
        } else {
          console.log(`Successfully generated embedding for entry ${entry.id}`);
        }
      } catch (error) {
        console.error(`Exception generating embedding for entry ${entry.id}:`, error);
        // Continue with other entries
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return true;
  } catch (error) {
    console.error('Error in ensureJournalEntriesHaveEmbeddings:', error);
    return false;
  }
}

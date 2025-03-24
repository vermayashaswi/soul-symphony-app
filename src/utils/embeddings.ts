
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
    
    // Create an array to store valid entries
    const validEntries: Array<{id: number; "refined text": string}> = [];
    
    // Process each entry to filter out invalid ones
    for (let i = 0; i < entriesData.length; i++) {
      const entry = entriesData[i];
      
      // Skip null/undefined entries
      if (!entry) continue;
      
      // Ensure the entry has the required structure and values
      if (typeof entry === 'object' && 
          'id' in entry && 
          typeof entry.id === 'number' &&
          'refined text' in entry &&
          typeof entry["refined text"] === 'string') {
        
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
    
    // Build a set of entries that already have embeddings
    const entriesWithEmbeddings = new Set<number>();
    
    // Process each embedding record
    for (let i = 0; i < embeddingsData.length; i++) {
      const item = embeddingsData[i];
      
      // Skip null/undefined items
      if (!item) continue;
      
      // Ensure the item has the required structure
      if (typeof item === 'object' && 
          'journal_entry_id' in item &&
          typeof item.journal_entry_id === 'number') {
        
        entriesWithEmbeddings.add(item.journal_entry_id);
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

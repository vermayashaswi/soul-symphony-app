
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
    
    // Filter to entries with text content
    const validEntries = entriesData.filter(entry => 
      entry && typeof entry.id === 'number' && entry["refined text"] && 
      typeof entry["refined text"] === 'string'
    );
    
    if (validEntries.length === 0) {
      console.log('No valid journal entries with text found');
      return false;
    }
    
    console.log(`Found ${validEntries.length} valid journal entries with text`);
    
    // Check which entries already have embeddings
    const { data: embeddingsData, error: embeddingsError } = await supabase
      .from('journal_embeddings')
      .select('journal_entry_id')
      .in('journal_entry_id', validEntries.map(e => e.id));
      
    if (embeddingsError) {
      console.error('Error checking existing embeddings:', embeddingsError);
      return false;
    }
    
    const entriesWithEmbeddings = new Set(embeddingsData?.map(e => e.journal_entry_id) || []);
    console.log(`Found ${entriesWithEmbeddings.size} entries that already have embeddings`);
    
    // Filter to entries without embeddings
    const entriesToEmbed = validEntries.filter(e => !entriesWithEmbeddings.has(e.id));
    
    if (entriesToEmbed.length === 0) {
      console.log('All entries already have embeddings');
      return true;
    }
    
    console.log(`Need to generate embeddings for ${entriesToEmbed.length} entries`);
    
    // Generate embeddings for entries without them
    for (const entry of entriesToEmbed.slice(0, 5)) { // Limit to 5 at a time to avoid overload
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

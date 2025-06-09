
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function createJournalEntry(entryData: {
  user_id: string;
  audio_url: string;
  duration: number;
}): Promise<{ id: number } | null> {
  try {
    const { data, error } = await supabase
      .from('Journal Entries')
      .insert([entryData])
      .select('id')
      .single();

    if (error) {
      console.error('Error creating journal entry:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in createJournalEntry:', error);
    return null;
  }
}

export async function updateJournalEntry(entryId: number, updateData: any): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('Journal Entries')
      .update(updateData)
      .eq('id', entryId);

    if (error) {
      console.error('Error updating journal entry:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateJournalEntry:', error);
    return false;
  }
}

export async function storeEmbedding(entryId: number, embedding: number[]): Promise<boolean> {
  try {
    // Use the upsert_journal_embedding function
    const { error } = await supabase.rpc('upsert_journal_embedding', {
      entry_id: entryId,
      embedding_vector: embedding
    });

    if (error) {
      console.error('Error storing embedding:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in storeEmbedding:', error);
    return false;
  }
}

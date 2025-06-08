
import { supabase } from '../_shared/supabase.ts';

export interface JournalEntryData {
  user_id: string;
  audio_url?: string;
  duration?: number;
  'transcription text'?: string;
  'refined text'?: string;
  emotions?: any;
  sentiment?: string;
  entities?: any;
  entityemotion?: any;
  master_themes?: string[];
}

export async function createJournalEntry(entryData: JournalEntryData): Promise<{ id: number } | null> {
  try {
    console.log('[DatabaseOps] Creating journal entry with data:', { 
      user_id: entryData.user_id, 
      hasAudio: !!entryData.audio_url,
      duration: entryData.duration,
      hasTranscription: !!entryData['transcription text'],
      hasRefinedText: !!entryData['refined text']
    });

    const { data, error } = await supabase
      .from('Journal Entries')
      .insert(entryData)
      .select('id')
      .single();

    if (error) {
      console.error('[DatabaseOps] Error creating journal entry:', error);
      return null;
    }

    console.log('[DatabaseOps] Successfully created journal entry with ID:', data.id);
    return data;
  } catch (error) {
    console.error('[DatabaseOps] Exception creating journal entry:', error);
    return null;
  }
}

export async function updateJournalEntry(
  entryId: number, 
  updates: Partial<JournalEntryData>
): Promise<boolean> {
  try {
    console.log('[DatabaseOps] Updating journal entry:', entryId, 'with updates:', Object.keys(updates));

    const { error } = await supabase
      .from('Journal Entries')
      .update(updates)
      .eq('id', entryId);

    if (error) {
      console.error('[DatabaseOps] Error updating journal entry:', error);
      return false;
    }

    console.log('[DatabaseOps] Successfully updated journal entry:', entryId);
    return true;
  } catch (error) {
    console.error('[DatabaseOps] Exception updating journal entry:', error);
    return false;
  }
}

export async function storeEmbedding(entryId: number, embedding: number[]): Promise<boolean> {
  try {
    console.log('[DatabaseOps] Storing embedding for entry:', entryId);
    
    const { error } = await supabase.rpc('upsert_journal_embedding', {
      entry_id: entryId,
      embedding_vector: embedding
    });

    if (error) {
      console.error('[DatabaseOps] Error storing embedding:', error);
      return false;
    }

    console.log('[DatabaseOps] Successfully stored embedding for entry:', entryId);
    return true;
  } catch (error) {
    console.error('[DatabaseOps] Exception storing embedding:', error);
    return false;
  }
}

export async function getJournalEntry(entryId: number): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('*')
      .eq('id', entryId)
      .single();

    if (error) {
      console.error('[DatabaseOps] Error fetching journal entry:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[DatabaseOps] Exception fetching journal entry:', error);
    return null;
  }
}

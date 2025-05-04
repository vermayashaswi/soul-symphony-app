
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Creates a Supabase admin client with the service role key
 * @param url - Supabase project URL
 * @param key - Supabase service role key
 * @returns Supabase client with admin privileges
 */
export function createSupabaseAdmin(url: string, key: string) {
  return createClient(url, key);
}

/**
 * Creates a user profile if it doesn't exist
 * @param supabase - Supabase client
 * @param userId - User ID
 */
export async function createProfileIfNeeded(supabase, userId: string) {
  const { data: existingProfile, error: fetchError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (fetchError) {
    console.error("Error checking profile:", fetchError);
    throw fetchError;
  }

  if (!existingProfile) {
    const { error: createError } = await supabase
      .from('profiles')
      .insert({ id: userId });

    if (createError) {
      console.error("Error creating profile:", createError);
      throw createError;
    }
    
    console.log("Created new profile for user:", userId);
  } else {
    console.log("Profile already exists for user:", userId);
  }
  
  return true;
}

/**
 * Extracts themes from text using a database function
 * @param supabase - Supabase client
 * @param text - Text to extract themes from
 * @param entryId - Journal entry ID
 */
export async function extractThemes(supabase, text: string, entryId: number) {
  try {
    const { data, error } = await supabase.rpc('extract_themes_from_text', {
      text_content: text,
      entry_id: entryId
    });

    if (error) {
      console.error("Error extracting themes:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Error calling extract_themes_from_text function:", error);
    throw error;
  }
}

/**
 * Stores a journal entry in the database
 * @param supabase - Supabase client
 * @param transcriptionText - Original transcribed text
 * @param refinedText - Refined text (potentially in original language)
 * @param audioUrl - URL to the audio file
 * @param userId - User ID
 * @param duration - Audio duration in seconds
 * @param emotions - Emotion analysis results
 * @param sentiment - Sentiment score
 * @param entities - Entity extraction results
 * @param originalLanguage - Detected language of the original transcription
 * @returns ID of the created journal entry
 */
export async function storeJournalEntry(
  supabase,
  transcriptionText: string,
  refinedText: string,
  audioUrl: string | null,
  userId: string | undefined,
  duration: number,
  emotions: any | null,
  sentiment: string | null,
  entities: any | null,
  originalLanguage: string | null
) {
  try {
    // Create entry object with the detected original language
    const entry = {
      "transcription text": transcriptionText,
      "refined text": refinedText,
      audio_url: audioUrl,
      user_id: userId,
      duration: duration,
      emotions: emotions,
      sentiment: sentiment,
      entities: entities,
      original_language: originalLanguage // Store the detected language
    };
    
    const { data, error } = await supabase
      .from('Journal Entries')
      .insert(entry)
      .select('id')
      .single();

    if (error) {
      console.error("Error storing journal entry:", error);
      throw error;
    }

    return data.id;
  } catch (error) {
    console.error("Error in storeJournalEntry:", error);
    throw error;
  }
}

/**
 * Stores an embedding for a journal entry
 * @param supabase - Supabase client
 * @param entryId - Journal entry ID
 * @param content - Text content to embed
 * @param embedding - Vector embedding of the content
 */
export async function storeEmbedding(supabase, entryId: number, content: string, embedding: number[]) {
  try {
    const { error } = await supabase
      .from('journal_embeddings')
      .insert({
        journal_entry_id: entryId,
        content: content,
        embedding: embedding
      });

    if (error) {
      console.error("Error storing embedding:", error);
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error("Error in storeEmbedding:", error);
    throw error;
  }
}

/**
 * Verifies a journal entry exists
 * @param supabase - Supabase client
 * @param entryId - Journal entry ID
 * @returns Journal entry data
 */
export async function verifyJournalEntry(supabase, entryId: number) {
  try {
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('id, "transcription text", "refined text", created_at, emotions')
      .eq('id', entryId)
      .single();

    if (error) {
      console.error("Error verifying journal entry:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Error in verifyJournalEntry:", error);
    throw error;
  }
}

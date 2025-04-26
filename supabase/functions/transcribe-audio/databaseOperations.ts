import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { v4 as uuidv4 } from 'https://deno.land/std@0.168.0/uuid/mod.ts';
import { Configuration, OpenAIApi } from "https://esm.sh/openai@3.2.1";

/**
 * Creates a Supabase client with admin privileges
 */
export function createSupabaseAdmin(supabaseUrl: string, supabaseServiceKey: string) {
  return new SupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

/**
 * Checks if a user profile exists and creates one if it doesn't
 */
export async function createProfileIfNeeded(supabase: SupabaseClient, userId: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (error && error.status !== 406) {
      console.error('Error checking profile:', error);
      throw error;
    }

    if (!data) {
      console.log('Creating profile for user:', userId);
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        throw userError;
      }

      const { error: insertError } = await supabase
        .from('profiles')
        .insert([{
          id: userId,
          email: userData.user?.email,
          full_name: userData.user?.user_metadata?.full_name || '',
          avatar_url: userData.user?.user_metadata?.avatar_url || '',
          onboarding_completed: false
        }]);

      if (insertError) {
        console.error('Error creating profile:', insertError);
        throw insertError;
      }

      console.log('Profile created successfully');
    } else {
      console.log('Profile already exists for user:', userId);
    }
  } catch (error) {
    console.error('Error in createProfileIfNeeded:', error);
    throw error;
  }
}

/**
 * Extracts themes from text using a simple regex
 */
export async function extractThemes(supabase: SupabaseClient, text: string, entryId: number) {
  try {
    // Basic regex-based theme extraction
    const themeRegex = /\b(anxiety|stress|happiness|joy|sadness|anger|fear|love|gratitude|health|work|relationships)\b/gi;
    const matches = text.match(themeRegex);
    const themes = [...new Set(matches ? matches.map(theme => theme.toLowerCase()) : [])];

    console.log(`Extracted themes: ${themes.join(', ')}`);

    // Store themes in the database
    if (themes.length > 0) {
      const { error } = await supabase
        .from('Journal Entries')
        .update({ master_themes: themes })
        .eq('id', entryId);

      if (error) {
        console.error('Error storing themes in database:', error);
      }
    }
  } catch (error) {
    console.error('Error extracting themes:', error);
  }
}

/**
 * Stores a journal entry in the database
 */
export async function storeJournalEntry(
  supabase: SupabaseClient,
  transcribedText: string,
  refinedText: string,
  audioUrl: string | null,
  userId: string,
  duration: number,
  emotions: any,
  sentimentScore: string,
) {
  try {
    console.log('[storeJournalEntry] Starting to store journal entry');
    console.log('[storeJournalEntry] Input validation:', {
      hasTranscribedText: !!transcribedText,
      hasRefinedText: !!refinedText,
      hasAudioUrl: !!audioUrl,
      hasUserId: !!userId,
      duration,
      hasEmotions: !!emotions,
      hasSentiment: !!sentimentScore
    });

    const entry = {
      "transcription text": transcribedText,
      "refined text": refinedText,
      audio_url: audioUrl,
      user_id: userId,
      duration: duration,
      emotions: emotions,
      sentiment: sentimentScore,
      created_at: new Date().toISOString(),
      translation_status: refinedText ? 'completed' : 'pending'
    };

    console.log('[storeJournalEntry] Attempting to insert entry:', JSON.stringify(entry, null, 2));

    const { data, error } = await supabase
      .from('Journal Entries')
      .insert([entry])
      .select()
      .single();

    if (error) {
      console.error('[storeJournalEntry] Error storing journal entry:', error);
      throw error;
    }

    console.log('[storeJournalEntry] Successfully stored entry with ID:', data.id);
    return data.id;
  } catch (error) {
    console.error('[storeJournalEntry] Error in storeJournalEntry:', error);
    throw error;
  }
}

/**
 * Stores an embedding in the database
 */
export async function storeEmbedding(supabase: SupabaseClient, entryId: number, content: string, embedding: number[]) {
  try {
    const { error } = await supabase
      .from('embeddings')
      .insert([{
        entry_id: entryId,
        content: content,
        embedding: embedding
      }]);

    if (error) {
      console.error('Error storing embedding:', error);
      throw error;
    }

    console.log('Embedding stored successfully for entry ID:', entryId);
  } catch (error) {
    console.error('Error in storeEmbedding:', error);
    throw error;
  }
}

/**
 * Verifies a journal entry
 */
export async function verifyJournalEntry(supabase: SupabaseClient, entryId: number) {
  try {
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('*')
      .eq('id', entryId)
      .single();

    if (error) {
      console.error('Error fetching journal entry:', error);
      throw error;
    }

    console.log('Journal entry verified:', data);
  } catch (error) {
    console.error('Error in verifyJournalEntry:', error);
    throw error;
  }
}

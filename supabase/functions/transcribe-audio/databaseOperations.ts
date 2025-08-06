
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { v4 as uuidv4 } from 'https://deno.land/std@0.168.0/uuid/mod.ts';
import { Configuration, OpenAIApi } from "https://esm.sh/openai@3.2.1";

/**
 * Creates a Supabase client with admin privileges
 * DEPRECATED: Use authenticated clients for user operations instead
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
 * Gets timezone from request headers or defaults to UTC
 */
export function getTimezoneFromRequest(req: Request): string {
  // Try to get timezone from headers if available
  const timezone = req.headers.get('x-timezone') || 'UTC';
  return timezone;
}

/**
 * Checks if a user profile exists and creates one if it doesn't
 * NOTE: This should only be used for system operations with admin clients
 * User-specific operations should use authenticated clients with RLS
 */
export async function createProfileIfNeeded(supabase: SupabaseClient, userId: string, timezone?: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, timezone')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking profile:', error);
      throw error;
    }

    // If profile doesn't exist, create one
    if (!data) {
      console.log('Creating profile for user:', userId);
      const { error: insertError } = await supabase
        .from('profiles')
        .insert([{
          id: userId,
          timezone: timezone || 'UTC',
          onboarding_completed: false
        }]);

      if (insertError) {
        console.error('Error creating profile:', insertError);
        throw insertError;
      }

      console.log('Profile created successfully');
    } else {
      console.log('Profile already exists for user:', userId);
      
      // Update timezone if provided and different from current
      if (timezone && (!data.timezone || data.timezone !== timezone)) {
        console.log(`Updating timezone for user ${userId} from ${data.timezone || 'none'} to ${timezone}`);
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            timezone: timezone,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
          
        if (updateError) {
          console.error('Error updating timezone:', updateError);
        } else {
          console.log('Timezone updated successfully');
        }
      }
    }
  } catch (error) {
    console.error('Error in createProfileIfNeeded:', error);
    throw error;
  }
}

/**
 * FIXED: Extracts themes from text and triggers comprehensive theme generation
 * This function now handles ONLY themes - entity extraction is done via sentiment analysis
 */
export async function extractThemes(supabase: SupabaseClient, text: string, entryId: number) {
  try {
    // Basic regex-based theme extraction for immediate storage
    const themeRegex = /\b(anxiety|stress|happiness|joy|sadness|anger|fear|love|gratitude|health|work|relationships|family|friends|career|money|finance|exercise|fitness|travel|food|sleep|weather|nature|music|art|creativity|learning|growth|spirituality|meditation|mindfulness|goals|achievement|success|failure|challenge|problem|solution|hope|worry|excitement|peace|calm|energy|tired|motivation|inspiration|reflection|memory|future|past|present)\b/gi;
    const matches = text.match(themeRegex);
    const themes = [...new Set(matches ? matches.map(theme => theme.toLowerCase()) : [])];

    console.log(`FIXED: Extracted basic themes: ${themes.join(', ')}`);

    // Store themes in the database immediately if any were found
    if (themes.length > 0) {
      const { error } = await supabase
        .from('Journal Entries')
        .update({ master_themes: themes })
        .eq('id', entryId);

      if (error) {
        console.error('FIXED: Error storing themes in database:', error);
      } else {
        console.log('FIXED: Basic themes stored successfully');
      }
    }
    
    // FIXED: Trigger comprehensive theme generation (themes and categories ONLY)
    try {
      console.log(`FIXED: Triggering theme generation (NO entity extraction) for entry ${entryId}`);
      
      const { error: themeError } = await supabase.functions.invoke('generate-themes', {
        body: { 
          entryId: entryId,
          fromEdit: false
        }
      });
      
      if (themeError) {
        console.error("[extractThemes] FIXED: Error invoking generate-themes function:", themeError);
      } else {
        console.log("[extractThemes] FIXED: Successfully triggered theme generation (themes only)");
      }
    } catch (genErr) {
      console.error("[extractThemes] FIXED: Error in theme generation trigger:", genErr);
    }
  } catch (error) {
    console.error('FIXED: Error extracting themes:', error);
  }
}

/**
 * FIXED: Stores a journal entry and triggers sentiment analysis with entity extraction
 * Entity extraction is now handled ONLY by the sentiment analysis function
 * Uses authenticated client to ensure RLS compliance
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
    console.log('[storeJournalEntry] FIXED: Starting to store journal entry');
    console.log('[storeJournalEntry] FIXED: Input validation:', {
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
      created_at: new Date().toISOString()
    };

    console.log('[storeJournalEntry] FIXED: Attempting to insert entry');

    const { data, error } = await supabase
      .from('Journal Entries')
      .insert([entry])
      .select()
      .single();

    if (error) {
      console.error('[storeJournalEntry] FIXED: Error storing journal entry:', error);
      throw error;
    }

    console.log('[storeJournalEntry] FIXED: Successfully stored entry with ID:', data.id);
    
    // FIXED: Trigger sentiment analysis with entity extraction (this is the ONLY place entities are extracted)
    try {
      console.log(`[storeJournalEntry] FIXED: Triggering sentiment analysis WITH entity extraction for entry ${data.id}`);
      
      const { error: sentimentError } = await supabase.functions.invoke('analyze-sentiment', {
        body: { 
          text: refinedText, 
          entryId: data.id,
          extractEntities: true // FIXED: This ensures entity extraction happens HERE
        }
      });
      
      if (sentimentError) {
        console.error("[storeJournalEntry] FIXED: Error invoking analyze-sentiment function:", sentimentError);
      } else {
        console.log("[storeJournalEntry] FIXED: Successfully triggered sentiment analysis with entity extraction");
      }
    } catch (sentErr) {
      console.error("[storeJournalEntry] FIXED: Error triggering sentiment analysis:", sentErr);
    }
    
    return data.id;
  } catch (error) {
    console.error('[storeJournalEntry] FIXED: Error in storeJournalEntry:', error);
    throw error;
  }
}

/**
 * Stores an embedding in the database
 */
export async function storeEmbedding(supabase: SupabaseClient, entryId: number, content: string, embedding: number[]) {
  try {
    const { error } = await supabase
      .rpc('upsert_journal_embedding', {
        entry_id: entryId,
        embedding_vector: embedding
      });

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

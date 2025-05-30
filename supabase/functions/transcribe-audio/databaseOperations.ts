
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
 * Gets timezone from request headers or defaults to UTC
 */
export function getTimezoneFromRequest(req: Request): string {
  // Try to get timezone from headers if available
  const timezone = req.headers.get('x-timezone') || 'UTC';
  return timezone;
}

/**
 * Checks if a user profile exists and creates one if it doesn't
 */
export async function createProfileIfNeeded(supabase: SupabaseClient, userId: string, timezone?: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, timezone')
      .eq('id', userId)
      .single();

    if (error && error.status !== 406) {
      console.error('Error checking profile:', error);
      throw error;
    }

    // If profile doesn't exist, create one
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
          timezone: timezone || 'UTC', // Use provided timezone or default to UTC
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
    
    // Now trigger the more comprehensive theme generation
    try {
      console.log(`Triggering comprehensive theme generation for entry ${entryId}`);
      
      const { error: themeError } = await supabase.functions.invoke('generate-themes', {
        body: { 
          entryId: entryId,
          fromEdit: false
        }
      });
      
      if (themeError) {
        console.error("[extractThemes] Error invoking generate-themes function:", themeError);
      } else {
        console.log("[extractThemes] Successfully triggered theme generation");
      }
    } catch (genErr) {
      console.error("[extractThemes] Error in theme generation trigger:", genErr);
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
      created_at: new Date().toISOString()
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
    
    // Trigger entity extraction
    try {
      console.log(`[storeJournalEntry] Triggering entity extraction for entry ${data.id}`);
      
      const { error: entitiesError } = await supabase.functions.invoke('batch-extract-entities', {
        body: {
          processAll: false,
          diagnosticMode: true,
          entryIds: [data.id]
        }
      });
      
      if (entitiesError) {
        console.error("[storeJournalEntry] Error invoking batch-extract-entities:", entitiesError);
      } else {
        console.log("[storeJournalEntry] Successfully triggered entity extraction");
      }
    } catch (entityErr) {
      console.error("[storeJournalEntry] Error triggering entity extraction:", entityErr);
    }
    
    // Trigger comprehensive sentiment analysis
    try {
      console.log(`[storeJournalEntry] Triggering sentiment analysis for entry ${data.id}`);
      
      const { error: sentimentError } = await supabase.functions.invoke('analyze-sentiment', {
        body: { 
          text: refinedText, 
          entryId: data.id 
        }
      });
      
      if (sentimentError) {
        console.error("[storeJournalEntry] Error invoking analyze-sentiment function:", sentimentError);
      } else {
        console.log("[storeJournalEntry] Successfully triggered sentiment analysis");
      }
    } catch (sentErr) {
      console.error("[storeJournalEntry] Error triggering sentiment analysis:", sentErr);
    }
    
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

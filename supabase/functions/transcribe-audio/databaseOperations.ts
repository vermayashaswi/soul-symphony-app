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
 * Extracts themes and triggers comprehensive analysis using GPT
 */
export async function extractThemes(supabase: SupabaseClient, text: string, entryId: number) {
  try {
    // Basic regex-based theme extraction for immediate storage
    const themeRegex = /\b(anxiety|stress|happiness|joy|sadness|anger|fear|love|gratitude|health|work|relationships|family|friends|career|money|finance|exercise|fitness|travel|food|sleep|weather|nature|music|art|creativity|learning|growth|spirituality|meditation|mindfulness|goals|achievement|success|failure|challenge|problem|solution|hope|worry|excitement|peace|calm|energy|tired|motivation|inspiration|reflection|memory|future|past|present)\b/gi;
    const matches = text.match(themeRegex);
    const themes = [...new Set(matches ? matches.map(theme => theme.toLowerCase()) : [])];

    console.log(`Extracted themes: ${themes.join(', ')}`);

    // Store themes in the database immediately if any were found
    if (themes.length > 0) {
      const { error } = await supabase
        .from('Journal Entries')
        .update({ master_themes: themes })
        .eq('id', entryId);

      if (error) {
        console.error('Error storing themes in database:', error);
      } else {
        console.log('Basic themes stored successfully');
      }
    }
    
    // Trigger the comprehensive theme and entity generation using GPT
    try {
      console.log(`[extractThemes] Triggering FIXED comprehensive theme and entity generation for entry ${entryId}`);
      
      const { error: themeError } = await supabase.functions.invoke('generate-themes', {
        body: { 
          entryId: entryId,
          fromEdit: false
        }
      });
      
      if (themeError) {
        console.error("[extractThemes] Error invoking FIXED generate-themes function:", themeError);
      } else {
        console.log("[extractThemes] Successfully triggered FIXED comprehensive analysis");
      }
    } catch (genErr) {
      console.error("[extractThemes] Error in FIXED theme/entity generation trigger:", genErr);
    }
  } catch (error) {
    console.error('Error extracting themes:', error);
  }
}

/**
 * Stores a journal entry and triggers comprehensive analysis
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
    console.log('[storeJournalEntry] FIXED duration input validation:', {
      hasTranscribedText: !!transcribedText,
      hasRefinedText: !!refinedText,
      hasAudioUrl: !!audioUrl,
      hasUserId: !!userId,
      durationMs: duration, // FIXED: Store in milliseconds
      durationSec: duration / 1000, // FIXED: Convert for logging
      hasEmotions: !!emotions,
      hasSentiment: !!sentimentScore
    });

    const entry = {
      "transcription text": transcribedText,
      "refined text": refinedText,
      audio_url: audioUrl,
      user_id: userId,
      duration: duration, // FIXED: Store the exact milliseconds duration
      emotions: emotions,
      sentiment: sentimentScore,
      created_at: new Date().toISOString()
    };

    console.log('[storeJournalEntry] FIXED entry duration stored as:', entry.duration, 'ms');

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
    console.log('[storeJournalEntry] FIXED stored duration:', data.duration, 'ms');
    
    // Trigger comprehensive entity and theme extraction using GPT (instead of separate triggers)
    try {
      console.log(`[storeJournalEntry] Triggering FIXED comprehensive analysis for entry ${data.id}`);
      
      // Use the FIXED generate-themes function that handles both themes and entities
      const { error: analysisError } = await supabase.functions.invoke('generate-themes', {
        body: {
          entryId: data.id,
          fromEdit: false
        }
      });
      
      if (analysisError) {
        console.error("[storeJournalEntry] Error invoking FIXED comprehensive analysis:", analysisError);
      } else {
        console.log("[storeJournalEntry] Successfully triggered FIXED comprehensive analysis");
      }
    } catch (analysisErr) {
      console.error("[storeJournalEntry] Error triggering FIXED comprehensive analysis:", analysisErr);
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

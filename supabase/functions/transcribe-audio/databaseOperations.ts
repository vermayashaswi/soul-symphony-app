
/**
 * Database operations for the transcribe-audio function
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

/**
 * Creates a Supabase client with admin privileges
 */
export function createSupabaseAdmin(supabaseUrl: string, supabaseServiceKey: string) {
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Ensures a user profile exists, creates one if it doesn't
 */
export async function createProfileIfNeeded(supabase: any, userId: string) {
  if (!userId) return;
  
  try {
    console.log("Checking if profile exists for user:", userId);
    // Check if user profile exists
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
      
    // If profile doesn't exist, create one
    if (error || !profile) {
      console.log("Profile not found, creating one");
      
      // Get user data from auth
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
      if (userError) {
        console.error("Error getting user data:", userError);
        
        // Fallback method if admin API fails
        const { data: fallbackUserData, error: fallbackError } = await supabase.auth.getUser(userId);
        if (fallbackError) {
          console.error("Fallback method also failed:", fallbackError);
          return;
        }
        
        if (fallbackUserData?.user) {
          // Create profile
          const { error: insertError } = await supabase
            .from('profiles')
            .insert([{ 
              id: userId,
              email: fallbackUserData.user.email,
              full_name: fallbackUserData.user?.user_metadata?.full_name || '',
              avatar_url: fallbackUserData.user?.user_metadata?.avatar_url || ''
            }]);
            
          if (insertError) {
            console.error('Error creating user profile:', insertError);
          } else {
            console.log("Profile created successfully for user:", userId);
          }
        }
        
        return;
      }
      
      if (userData?.user) {
        // Create profile
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([{ 
            id: userId,
            email: userData.user.email,
            full_name: userData.user?.user_metadata?.full_name || '',
            avatar_url: userData.user?.user_metadata?.avatar_url || ''
          }]);
          
        if (insertError) {
          console.error('Error creating user profile:', insertError);
        } else {
          console.log("Profile created successfully for user:", userId);
        }
      }
    } else {
      console.log("Profile exists for user:", userId);
    }
  } catch (err) {
    console.error("Error checking/creating profile:", err);
  }
}

/**
 * Extracts themes from text for a journal entry
 */
export async function extractThemes(supabase: any, text: string, entryId: number): Promise<void> {
  try {
    console.log(`Automatically extracting themes for entry ${entryId}`);
    
    // Call the generate-themes function (we keep this for theme extraction only)
    const { data, error } = await supabase.functions.invoke('generate-themes', {
      body: { text, entryId }
    });
    
    if (error) {
      console.error('Error calling generate-themes function:', error);
      return;
    }
    
    console.log('Themes generated successfully:', data);
  } catch (error) {
    console.error('Error in extractThemes:', error);
  }
}

/**
 * Stores a journal entry in the database
 */
export async function storeJournalEntry(
  supabase: any,
  transcribedText: string,
  refinedText: string,
  audioUrl: string | null,
  userId: string | null,
  audioDuration: number,
  emotions: any,
  sentimentScore: string,
  entities: any[]
) {
  try {
    // Ensure userId is in the correct format
    const userIdForDb = userId || null;
    
    console.log("Inserting entry with data:", {
      transcribed_text_length: transcribedText?.length || 0,
      refined_text_length: refinedText?.length || 0,
      has_audio_url: !!audioUrl,
      user_id_present: !!userIdForDb,
      has_emotions: !!emotions,
      sentiment: sentimentScore,
      entities_count: entities?.length || 0,
      duration: audioDuration
    });
    
    // Perform insert with detailed error handling
    try {
      const { data: entryData, error: insertError } = await supabase
        .from('Journal Entries')
        .insert([{ 
          "transcription text": transcribedText,
          "refined text": refinedText,
          "audio_url": audioUrl,
          "user_id": userIdForDb,
          "duration": audioDuration,
          "emotions": emotions,
          "sentiment": sentimentScore,
          "entities": entities
        }])
        .select();
      
      if (insertError) {
        console.error('Error creating entry in database:', insertError);
        console.error('Error details:', JSON.stringify(insertError));
        
        // Check for common issues like missing columns
        if (insertError.message.includes('column') && insertError.message.includes('does not exist')) {
          console.error('Database schema issue: Column does not exist');
        }
        
        // Check for RLS issues
        if (insertError.message.includes('new row violates row-level security')) {
          console.error('RLS policy violation - check that user_id is correctly set and RLS policies allow insert');
        }
        
        throw new Error(`Database insert error: ${insertError.message}`);
      } else if (entryData && entryData.length > 0) {
        console.log("Journal entry saved to database successfully:", entryData[0].id);
        return entryData[0].id;
      } else {
        console.error("No data returned from insert operation");
        throw new Error("Failed to create journal entry in database");
      }
    } catch (dbInsertErr) {
      console.error("Database insert operation error:", dbInsertErr);
      
      // Try a fallback approach with basic insert
      try {
        console.log("Attempting fallback insert with minimal data");
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('Journal Entries')
          .insert([{ 
            "transcription text": transcribedText,
            "refined text": refinedText,
            "user_id": userIdForDb
          }])
          .select();
          
        if (fallbackError) {
          console.error('Fallback insert also failed:', fallbackError);
          throw fallbackError;
        }
        
        if (fallbackData && fallbackData.length > 0) {
          console.log("Fallback journal entry saved with basic data:", fallbackData[0].id);
          return fallbackData[0].id;
        }
        
        throw new Error("Fallback insert returned no data");
      } catch (fallbackErr) {
        console.error("Fallback insert also failed:", fallbackErr);
        throw fallbackErr;
      }
    }
  } catch (dbErr) {
    console.error("Database error:", dbErr);
    throw new Error(`Database error: ${dbErr.message}`);
  }
}

/**
 * Stores an embedding for a journal entry
 */
export async function storeEmbedding(
  supabase: any,
  entryId: number,
  refinedText: string,
  embedding: number[]
) {
  try {
    const { error: embeddingError } = await supabase
      .from('journal_embeddings')
      .insert([{ 
        journal_entry_id: entryId,
        content: refinedText,
        embedding: embedding
      }]);
        
    if (embeddingError) {
      console.error('Error storing embedding:', embeddingError);
      console.error('Embedding error details:', JSON.stringify(embeddingError));
      return false;
    } else {
      console.log("Embedding stored successfully for entry:", entryId);
      return true;
    }
  } catch (embErr) {
    console.error("Error storing embedding:", embErr);
    return false;
  }
}

/**
 * Verifies that a journal entry was successfully stored
 */
export async function verifyJournalEntry(supabase: any, entryId: number) {
  try {
    if (!entryId) return false;
    
    const { data: verifyEntry, error: verifyError } = await supabase
      .from('Journal Entries')
      .select('id')
      .eq('id', entryId)
      .single();
        
    if (verifyError || !verifyEntry) {
      console.error('Failed to verify entry in database:', verifyError);
      return false;
    } else {
      console.log('Entry successfully verified in database:', verifyEntry.id);
      return true;
    }
  } catch (verifyErr) {
    console.error('Error verifying entry in database:', verifyErr);
    return false;
  }
}

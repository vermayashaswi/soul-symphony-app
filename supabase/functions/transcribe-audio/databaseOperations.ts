/**
 * Database operations for the transcribe-audio function
 */
import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase admin client
 */
export function createSupabaseAdmin(url: string, serviceKey: string) {
  return createClient(url, serviceKey);
}

/**
 * Ensures the user profile exists
 */
export async function createProfileIfNeeded(supabase: any, userId: string) {
  if (!userId) {
    console.error("Cannot create profile: No user ID provided");
    return;
  }
  
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
 * Extracts themes from journal entry text
 */
export async function extractThemes(supabase: any, text: string, entryId: number) {
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
 * Stores an embedding for a journal entry
 */
export async function storeEmbedding(supabase: any, entryId: number, text: string, embedding: number[]) {
  try {
    const { error: embeddingError } = await supabase
      .from('journal_embeddings')
      .insert([{ 
        journal_entry_id: entryId,
        content: text,
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
 * Verifies a journal entry exists
 */
export async function verifyJournalEntry(supabase: any, entryId: number) {
  try {
    if (!entryId) {
      console.error("Cannot verify entry: No entry ID provided");
      return false;
    }
    
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

/**
 * Stores a new journal entry in the database
 */
export async function storeJournalEntry(
  supabase: any,
  transcriptionText: string,
  refinedText: string,
  audioUrl: string | null,
  userId: string | null,
  audioDuration: number = 0,
  emotions: any = null,
  sentimentScore: number = 0,
  entities: any[] = [],
  predictedLanguages: {[key: string]: number} | null = null
) {
  try {
    if (!transcriptionText && !refinedText) {
      throw new Error('No text provided for journal entry');
    }

    if (!userId) {
      throw new Error('User ID is required to store journal entry');
    }

    let content = refinedText || transcriptionText;
    
    // Determine which content to use
    if (content.trim() === '') {
      content = 'Empty entry';
    }

    // Add fallback sentiment
    let sentiment = sentimentScore;
    if (sentiment === 0 && emotions) {
      // Try to calculate sentiment from emotions
      const positiveEmotions = ['joy', 'gratitude', 'serenity', 'interest', 'hope', 'pride', 'amusement', 'inspiration'];
      const negativeEmotions = ['anger', 'fear', 'disgust', 'sadness', 'guilt', 'envy', 'anxiety', 'shame'];
      
      let positiveScore = 0;
      let negativeScore = 0;
      
      Object.entries(emotions).forEach(([emotion, score]) => {
        const numericScore = typeof score === 'number' ? score : 0;
        if (positiveEmotions.includes(emotion.toLowerCase())) {
          positiveScore += numericScore;
        }
        if (negativeEmotions.includes(emotion.toLowerCase())) {
          negativeScore += numericScore;
        }
      });
      
      sentiment = positiveScore - negativeScore;
      // Clamp the sentiment score between -1 and 1
      sentiment = Math.max(-1, Math.min(1, sentiment));
    }
    
    console.log('Storing journal entry with content of length:', content.length);
    console.log('User ID:', userId);
    console.log('Sentiment score:', sentiment);
    console.log('Predicted languages:', predictedLanguages ? JSON.stringify(predictedLanguages) : 'None');
    
    // Insert the entry with all available data
    const insertResult = await supabase
      .from('Journal Entries')
      .insert([
        {
          content: content,
          "transcription text": transcriptionText,
          "refined text": refinedText,
          audio_url: audioUrl,
          user_id: userId,
          sentiment: sentiment,
          emotions: emotions ? JSON.stringify(emotions) : null,
          duration: audioDuration,
          entities: entities || [],
          predicted_languages: predictedLanguages
        }
      ])
      .select('id');
      
    if (insertResult.error) {
      console.error('Error storing journal entry in database:', insertResult.error);
      console.error('Error details:', JSON.stringify(insertResult.error, null, 2));
      throw insertResult.error;
    }
    
    if (!insertResult.data || insertResult.data.length === 0) {
      console.error('No data returned from journal entry insert');
      throw new Error('Failed to create journal entry - no ID returned');
    }
    
    const entryId = insertResult.data[0].id;
    console.log('Journal entry stored with ID:', entryId);
    
    return entryId;
  } catch (err) {
    console.error('Error in storeJournalEntry:', err);
    throw err;
  }
}

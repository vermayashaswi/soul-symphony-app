import { supabase } from '@/integrations/supabase/client';
import { JournalEntry } from '@/types/journal';

/**
 * Checks if a user profile exists
 */
export const checkUserProfile = async (userId: string): Promise<boolean> => {
  try {
    console.log('[JournalService] Checking if profile exists for user:', userId);
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
      
    if (error) {
      console.log('[JournalService] Profile not found or error:', error.message);
      return false;
    }
    
    console.log('[JournalService] Profile found:', data);
    return true;
  } catch (error: any) {
    console.error('[JournalService] Error checking profile:', error.message);
    return false;
  }
};

/**
 * Creates a user profile
 */
export const createUserProfile = async (userId: string): Promise<boolean> => {
  try {
    console.log('[JournalService] Creating profile for user:', userId);
    
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
      throw insertError;
    }
    
    console.log('[JournalService] Profile created successfully');
    return true;
  } catch (error: any) {
    console.error('[JournalService] Error creating profile:', error.message);
    return false;
  }
};

/**
 * Creates a placeholder journal entry for new users
 */
export const createPlaceholderEntry = async (userId: string): Promise<number | null> => {
  try {
    console.log('[JournalService] Creating placeholder entry for user:', userId);
    
    // Sample entry data with predefined content
    const placeholderData = {
      user_id: userId,
      "refined text": "Welcome to your journal! This is an example of what your entries will look like. You can record your thoughts by tapping the 'Record' tab and speaking. Your entries will be analyzed for emotions, themes, and key insights.",
      master_themes: ["Getting Started", "Welcome", "Journal Example"],
      sentiment: "positive",
      emotions: {
        "joy": 0.8,
        "curiosity": 0.7,
        "anticipation": 0.6
      },
      entities: [
        {
          type: "concept",
          name: "journal",
          text: "journal"
        },
        {
          type: "activity",
          name: "recording",
          text: "recording"
        }
      ],
      "is_placeholder": true
    };
    
    // Insert the placeholder entry into the database
    const { data, error } = await supabase
      .from('Journal Entries')
      .insert(placeholderData)
      .select('id')
      .single();
      
    if (error) {
      console.error('[JournalService] Error creating placeholder entry:', error);
      return null;
    }
    
    console.log('[JournalService] Placeholder entry created with ID:', data.id);
    return data.id;
  } catch (error: any) {
    console.error('[JournalService] Error creating placeholder entry:', error.message);
    return null;
  }
};

/**
 * Checks if a user has any journal entries
 */
export const checkHasJournalEntries = async (userId: string): Promise<boolean> => {
  try {
    if (!userId) {
      console.error('[JournalService] No user ID provided to check journal entries');
      return false;
    }
    
    console.log('[JournalService] Checking if user has any journal entries:', userId);
    
    const { count, error } = await supabase
      .from('Journal Entries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
      
    if (error) {
      console.error('[JournalService] Error checking journal entries:', error);
      return false;
    }
    
    const hasEntries = count !== null && count > 0;
    console.log(`[JournalService] User has ${count} journal entries`);
    return hasEntries;
  } catch (error: any) {
    console.error('[JournalService] Error checking journal entries:', error.message);
    return false;
  }
};

/**
 * Type guard to check if an object has specific properties
 */
const hasNameAndIntensity = (obj: any): obj is { name: string; intensity: number } => {
  return obj && typeof obj === 'object' && 'name' in obj && 'intensity' in obj;
};

/**
 * Type guard for entity objects
 */
const isEntityObject = (obj: any): obj is { type: string; name: string; text?: string } => {
  return obj && typeof obj === 'object' && 'type' in obj && 'name' in obj;
};

/**
 * Fetches journal entries for a user
 */
export const fetchJournalEntries = async (
  userId: string, 
  timeoutRef: React.MutableRefObject<NodeJS.Timeout | null>
): Promise<JournalEntry[]> => {
  try {
    const fetchStartTime = Date.now();
    console.log(`[JournalService] Fetching entries for user ID: ${userId}`);
    
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      console.error('[JournalService] No active session found');
      throw new Error('No active session. Please sign in again.');
    }
    
    // Add additional logging to track query execution
    console.log('[JournalService] Executing database query for entries');
    
    const { data, error, status } = await supabase
      .from('Journal Entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    // Clear the timeout as fetch completed
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    const fetchEndTime = Date.now();
    console.log(`[JournalService] Fetch completed in ${fetchEndTime - fetchStartTime}ms with status: ${status}`);
      
    if (error) {
      console.error('[JournalService] Error fetching entries:', error);
      throw error;
    }
    
    console.log(`[JournalService] Fetched ${data?.length || 0} entries`);
    
    if (data && data.length > 0) {
      console.log('[JournalService] First entry sample:', {
        id: data[0].id,
        text: data[0]["refined text"],
        created: data[0].created_at,
        emotions: data[0].emotions,
        duration: data[0].duration
      });
    } else {
      console.log('[JournalService] No entries found for this user');
    }
    
    const typedEntries: JournalEntry[] = (data || []).map(item => {
      // Convert emotions if needed
      let convertedEmotions: Record<string, number> = {};
      
      if (item.emotions) {
        if (Array.isArray(item.emotions)) {
          console.log('[JournalService] Converting emotions from array to object format');
          
          // Handle array format
          item.emotions.forEach(emotion => {
            if (hasNameAndIntensity(emotion)) {
              convertedEmotions[emotion.name.toLowerCase()] = emotion.intensity;
            } else if (typeof emotion === 'object' && emotion !== null) {
              // Try to extract name and intensity if available
              const name = 'name' in emotion ? String(emotion.name) : null;
              const intensity = 'intensity' in emotion ? Number(emotion.intensity) : null;
              
              if (name && intensity !== null) {
                convertedEmotions[name.toLowerCase()] = intensity;
              }
            }
          });
        } 
        else if (typeof item.emotions === 'object' && !Array.isArray(item.emotions)) {
          // If emotions is already in object format {joy: 0.7, sadness: 0.5}
          convertedEmotions = Object.entries(item.emotions).reduce((acc, [key, value]) => {
            if (typeof value === 'number') {
              acc[key.toLowerCase()] = value;
            } else if (typeof value === 'string') {
              const numValue = parseFloat(value);
              if (!isNaN(numValue)) {
                acc[key.toLowerCase()] = numValue;
              }
            }
            return acc;
          }, {} as Record<string, number>);
        }
      }
      
      // Parse entities
      let parsedEntities: Array<{type: string, name: string, text?: string}> = [];
      if (item.entities) {
        try {
          if (Array.isArray(item.entities)) {
            // Process array of entity objects
            parsedEntities = item.entities
              .filter(isEntityObject)
              .map(entity => ({
                type: entity.type,
                name: entity.name,
                text: entity.text
              }));
          }
          else if (typeof item.entities === 'string') {
            // Parse JSON string
            const parsed = JSON.parse(item.entities);
            if (Array.isArray(parsed)) {
              parsedEntities = parsed
                .filter(isEntityObject)
                .map(entity => ({
                  type: entity.type,
                  name: entity.name,
                  text: entity.text
                }));
            }
          }
        } catch (err) {
          console.error('[JournalService] Error parsing entities:', err);
        }
      }
      
      return {
        id: item.id,
        content: item["refined text"] || item["transcription text"] || "",
        created_at: item.created_at,
        audio_url: item.audio_url,
        sentiment: item.sentiment,
        themes: item.master_themes,
        foreignKey: item["foreign key"],
        entities: parsedEntities,
        emotions: convertedEmotions,
        duration: item.duration,
        user_feedback: item.user_feedback || null,
        Edit_Status: item.Edit_Status
      };
    });
    
    return typedEntries;
  } catch (error: any) {
    console.error('[JournalService] Error fetching entries:', error);
    throw error;
  }
};

/**
 * Reprocesses a journal entry's text to update analysis fields
 */
export const reprocessJournalEntry = async (entryId: number): Promise<boolean> => {
  try {
    console.log(`[JournalService] Triggering reprocessing for entry ID: ${entryId}`);
    
    // Get the entry's refined text
    const { data: entryData, error: fetchError } = await supabase
      .from('Journal Entries')
      .select('"refined text"')
      .eq('id', entryId)
      .single();
      
    if (fetchError || !entryData) {
      console.error('[JournalService] Error fetching entry text:', fetchError);
      return false;
    }
    
    const textToProcess = entryData["refined text"];
    if (!textToProcess) {
      console.error('[JournalService] No text to process for entry:', entryId);
      return false;
    }
    
    // First, let's update sentiment using the analyze-sentiment function
    try {
      console.log('[JournalService] Calling analyze-sentiment for entry:', entryId);
      const { data: sentimentData, error: sentimentError } = await supabase.functions.invoke('analyze-sentiment', {
        body: { text: textToProcess, entryId }
      });
      
      if (sentimentError) {
        console.error('[JournalService] Error analyzing sentiment:', sentimentError);
      } else if (sentimentData && sentimentData.sentiment) {
        console.log('[JournalService] Sentiment analysis result:', sentimentData);
        
        // The sentiment score will be updated directly by the edge function
        // We don't need to update it here since we passed the entryId to the function
        console.log('[JournalService] Sentiment directly updated by edge function');
      }
    } catch (sentimentErr) {
      console.error('[JournalService] Error in sentiment analysis process:', sentimentErr);
    }
    
    // Now, extract entities using batch-extract-entities function
    try {
      console.log('[JournalService] Calling batch-extract-entities for entry:', entryId);
      const { data: entitiesData, error: entitiesError } = await supabase.functions.invoke('batch-extract-entities', {
        body: { 
          entryIds: [entryId],
          diagnosticMode: true
        }
      });
      
      if (entitiesError) {
        console.error('[JournalService] Error extracting entities:', entitiesError);
      } else {
        console.log('[JournalService] Entity extraction result:', entitiesData);
      }
    } catch (entitiesErr) {
      console.error('[JournalService] Error in entity extraction process:', entitiesErr);
    }
    
    // Now trigger theme extraction
    try {
      // Use the fully qualified import path to avoid name conflicts
      const { triggerFullTextProcessing } = await import('@/utils/audio/theme-extractor');
      await triggerFullTextProcessing(entryId);
      console.log('[JournalService] Successfully triggered theme extraction for entry:', entryId);
    } catch (themeErr) {
      console.error('[JournalService] Error triggering theme extraction:', themeErr);
    }
    
    console.log('[JournalService] Reprocessing complete for entry:', entryId);
    return true;
  } catch (error: any) {
    console.error('[JournalService] Error reprocessing journal entry:', error);
    return false;
  }
};

/**
 * Reprocesses all journal entries with NULL entities and entityemotion fields
 */
export const reprocessAllNullEntries = async (): Promise<{ updated: number, failed: number, total: number }> => {
  try {
    console.log('[JournalService] Triggering reprocessing for all NULL journal entries');
    
    const { data, error } = await supabase.functions.invoke('temporary', { 
      method: 'GET' // Using GET method to trigger the reprocessing function
    });
    
    if (error) {
      console.error('[JournalService] Error reprocessing entries:', error);
      throw error;
    }
    
    console.log('[JournalService] Reprocessing complete:', data);
    return { 
      updated: data?.updated || 0, 
      failed: data?.failed || 0,
      total: data?.total || 0
    };
  } catch (error: any) {
    console.error('[JournalService] Error in reprocessAllNullEntries:', error);
    throw error;
  }
};

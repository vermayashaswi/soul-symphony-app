import { supabase } from '@/integrations/supabase/client';
import { JournalEntry } from '@/types/journal';

/**
 * Creates a welcome entry for users with no entries
 */
export const createWelcomeEntry = async (userId: string): Promise<boolean> => {
  try {
    console.log('[JournalService] Creating welcome entry for user:', userId);
    
    const { data, error } = await supabase.rpc('create_welcome_entry', {
      user_id_param: userId
    });
    
    if (error) {
      console.error('[JournalService] Error creating welcome entry:', error);
      return false;
    }
    
    if (data) {
      console.log('[JournalService] Welcome entry created with ID:', data);
      return true;
    }
    
    return false;
  } catch (error: any) {
    console.error('[JournalService] Error in createWelcomeEntry:', error);
    return false;
  }
};

/**
 * Ensures welcome entry exists for users with 0 regular entries
 */
export const ensureWelcomeEntry = async (userId: string): Promise<boolean> => {
  try {
    console.log('[JournalService] Ensuring welcome entry for user:', userId);
    
    const { data, error } = await supabase.rpc('ensure_welcome_entry', {
      user_id_param: userId
    });
    
    if (error) {
      console.error('[JournalService] Error ensuring welcome entry:', error);
      return false;
    }
    
    if (data) {
      console.log('[JournalService] Welcome entry ensured with ID:', data);
      return true;
    }
    
    return false;
  } catch (error: any) {
    console.error('[JournalService] Error in ensureWelcomeEntry:', error);
    return false;
  }
};

/**
 * Deletes welcome entries (called when user creates first real entry)
 */
export const deleteWelcomeEntries = async (userId: string): Promise<boolean> => {
  try {
    console.log('[JournalService] Deleting welcome entries for user:', userId);
    
    const { data, error } = await supabase.rpc('delete_welcome_entries', {
      user_id_param: userId
    });
    
    if (error) {
      console.error('[JournalService] Error deleting welcome entries:', error);
      return false;
    }
    
    console.log('[JournalService] Deleted welcome entries, count:', data);
    return true;
  } catch (error: any) {
    console.error('[JournalService] Error in deleteWelcomeEntries:', error);
    return false;
  }
};

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
    
    // Create welcome entry for new user
    await createWelcomeEntry(userId);
    
    return true;
  } catch (error: any) {
    console.error('[JournalService] Error creating profile:', error.message);
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
    
    // If no entries found, ensure welcome entry exists
    if (!data || data.length === 0) {
      console.log('[JournalService] No entries found, ensuring welcome entry exists');
      await ensureWelcomeEntry(userId);
      
      // Re-fetch after creating welcome entry
      const { data: newData, error: newError } = await supabase
        .from('Journal Entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
      if (newError) {
        console.error('[JournalService] Error re-fetching entries:', newError);
        throw newError;
      }
      
      console.log(`[JournalService] Re-fetched ${newData?.length || 0} entries after welcome entry creation`);
      
      if (newData && newData.length > 0) {
        return processEntries(newData);
      }
    }
    
    if (data && data.length > 0) {
      console.log('[JournalService] First entry sample:', {
        id: data[0].id,
        text: data[0]["refined text"],
        created: data[0].created_at,
        emotions: data[0].emotions,
        duration: data[0].duration,
        entryType: data[0].entry_type,
        isDeletable: data[0].is_deletable
      });
      
      return processEntries(data);
    } else {
      console.log('[JournalService] No entries found for this user');
      return [];
    }
  } catch (error: any) {
    console.error('[JournalService] Error fetching entries:', error);
    throw error;
  }
};

/**
 * Process entries data into typed format
 */
const processEntries = (data: any[]): JournalEntry[] => {
  return data.map(item => {
    // Convert emotions to proper format
    let convertedEmotions: Record<string, number> | null = null;
    
    if (item.emotions) {
      if (Array.isArray(item.emotions)) {
        console.log('[JournalService] Converting emotions from array to object format');
        
        const emotionObj: Record<string, number> = {};
        item.emotions.forEach(emotion => {
          if (hasNameAndIntensity(emotion)) {
            emotionObj[emotion.name.toLowerCase()] = emotion.intensity;
          }
        });
        convertedEmotions = emotionObj;
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
      master_themes: item.master_themes,
      "foreign key": item["foreign key"],
      entities: parsedEntities,
      emotions: convertedEmotions,
      duration: item.duration,
      user_feedback: item.user_feedback || null,
      Edit_Status: item.Edit_Status,
      entry_type: item.entry_type || 'regular',
      is_deletable: item.is_deletable !== false // Default to true if not specified
    };
  });
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

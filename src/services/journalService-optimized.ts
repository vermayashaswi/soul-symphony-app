
import { supabase } from '@/integrations/supabase/client';
import { JournalEntry } from '@/types/journal';

/**
 * Optimized version of journal service with better error handling and simpler logic
 */

export const checkUserProfileOptimized = async (userId: string): Promise<boolean> => {
  try {
    console.log('[JournalServiceOptimized] Checking profile for user:', userId);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
      
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[JournalServiceOptimized] Error checking profile:', error);
      return false;
    }
    
    const exists = !!data;
    console.log('[JournalServiceOptimized] Profile exists:', exists);
    return exists;
  } catch (error: any) {
    console.error('[JournalServiceOptimized] Exception checking profile:', error);
    return false;
  }
};

export const createUserProfileOptimized = async (userId: string): Promise<boolean> => {
  try {
    console.log('[JournalServiceOptimized] Creating profile for user:', userId);
    
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('[JournalServiceOptimized] Error getting user data:', userError);
      return false;
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
      // Check if error is due to profile already existing
      if (insertError.code === '23505') { // unique_violation
        console.log('[JournalServiceOptimized] Profile already exists');
        return true;
      }
      console.error('[JournalServiceOptimized] Error creating profile:', insertError);
      return false;
    }
    
    console.log('[JournalServiceOptimized] Profile created successfully');
    return true;
  } catch (error: any) {
    console.error('[JournalServiceOptimized] Exception creating profile:', error);
    return false;
  }
};

export const fetchJournalEntriesOptimized = async (
  userId: string, 
  timeoutRef: React.MutableRefObject<NodeJS.Timeout | null>
): Promise<JournalEntry[]> => {
  try {
    console.log(`[JournalServiceOptimized] Fetching entries for user: ${userId}`);
    
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw new Error('No active session');
    }
    
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    // Clear timeout on successful fetch
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
      
    if (error) {
      console.error('[JournalServiceOptimized] Error fetching entries:', error);
      throw error;
    }
    
    console.log(`[JournalServiceOptimized] Successfully fetched ${data?.length || 0} entries`);
    
    // Convert to expected format with proper type handling
    const typedEntries: JournalEntry[] = (data || []).map(item => {
      // Parse entities safely
      let parsedEntities: Array<{type: string, name: string, text?: string}> = [];
      if (item.entities) {
        try {
          if (Array.isArray(item.entities)) {
            // Filter and map entities to ensure they have the required structure
            parsedEntities = item.entities
              .filter((entity: any) => 
                entity && 
                typeof entity === 'object' && 
                typeof entity.type === 'string' && 
                typeof entity.name === 'string'
              )
              .map((entity: any) => ({
                type: entity.type,
                name: entity.name,
                text: entity.text || undefined
              }));
          }
        } catch (err) {
          console.error('[JournalServiceOptimized] Error parsing entities:', err);
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
        emotions: typeof item.emotions === 'object' ? item.emotions : {},
        duration: item.duration,
        user_feedback: item.user_feedback || null,
        Edit_Status: item.Edit_Status
      };
    });
    
    return typedEntries;
  } catch (error: any) {
    console.error('[JournalServiceOptimized] Error fetching entries:', error);
    throw error;
  }
};

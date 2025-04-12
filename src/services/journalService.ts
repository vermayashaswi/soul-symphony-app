
import { supabase } from '@/integrations/supabase/client';
import { JournalEntry } from '@/components/journal/JournalEntryCard';

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
        created: data[0].created_at
      });
    } else {
      console.log('[JournalService] No entries found for this user');
    }
    
    const typedEntries: JournalEntry[] = (data || []).map(item => ({
      id: item.id,
      content: item["refined text"] || item["transcription text"] || "",
      created_at: item.created_at,
      audio_url: item.audio_url,
      sentiment: item.sentiment,
      themes: item.master_themes,
      foreignKey: item["foreign key"],
      entities: item.entities ? (item.entities as any[]).map(entity => ({
        type: entity.type,
        name: entity.name,
        text: entity.text
      })) : undefined
    }));
    
    return typedEntries;
  } catch (error: any) {
    console.error('[JournalService] Error fetching entries:', error);
    throw error;
  }
};

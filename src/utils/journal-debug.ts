
import { supabase } from '@/integrations/supabase/client';

export interface JournalDebugInfo {
  authUser: string | null;
  totalEntries: number;
  userEntries: number;
  entriesWithDifferentUsers: Array<{
    id: number;
    user_id: string;
    created_at: string;
  }>;
  rlsEnabled: boolean;
}

/**
 * Debug function to analyze journal entry access issues
 */
export const debugJournalAccess = async (): Promise<JournalDebugInfo> => {
  console.log('[debugJournalAccess] Starting debug analysis...');

  // Get current authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError) {
    console.error('[debugJournalAccess] Auth error:', authError);
    throw new Error(`Authentication error: ${authError.message}`);
  }

  const authUserId = user?.id || null;
  console.log('[debugJournalAccess] Authenticated user:', authUserId);

  // Try to get total entries count (this might fail due to RLS)
  let totalEntries = 0;
  let userEntries = 0;
  let entriesWithDifferentUsers: Array<{ id: number; user_id: string; created_at: string }> = [];

  try {
    // This query might fail if RLS is strict
    const { data: allEntries, error: allError } = await supabase
      .from('Journal Entries')
      .select('id, user_id, created_at')
      .order('created_at', { ascending: false });

    if (allError) {
      console.warn('[debugJournalAccess] Could not fetch all entries (expected with RLS):', allError.message);
    } else {
      totalEntries = allEntries?.length || 0;
      console.log('[debugJournalAccess] Total entries accessible:', totalEntries);
    }
  } catch (err) {
    console.warn('[debugJournalAccess] Exception fetching all entries:', err);
  }

  // Get entries for the current user
  if (authUserId) {
    try {
      const { data: userEntriesData, error: userError } = await supabase
        .from('Journal Entries')
        .select('id, user_id, created_at')
        .eq('user_id', authUserId)
        .order('created_at', { ascending: false });

      if (userError) {
        console.error('[debugJournalAccess] Error fetching user entries:', userError);
      } else {
        userEntries = userEntriesData?.length || 0;
        console.log('[debugJournalAccess] User entries:', userEntries);

        // Check for any entries with different user IDs (shouldn't happen with RLS)
        if (userEntriesData) {
          entriesWithDifferentUsers = userEntriesData
            .filter(entry => entry.user_id !== authUserId)
            .map(entry => ({
              id: entry.id,
              user_id: entry.user_id,
              created_at: entry.created_at
            }));
        }
      }
    } catch (err) {
      console.error('[debugJournalAccess] Exception fetching user entries:', err);
    }
  }

  return {
    authUser: authUserId,
    totalEntries,
    userEntries,
    entriesWithDifferentUsers,
    rlsEnabled: true // We assume RLS is enabled based on the table setup
  };
};

/**
 * Function to check if there are any orphaned entries and potentially fix them
 */
export const checkAndFixOrphanedEntries = async (): Promise<void> => {
  console.log('[checkAndFixOrphanedEntries] Starting check...');
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    throw new Error('Must be authenticated to fix orphaned entries');
  }

  // For security reasons, we won't actually modify data automatically
  // Instead, we'll just log what we find
  console.log('[checkAndFixOrphanedEntries] Current user:', user.id);
  console.log('[checkAndFixOrphanedEntries] Email:', user.email);
  
  // Check if there are entries with null or different user_ids that might belong to this user
  // This would require admin access to fix properly
  console.log('[checkAndFixOrphanedEntries] This function is for debugging only. To fix orphaned entries, contact system administrator.');
};

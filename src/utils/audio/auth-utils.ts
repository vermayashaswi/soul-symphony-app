
import { supabase } from '@/integrations/supabase/client';

export async function verifyUserAuthentication() {
  // Get the current session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    console.error('Error checking authentication:', sessionError);
    return { isAuthenticated: false, userId: null, error: 'Session error: ' + sessionError.message };
  }
  
  if (!session || !session.user) {
    return { isAuthenticated: false, userId: null, error: 'You must be signed in' };
  }
  
  return { isAuthenticated: true, userId: session.user.id, error: null };
}

export async function getCurrentUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

export async function getUserJournalEntriesCount() {
  const userId = await getCurrentUserId();
  
  if (!userId) {
    return { count: 0, error: 'User not authenticated' };
  }
  
  const { count, error } = await supabase
    .from('Journal Entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
    
  if (error) {
    console.error('Error getting journal entries count:', error);
    return { count: 0, error: error.message };
  }
  
  return { count: count || 0, error: null };
}

export async function getJournalEntryEmbeddingStatus() {
  const userId = await getCurrentUserId();
  
  if (!userId) {
    return { totalEntries: 0, embeddedEntries: 0, error: 'User not authenticated' };
  }
  
  try {
    // Get total entries
    const { count: totalEntries, error: entriesError } = await supabase
      .from('Journal Entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
      
    if (entriesError) throw entriesError;
    
    // First get the IDs of user's journal entries
    const { data: entryIds, error: idsError } = await supabase
      .from('Journal Entries')
      .select('id')
      .eq('user_id', userId);
      
    if (idsError) throw idsError;
    
    if (!entryIds || entryIds.length === 0) {
      return { totalEntries: 0, embeddedEntries: 0, error: null };
    }
    
    // Get entries with embeddings
    const { count: embeddedEntries, error: embeddingsError } = await supabase
      .from('journal_embeddings')
      .select('journal_entry_id', { count: 'exact', head: true })
      .in('journal_entry_id', entryIds.map(entry => entry.id));
      
    if (embeddingsError) throw embeddingsError;
    
    return { 
      totalEntries: totalEntries || 0, 
      embeddedEntries: embeddedEntries || 0,
      error: null 
    };
  } catch (error) {
    console.error('Error checking embedding status:', error);
    return { 
      totalEntries: 0, 
      embeddedEntries: 0, 
      error: error.message 
    };
  }
}

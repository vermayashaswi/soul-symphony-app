
/**
 * Enhanced journal entries hook with improved refresh handling
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { JournalEntry } from '@/types/journal';
import { toast } from 'sonner';

export function useJournalEntries() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Debounced refresh function
  const triggerRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    
    refreshTimeoutRef.current = setTimeout(() => {
      console.log('[useJournalEntries] Triggering debounced refresh');
      setRefreshTrigger(prev => prev + 1);
    }, 500);
  }, []);
  
  // Immediate refresh function for critical updates
  const forceRefresh = useCallback(() => {
    console.log('[useJournalEntries] Forcing immediate refresh');
    queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    setRefreshTrigger(prev => prev + 1);
  }, [queryClient]);
  
  const {
    data: entries = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['journal-entries', user?.id, refreshTrigger],
    queryFn: async (): Promise<JournalEntry[]> => {
      if (!user?.id) {
        console.log('[useJournalEntries] No user ID available');
        return [];
      }
      
      console.log('[useJournalEntries] Fetching journal entries');
      
      const { data, error } = await supabase
        .from('Journal Entries')
        .select(`
          id,
          user_id,
          created_at,
          "transcription text",
          "refined text",
          audio_url,
          duration,
          emotions,
          sentiment,
          entities,
          master_themes,
          user_feedback,
          Edit_Status
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[useJournalEntries] Error fetching entries:', error);
        throw error;
      }
      
      console.log(`[useJournalEntries] Fetched ${data.length} entries`);
      
      // Transform data to match expected format
      return data.map((entry): JournalEntry => ({
        ...entry,
        content: entry["refined text"] || entry["transcription text"] || '',
        themes: entry.master_themes || [],
        entities: Array.isArray(entry.entities) ? entry.entities : []
      }));
    },
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });
  
  // Listen for refresh events
  useEffect(() => {
    const handleRefreshEvent = (event: CustomEvent) => {
      console.log('[useJournalEntries] Refresh event received:', event.detail);
      triggerRefresh();
    };
    
    const handleForceRefreshEvent = () => {
      console.log('[useJournalEntries] Force refresh event received');
      forceRefresh();
    };
    
    const handleEntryCompleted = (event: CustomEvent) => {
      console.log('[useJournalEntries] Entry completed event received:', event.detail);
      // Force immediate refresh for new entries
      forceRefresh();
    };
    
    window.addEventListener('journalEntriesNeedRefresh', handleRefreshEvent as EventListener);
    window.addEventListener('forceJournalRefresh', handleForceRefreshEvent as EventListener);
    window.addEventListener('processingEntryCompleted', handleEntryCompleted as EventListener);
    window.addEventListener('entryContentReady', handleEntryCompleted as EventListener);
    
    return () => {
      window.removeEventListener('journalEntriesNeedRefresh', handleRefreshEvent as EventListener);
      window.removeEventListener('forceJournalRefresh', handleForceRefreshEvent as EventListener);
      window.removeEventListener('processingEntryCompleted', handleEntryCompleted as EventListener);
      window.removeEventListener('entryContentReady', handleEntryCompleted as EventListener);
      
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [triggerRefresh, forceRefresh]);
  
  const deleteEntry = useCallback(async (entryId: number) => {
    if (!user?.id) {
      throw new Error('Not authenticated');
    }
    
    console.log(`[useJournalEntries] Deleting entry: ${entryId}`);
    
    const { error } = await supabase
      .from('Journal Entries')
      .delete()
      .eq('id', entryId)
      .eq('user_id', user.id);
    
    if (error) {
      console.error('[useJournalEntries] Error deleting entry:', error);
      toast.error('Failed to delete entry');
      throw error;
    }
    
    console.log(`[useJournalEntries] Entry ${entryId} deleted successfully`);
    toast.success('Entry deleted successfully');
    
    // Force immediate refresh after deletion
    forceRefresh();
  }, [user?.id, forceRefresh]);
  
  return {
    entries,
    isLoading,
    error,
    refetch,
    triggerRefresh,
    forceRefresh,
    deleteEntry
  };
}

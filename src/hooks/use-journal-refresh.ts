
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

/**
 * A hook for handling journal entry refresh logic, especially for mobile views
 */
export function useJournalRefresh() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const { user } = useAuth();
  
  const refreshEntries = useCallback(async () => {
    if (!user?.id || isRefreshing) return;
    
    setIsRefreshing(true);
    
    try {
      // Verify connectivity to Supabase
      const { error } = await supabase
        .from('Journal Entries')
        .select('id')
        .limit(1);
        
      if (error) {
        console.error('Error refreshing journal entries:', error);
        toast.error('Network error. Please check your connection.');
        return;
      }
      
      // Increment refresh key to trigger a refresh in any components using it
      setRefreshKey(prev => prev + 1);
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error('Failed to refresh journal entries:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [user, isRefreshing]);
  
  useEffect(() => {
    // Listen for the custom event triggered when a new entry is created
    const handleJournalEntryCreated = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('Journal entry created event received', customEvent.detail);
      refreshEntries();
    };
    
    window.addEventListener('journal-entry-created', handleJournalEntryCreated);
    
    return () => {
      window.removeEventListener('journal-entry-created', handleJournalEntryCreated);
    };
  }, [refreshEntries]);
  
  return {
    refreshKey,
    isRefreshing,
    lastRefreshTime,
    refreshEntries
  };
}

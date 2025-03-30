
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { JournalEntry } from '@/components/journal/JournalEntryCard';
import { Json } from '@/integrations/supabase/types';

export function useJournalEntries(userId: string | undefined, refreshKey: number, isProfileChecked: boolean = false) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  // Use useCallback to make fetchEntries reusable
  const fetchEntries = useCallback(async () => {
    if (!userId) {
      console.log('No user ID provided for fetching entries');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const fetchStartTime = Date.now();
      console.log(`[useJournalEntries] Fetching entries for user ID: ${userId} (fetch #${fetchCount + 1})`);
      
      // Fetch entries from the Journal Entries table
      const { data, error, status } = await supabase
        .from('Journal Entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      const fetchEndTime = Date.now();
      console.log(`[useJournalEntries] Fetch completed in ${fetchEndTime - fetchStartTime}ms with status: ${status}`);
        
      if (error) {
        console.error('[useJournalEntries] Error fetching entries:', error);
        toast.error('Failed to load journal entries');
        throw error;
      }
      
      console.log(`[useJournalEntries] Fetched ${data?.length || 0} entries`);
      
      if (data && data.length > 0) {
        console.log('[useJournalEntries] First entry sample:', {
          id: data[0].id,
          text: data[0]["refined text"],
          created: data[0].created_at
        });
      } else {
        console.log('[useJournalEntries] No entries found for this user');
      }
      
      // Convert the data to match our JournalEntry type
      const typedEntries: JournalEntry[] = (data || []).map(item => ({
        id: item.id,
        "transcription text": item["transcription text"],
        "refined text": item["refined text"],
        created_at: item.created_at,
        audio_url: item.audio_url,
        user_id: item.user_id,
        "foreign key": item["foreign key"],
        emotions: item.emotions as Record<string, number> | undefined,
        duration: item.duration,
        master_themes: item.master_themes,
        sentiment: item.sentiment,
        // Properly convert the entities JSON to the expected type
        entities: item.entities ? (item.entities as any[]).map(entity => ({
          type: entity.type,
          name: entity.name
        })) : undefined
      }));
      
      setEntries(typedEntries);
      setLastFetchTime(new Date());
      setFetchCount(prev => prev + 1);
    } catch (error) {
      console.error('[useJournalEntries] Error fetching entries:', error);
      toast.error('Failed to load journal entries');
    } finally {
      setLoading(false);
    }
  }, [userId, fetchCount]);

  useEffect(() => {
    if (userId && isProfileChecked) {
      console.log(`[useJournalEntries] Effect triggered: userId=${!!userId}, refreshKey=${refreshKey}, isProfileChecked=${isProfileChecked}`);
      fetchEntries();
    } else {
      console.log(`[useJournalEntries] Waiting for prerequisites: userId=${!!userId}, isProfileChecked=${isProfileChecked}`);
      setLoading(true);
    }
  }, [userId, refreshKey, isProfileChecked, fetchEntries]);

  return { 
    entries, 
    loading, 
    fetchEntries,
    lastFetchTime,
    fetchCount
  };
}

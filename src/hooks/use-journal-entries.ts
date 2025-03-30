
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { JournalEntry } from '@/components/journal/JournalEntryCard';
import { Json } from '@/integrations/supabase/types';

export function useJournalEntries(userId: string | undefined, refreshKey: number, isProfileChecked: boolean = false) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Use useCallback to make fetchEntries reusable
  const fetchEntries = useCallback(async () => {
    if (!userId) {
      console.log('No user ID provided for fetching entries');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      console.log('Fetching entries for user ID:', userId);
      
      // Fetch entries from the Journal Entries table
      const { data, error } = await supabase
        .from('Journal Entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error fetching entries:', error);
        toast.error('Failed to load journal entries');
        throw error;
      }
      
      console.log('Fetched entries:', data?.length || 0);
      
      if (data && data.length > 0) {
        console.log('First entry sample:', {
          id: data[0].id,
          text: data[0]["refined text"],
          created: data[0].created_at
        });
      } else {
        console.log('No entries found for this user');
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
    } catch (error) {
      console.error('Error fetching entries:', error);
      toast.error('Failed to load journal entries');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId && isProfileChecked) {
      fetchEntries();
    } else {
      setLoading(true);
    }
  }, [userId, refreshKey, isProfileChecked, fetchEntries]);

  return { 
    entries, 
    loading, 
    fetchEntries
  };
}

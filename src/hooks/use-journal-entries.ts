import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { JournalEntry } from '@/components/journal/JournalEntryCard';
import { Json } from '@/integrations/supabase/types';

export function useJournalEntries(userId: string | undefined, refreshKey: number, isProfileChecked: boolean = false) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId && isProfileChecked) {
      fetchEntries();
    } else {
      setLoading(true);
    }
  }, [userId, refreshKey, isProfileChecked]);

  const fetchEntries = async () => {
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
      
      console.log('Fetched entries:', data);
      
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
  };

  // Keep only the analyzeSentimentForEntry function for legacy entries that might need it
  const analyzeSentimentForEntry = async (entry: JournalEntry) => {
    try {
      // Call the existing Supabase Edge Function to analyze sentiment and extract entities
      const { data, error } = await supabase.functions.invoke('analyze-sentiment', {
        body: { text: entry["refined text"], entryId: entry.id }
      });
      
      if (error) {
        console.error('Error analyzing sentiment and entities:', error);
        return;
      }
      
      if (data) {
        console.log('Analysis result:', data);
        
        // The entry will be updated in the database by the edge function
        // Let's update our local entry object for UI refresh
        if (data.sentiment?.score !== undefined) {
          entry.sentiment = data.sentiment.score.toString();
        }
        
        if (data.entities) {
          entry.entities = data.entities;
        }
        
        // Refresh the entries list
        fetchEntries();
      }
    } catch (error) {
      console.error('Error invoking analyze-sentiment function:', error);
    }
  };

  return { entries, loading, fetchEntries, analyzeSentimentForEntry };
}

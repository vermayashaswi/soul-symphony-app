
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

  const generateThemesAndEntitiesForEntry = async (entry: JournalEntry) => {
    try {
      // Call the Supabase Edge Function to generate themes and entities
      const { data, error } = await supabase.functions.invoke('generate-themes', {
        body: { text: entry["refined text"], entryId: entry.id }
      });
      
      if (error) {
        console.error('Error generating themes and entities:', error);
        return;
      }
      
      if (data) {
        // Update the entry with the new themes
        if (data.themes) {
          entry.master_themes = data.themes;
        }
        
        // Update the entry with the new entities
        if (data.entities) {
          entry.entities = data.entities;
        }
      }
    } catch (error) {
      console.error('Error invoking generate-themes function:', error);
    }
  };

  const analyzeSentimentForEntry = async (entry: JournalEntry) => {
    try {
      // Call the existing Supabase Edge Function to analyze sentiment
      const { data, error } = await supabase.functions.invoke('analyze-sentiment', {
        body: { text: entry["refined text"] }
      });
      
      if (error) {
        console.error('Error analyzing sentiment:', error);
        return;
      }
      
      if (data) {
        console.log('Sentiment analysis result:', data);
        
        // Extract the document sentiment score and magnitude
        const sentimentScore = data.documentSentiment?.score;
        
        if (sentimentScore !== undefined) {
          // Update the entry in the database with the sentiment score
          const { error: updateError } = await supabase
            .from('Journal Entries')
            .update({ sentiment: sentimentScore.toString() })
            .eq('id', entry.id);
            
          if (updateError) {
            console.error('Error updating entry with sentiment:', updateError);
          } else {
            // Update the local entry object with the sentiment score
            entry.sentiment = sentimentScore.toString();
          }
        }
      }
    } catch (error) {
      console.error('Error invoking analyze-sentiment function:', error);
    }
  };

  const batchProcessEntities = async (processAll: boolean = false) => {
    try {
      toast.info('Starting batch entity processing...');
      
      const { data, error } = await supabase.functions.invoke('batch-extract-entities', {
        body: { 
          userId: userId,
          processAll: processAll 
        }
      });
      
      if (error) {
        console.error('Error in batch entity processing:', error);
        toast.error('Failed to process entities');
        return false;
      }
      
      if (data && data.success) {
        toast.success(`Successfully processed ${data.processed} entries in ${data.processingTime}`);
        // Refresh entries after batch processing
        fetchEntries();
        return true;
      } else {
        toast.error('Entity processing failed');
        return false;
      }
    } catch (error) {
      console.error('Error invoking batch-extract-entities function:', error);
      toast.error('Failed to start entity processing');
      return false;
    }
  };

  return { entries, loading, batchProcessEntities };
}

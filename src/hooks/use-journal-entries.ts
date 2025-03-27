
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { JournalEntry } from '@/components/journal/JournalEntryCard';

export function useJournalEntries(userId: string | undefined, refreshKey: number) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchEntries();
    }
  }, [userId, refreshKey]);

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
      
      // We need to ensure data matches our JournalEntry type
      const typedEntries = (data || []) as JournalEntry[];
      
      // For any entry that needs analysis, process it
      for (const entry of typedEntries) {
        // Process entries that have text but no sentiment or themes
        if (entry["refined text"]) {
          // Generate themes if needed
          if (!entry.master_themes) {
            await generateThemesForEntry(entry);
          }
          
          // Analyze sentiment if needed
          if (!entry.sentiment && entry["refined text"]) {
            await analyzeSentimentForEntry(entry);
          }
        }
      }
      
      setEntries(typedEntries);
    } catch (error) {
      console.error('Error fetching entries:', error);
      toast.error('Failed to load journal entries');
    } finally {
      setLoading(false);
    }
  };

  const generateThemesForEntry = async (entry: JournalEntry) => {
    try {
      // Call the Supabase Edge Function to generate themes
      const { data, error } = await supabase.functions.invoke('generate-themes', {
        body: { text: entry["refined text"], entryId: entry.id }
      });
      
      if (error) {
        console.error('Error generating themes:', error);
        return;
      }
      
      if (data?.themes) {
        // Update the entry with the new themes
        entry.master_themes = data.themes;
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

  return { entries, loading };
}

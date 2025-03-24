
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { JournalEntry } from '@/types/journal';

interface JournalEntryInput {
  id?: number;
  user_id: string;
  audio_url: string | null;
  "transcription text"?: string;
  "refined text"?: string;
  emotions?: string[] | null;
  created_at: string;
}

export function useJournalEntries(userId: string | undefined, refreshKey: number = 0) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!userId) return;
    
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
      
      // For any entry without master_themes, generate them
      for (const entry of typedEntries) {
        if (!entry.master_themes && entry["refined text"]) {
          await generateThemesForEntry(entry);
        }
      }
      
      setEntries(typedEntries);
    } catch (error) {
      console.error('Error fetching entries:', error);
      toast.error('Failed to load journal entries');
    } finally {
      setLoading(false);
    }
  }, [userId]);

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

  const saveJournalEntry = async (entryData: JournalEntryInput) => {
    if (!userId) throw new Error('User ID is required to save journal entries');
    
    setIsSaving(true);
    try {
      // Map the input data to match the database schema
      const dbEntry = {
        ...entryData.id ? { id: entryData.id } : {},
        user_id: userId,
        audio_url: entryData.audio_url,
        "transcription text": entryData["transcription text"] || '',
        "refined text": entryData["refined text"] || '',
        created_at: entryData.created_at,
        emotions: entryData.emotions
      };
      
      let result;
      
      if (entryData.id) {
        // Update existing entry
        result = await supabase
          .from('Journal Entries')
          .update(dbEntry)
          .eq('id', entryData.id)
          .select()
          .single();
      } else {
        // Insert new entry
        result = await supabase
          .from('Journal Entries')
          .insert(dbEntry)
          .select()
          .single();
      }
      
      const { data, error } = result;
      
      if (error) {
        console.error('Error saving journal entry:', error);
        toast.error('Failed to save journal entry');
        throw error;
      }
      
      // Re-fetch entries to update the list
      await fetchEntries();
      
      return data;
    } catch (error) {
      console.error('Error in saveJournalEntry:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const deleteJournalEntry = async (id: number) => {
    try {
      const { error } = await supabase
        .from('Journal Entries')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting journal entry:', error);
        toast.error('Failed to delete journal entry');
        throw error;
      }
      
      // Update local state
      setEntries(prev => prev.filter(entry => entry.id !== id));
      
    } catch (error) {
      console.error('Error in deleteJournalEntry:', error);
      throw error;
    }
  };

  const refreshEntries = () => {
    fetchEntries();
  };

  // Fetch entries on mount and when dependencies change
  useEffect(() => {
    if (userId) {
      fetchEntries();
    }
  }, [userId, refreshKey, fetchEntries]);

  return { 
    entries, 
    loading, 
    saveJournalEntry,
    isSaving,
    deleteJournalEntry,
    refreshEntries,
    journalEntries: entries, // Alias for backward compatibility
    isLoading: loading // Alias for backward compatibility
  };
}

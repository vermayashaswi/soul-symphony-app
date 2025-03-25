
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { JournalEntry } from '@/types/journal';
import { useTranscription } from './use-transcription';

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const { storeEmbedding } = useTranscription();

  const fetchEntries = useCallback(async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      setLoadError(null);
      console.log('Fetching entries for user ID:', userId);
      
      // Fetch entries from the Journal Entries table
      const { data, error } = await supabase
        .from('Journal Entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error fetching entries:', error);
        setLoadError(error.message);
        // Don't show toast immediately, only after a retry
        throw error;
      }
      
      console.log('Fetched entries:', data);
      
      // We need to ensure data matches our JournalEntry type
      const typedEntries = (data || []) as JournalEntry[];
      
      // For any entry without master_themes, generate them
      for (const entry of typedEntries) {
        if (!entry.master_themes && entry["refined text"]) {
          try {
            await generateThemesForEntry(entry);
          } catch (themeError) {
            console.error('Error generating themes for entry:', themeError);
            // Continue with other entries even if one fails
          }
        }
      }
      
      setEntries(typedEntries);
    } catch (error: any) {
      console.error('Error fetching entries:', error);
      setLoadError(error.message || 'Failed to load journal entries');
      
      // Only show toast error after retry attempts
      if (loadError) {
        toast.error('Failed to load journal entries. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  }, [userId, loadError]);

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
        
        // Update the entry in the database
        const { error: updateError } = await supabase
          .from('Journal Entries')
          .update({ master_themes: data.themes })
          .eq('id', entry.id);
          
        if (updateError) {
          console.error('Error updating entry with themes:', updateError);
        }
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
      
      // Automatically generate embedding for the new/updated entry
      const textToEmbed = data["refined text"] || data["transcription text"] || '';
      if (textToEmbed.trim().length > 0) {
        try {
          console.log('Automatically generating embedding for entry:', data.id);
          await createEmbeddingForEntry(data.id, textToEmbed);
          console.log('Embedding generated successfully');
        } catch (embeddingError) {
          console.error('Error generating embedding:', embeddingError);
          // Don't fail the entire operation if embedding fails
        }
      }
      
      return data;
    } catch (error) {
      console.error('Error in saveJournalEntry:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  // Function to directly create embeddings using the edge function
  const createEmbeddingForEntry = async (journalEntryId: number, text: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-embedding', {
        body: { 
          text, 
          journalEntryId 
        }
      });
      
      if (error) {
        console.error('Error creating embedding:', error);
        return { success: false, error };
      }
      
      return data;
    } catch (error) {
      console.error('Error in createEmbeddingForEntry:', error);
      return { success: false, error };
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

  // Implement retry logic for refreshing entries
  const refreshEntries = async () => {
    try {
      await fetchEntries();
    } catch (error) {
      console.error('Error in manual refresh:', error);
      // Already showing error in fetchEntries
    }
  };

  // Add auto-retry for initial fetch if it fails
  useEffect(() => {
    let retryTimeout: NodeJS.Timeout;
    
    if (loadError && !loading) {
      console.log('Retrying fetch after error in 5 seconds...');
      retryTimeout = setTimeout(() => {
        fetchEntries();
      }, 5000);
    }
    
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [loadError, loading, fetchEntries]);

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
    isLoading: loading, // Alias for backward compatibility
    loadError
  };
}

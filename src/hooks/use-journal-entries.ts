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
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const { storeEmbedding } = useTranscription();

  const MAX_RETRY_ATTEMPTS = 3;

  const fetchEntries = useCallback(async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      setLoadError(null);
      
      const { data, error } = await supabase
        .from('Journal Entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error fetching entries:', error);
        setLoadError(error.message);
        
        if (retryAttempt >= MAX_RETRY_ATTEMPTS) {
          toast.error('Failed to load journal entries. Please try again later.');
        }
        
        throw error;
      }
      
      setRetryAttempt(0);
      
      const typedEntries = (data || []) as JournalEntry[];
      
      for (const entry of typedEntries) {
        if (!entry.master_themes && entry["refined text"]) {
          try {
            await generateThemesForEntry(entry);
          } catch (themeError) {
            console.error('Error generating themes for entry:', themeError);
          }
        }
      }
      
      setEntries(typedEntries);
    } catch (error: any) {
      console.error('Error fetching entries:', error);
      setLoadError(error.message || 'Failed to load journal entries');
      
      if (!isRetrying && retryAttempt < MAX_RETRY_ATTEMPTS) {
        setRetryAttempt(prev => prev + 1);
      }
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  }, [userId, retryAttempt, isRetrying, MAX_RETRY_ATTEMPTS]);

  const generateThemesForEntry = async (entry: JournalEntry) => {
    if (!entry["refined text"] || !entry.id) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-themes', {
        body: { text: entry["refined text"], entryId: entry.id }
      });
      
      if (error) {
        console.error('Error generating themes:', error);
        return;
      }
      
      if (data?.themes) {
        entry.master_themes = data.themes;
        
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
        result = await supabase
          .from('Journal Entries')
          .update(dbEntry)
          .eq('id', entryData.id)
          .select()
          .single();
      } else {
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
      
      await fetchEntries();
      
      const textToEmbed = data["refined text"] || data["transcription text"] || '';
      if (textToEmbed.trim().length > 0) {
        try {
          console.log('Automatically generating embedding for entry:', data.id);
          await createEmbeddingForEntry(data.id, textToEmbed);
          console.log('Embedding generated successfully');
        } catch (embeddingError) {
          console.error('Error generating embedding:', embeddingError);
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
      
      setEntries(prev => prev.filter(entry => entry.id !== id));
    } catch (error) {
      console.error('Error in deleteJournalEntry:', error);
      throw error;
    }
  };

  const refreshEntries = async () => {
    try {
      setIsRetrying(true);
      await fetchEntries();
      toast.success('Journal entries refreshed');
    } catch (error) {
      console.error('Error in manual refresh:', error);
      toast.error('Failed to refresh entries. Please try again.');
    }
  };

  useEffect(() => {
    let retryTimeout: NodeJS.Timeout;
    
    if (loadError && !loading && !isRetrying && retryAttempt < MAX_RETRY_ATTEMPTS) {
      console.log(`Auto-retrying fetch (attempt ${retryAttempt + 1}/${MAX_RETRY_ATTEMPTS}) in 3 seconds...`);
      retryTimeout = setTimeout(() => {
        fetchEntries();
      }, 3000);
    }
    
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [loadError, loading, fetchEntries, retryAttempt, isRetrying, MAX_RETRY_ATTEMPTS]);

  useEffect(() => {
    if (userId) {
      fetchEntries();
    }
  }, [userId, refreshKey, fetchEntries]);

  return { 
    entries, 
    loading, 
    saveJournalEntry: () => {},
    isSaving,
    deleteJournalEntry: () => {},
    refreshEntries,
    journalEntries: entries,
    isLoading: loading,
    loadError,
    retryCount: retryAttempt
  };
}

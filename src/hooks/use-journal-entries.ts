
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
  master_themes?: string[] | null;
  created_at: string;
}

export function useJournalEntries(userId: string | undefined, refreshKey: number = 0) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastRetryTime, setLastRetryTime] = useState<number>(0);
  const [lastRefreshToastId, setLastRefreshToastId] = useState<string | null>(null);

  const MAX_RETRY_ATTEMPTS = 3;
  const RETRY_DELAY = 5000; // 5 seconds between retries

  const fetchEntries = useCallback(async () => {
    if (!userId) {
      console.log('No userId provided to useJournalEntries');
      setLoading(false);
      return;
    }
    
    if (isRetrying) return;
    
    try {
      setLoading(true);
      setLoadError(null);
      
      console.log(`Fetching entries for user ${userId}`);
      
      const { data, error } = await supabase
        .from('Journal Entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error fetching entries:', error);
        console.error('Error details:', JSON.stringify(error));
        setLoadError(error.message);
        
        // Handle max retry attempts
        if (retryAttempt >= MAX_RETRY_ATTEMPTS) {
          toast.error('Failed to load journal entries. Please try again later.', {
            id: 'journal-fetch-error',
            dismissible: true,
          });
          
          setTimeout(() => setRetryAttempt(0), 30000);
          setLoading(false); // Make sure to exit loading state even on error
          return;
        }
        
        throw error;
      }
      
      toast.dismiss('journal-fetch-error');
      
      setRetryAttempt(0);
      
      console.log(`Fetched ${data?.length || 0} entries successfully`);
      
      // Set entries even if empty array
      const typedEntries = (data || []) as JournalEntry[];
      setEntries(typedEntries);
      
      // Handle entries that need themes
      const entriesNeedingThemes = typedEntries.filter(
        entry => (!entry.master_themes || entry.master_themes.length === 0) && entry["refined text"]
      );
      
      if (entriesNeedingThemes.length > 0) {
        console.log(`Found ${entriesNeedingThemes.length} entries without themes, processing...`);
        for (const entry of entriesNeedingThemes) {
          try {
            await generateThemesForEntry(entry);
          } catch (themeError) {
            console.error('Error generating themes for entry:', themeError);
          }
        }
        
        if (entriesNeedingThemes.length > 0) {
          const { data: refreshedData, error: refreshError } = await supabase
            .from('Journal Entries')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
            
          if (refreshError) {
            console.error('Error re-fetching entries after theme generation:', refreshError);
          }
            
          if (refreshedData) {
            console.log(`Re-fetched ${refreshedData.length} entries after theme generation`);
            setEntries(refreshedData as JournalEntry[]);
          }
        }
      }
      
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
        emotions: entryData.emotions,
        master_themes: entryData.master_themes
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
      
      // Automatically generate embedding after saving the entry
      try {
        const textToEmbed = data["refined text"] || data["transcription text"] || '';
        if (textToEmbed.trim().length > 0) {
          console.log('Automatically generating embedding for entry:', data.id);
          
          // Call the Edge Function to create the embedding
          const { error: embeddingError } = await supabase.functions.invoke('create-embedding', {
            body: { 
              text: textToEmbed, 
              journalEntryId: data.id 
            }
          });
          
          if (embeddingError) {
            console.error('Error automatically generating embedding:', embeddingError);
            // Don't show an error toast to the user, as this happens in the background
          } else {
            console.log('Embedding generated successfully');
          }
        }
      } catch (embeddingError) {
        console.error('Error in automatic embedding generation:', embeddingError);
        // Don't surface this error to the user
      }
      
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
      
      setEntries(prev => prev.filter(entry => entry.id !== id));
    } catch (error) {
      console.error('Error in deleteJournalEntry:', error);
      throw error;
    }
  };

  const refreshEntries = async (showToast = true) => {
    try {
      const now = Date.now();
      if (now - lastRetryTime < 2000) {
        console.log('Throttling refresh attempts');
        return;
      }
      
      setLastRetryTime(now);
      setIsRetrying(true);
      await fetchEntries();
      
      if (showToast) {
        if (lastRefreshToastId) {
          toast.dismiss(lastRefreshToastId);
        }
        
        const toastId = `journal-refresh-${Date.now()}`;
        setLastRefreshToastId(toastId);
        
        toast.success('Journal entries refreshed', {
          id: toastId,
          dismissible: true,
        });
      }
    } catch (error) {
      console.error('Error in manual refresh:', error);
      toast.error('Failed to refresh entries. Please try again.', {
        id: 'journal-refresh-error',
        dismissible: true,
      });
    }
  };

  useEffect(() => {
    let retryTimeout: NodeJS.Timeout | null = null;
    
    if (loadError && !loading && !isRetrying && retryAttempt < MAX_RETRY_ATTEMPTS) {
      console.log(`Auto-retrying fetch (attempt ${retryAttempt + 1}/${MAX_RETRY_ATTEMPTS}) in ${RETRY_DELAY / 1000} seconds...`);
      
      const backoffDelay = RETRY_DELAY * Math.pow(2, retryAttempt - 1);
      
      retryTimeout = setTimeout(() => {
        setIsRetrying(true);
        fetchEntries();
      }, backoffDelay);
    }
    
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [loadError, loading, fetchEntries, retryAttempt, isRetrying, MAX_RETRY_ATTEMPTS]);

  useEffect(() => {
    if (userId) {
      setRetryAttempt(0);
      setLoadError(null);
      console.log(`Initial fetch triggered for user ${userId} with refreshKey ${refreshKey}`);
      fetchEntries();
    } else {
      console.log('No user ID available for fetching journal entries');
      setLoading(false); // Important: ensure loading is set to false when no user ID
      setEntries([]); // Clear entries when no user
    }
  }, [userId, refreshKey, fetchEntries]);

  return { 
    entries, 
    loading, 
    saveJournalEntry,
    isSaving,
    deleteJournalEntry,
    refreshEntries,
    journalEntries: entries,
    isLoading: loading,
    loadError,
    retryCount: retryAttempt
  };
}

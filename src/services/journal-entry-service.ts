
import { supabase } from '@/integrations/supabase/client';
import { JournalEntry } from '@/types/journal';
import { toast } from 'sonner';

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

/**
 * Saves a journal entry to the database
 * @param entryData The journal entry data to save
 * @param userId The user ID
 * @returns The saved journal entry
 */
export const saveJournalEntry = async (entryData: JournalEntryInput, userId: string) => {
  if (!userId) throw new Error('User ID is required to save journal entries');
  
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
    
    try {
      const textToEmbed = data["refined text"] || data["transcription text"] || '';
      if (textToEmbed.trim().length > 0) {
        console.log('Automatically generating embedding for entry:', data.id);
        
        const { error: embeddingError } = await supabase.functions.invoke('create-embedding', {
          body: { 
            text: textToEmbed, 
            journalEntryId: data.id 
          }
        });
        
        if (embeddingError) {
          console.error('Error automatically generating embedding:', embeddingError);
        } else {
          console.log('Embedding generated successfully');
        }
      }
    } catch (embeddingError) {
      console.error('Error in automatic embedding generation:', embeddingError);
    }
    
    return data;
  } catch (error) {
    console.error('Error in saveJournalEntry:', error);
    throw error;
  }
};

/**
 * Deletes a journal entry from the database
 * @param id The ID of the journal entry to delete
 * @returns A promise that resolves when the entry is deleted
 */
export const deleteJournalEntry = async (id: number) => {
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
    
    return true;
  } catch (error) {
    console.error('Error in deleteJournalEntry:', error);
    throw error;
  }
};

/**
 * Fetches journal entries for a user
 * @param userId The user ID to fetch entries for
 * @returns The fetched journal entries
 */
export const fetchJournalEntries = async (userId: string) => {
  if (!userId) {
    throw new Error('User ID is required to fetch journal entries');
  }
  
  console.log(`Fetching entries for user ${userId}`);
  
  try {
    // First check if the user has a profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    
    if (profileError) {
      console.warn('Error checking profile, will create one:', profileError);
      
      try {
        // Create profile if it doesn't exist
        const { error: createError } = await supabase
          .from('profiles')
          .insert([{ id: userId }]);
        
        if (createError) {
          console.error('Error creating profile:', createError);
        } else {
          console.log('Profile created successfully');
        }
      } catch (e) {
        console.error('Error in profile creation:', e);
        // Continue anyway
      }
    }
    
    // Now fetch journal entries with a shorter timeout
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('id, "refined text", "transcription text", created_at, emotions, master_themes, user_id, audio_url, duration')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching entries:', error);
      console.error('Error details:', JSON.stringify(error));
      throw error;
    }
    
    console.log(`Fetched ${data?.length || 0} entries successfully`);
    
    return data as JournalEntry[];
  } catch (error) {
    console.error('Error in fetchJournalEntries:', error);
    throw error;
  }
};

/**
 * Processes unprocessed journal entries
 * @param userId The user ID to process entries for
 * @returns Object with processing results
 */
export const processUnprocessedEntries = async (userId: string) => {
  if (!userId) {
    console.log('Cannot process entries: No user ID provided');
    return { success: false, processed: 0 };
  }
  
  try {
    console.log('Processing unprocessed entries for user:', userId);
    
    // Get current session for auth
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log('No active session found, cannot process entries');
      toast.error('Authentication required. Please sign in again.');
      return { success: false, processed: 0 };
    }
    
    try {
      // Use the correct URL format for the edge function with a timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch('https://kwnwhgucnzqxndzjayyq.supabase.co/functions/v1/embed-all-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId,
          processAll: false // Only process entries without embeddings
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response from embed-all-entries:', errorText);
        return { success: false, processed: 0 };
      }
      
      const result = await response.json();
      
      return { success: true, processed: result.processedCount || 0 };
    } catch (fetchError) {
      if (fetchError.name === 'AbortError') {
        console.error('Processing entries request timed out');
        return { success: false, processed: 0, timedOut: true };
      }
      console.error('Error calling embed-all-entries function:', fetchError);
      return { success: false, processed: 0 };
    }
    
    return { success: true, processed: 0 };
  } catch (error) {
    console.error('Error in processUnprocessedEntries:', error);
    return { success: false, processed: 0 };
  }
};

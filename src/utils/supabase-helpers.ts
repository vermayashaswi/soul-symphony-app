import { supabase } from '@/integrations/supabase/client';
import { ensureUserProfile } from './profile-helpers';
import { asId, createChatThreadData, createChatMessageData, asSingleRecord, asDataArray } from './supabase-type-utils';

/**
 * Helper function to safely handle Supabase queries with proper error handling
 */
export const runSafeQuery = async <T>(
  queryFn: () => Promise<{ data: T | null; error: any }>
): Promise<T | null> => {
  try {
    const { data, error } = await queryFn();
    
    if (error) {
      console.error('Supabase query error:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Unexpected error in Supabase query:', err);
    return null;
  }
};

/**
 * Create a thread with proper error handling and type casting
 */
export const createChatThread = async (userId: string, title: string) => {
  if (!userId) {
    console.error('No user ID provided to createChatThread');
    return null;
  }
  
  // First ensure the user has a profile
  await ensureUserProfile(userId);
  
  try {
    const threadData = createChatThreadData({
      user_id: asId(userId),
      title: title,
      updated_at: new Date().toISOString()
    });

    const { data, error } = await supabase
      .from('chat_threads')
      .insert(threadData)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating chat thread:', error);
      return null;
    }
    
    return asSingleRecord(data);
  } catch (err) {
    console.error('Unexpected error in createChatThread:', err);
    return null;
  }
};

/**
 * Get chat threads for a user
 */
export const getChatThreads = async (userId: string) => {
  if (!userId) return [];
  
  try {
    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('user_id', asId(userId))
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching chat threads:', error);
      return [];
    }
    
    return asDataArray(data);
  } catch (err) {
    console.error('Unexpected error in getChatThreads:', err);
    return [];
  }
};

/**
 * Get messages for a thread
 */
export const getChatMessages = async (threadId: string) => {
  if (!threadId) return [];
  
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', asId(threadId))
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching chat messages:', error);
      return [];
    }
    
    return asDataArray(data);
  } catch (err) {
    console.error('Unexpected error in getChatMessages:', err);
    return [];
  }
};

/**
 * Add a message to a thread
 */
export const addChatMessage = async (threadId: string, content: string, sender: 'user' | 'assistant', referenceEntries?: any[]) => {
  if (!threadId) {
    console.error('No thread ID provided to addChatMessage');
    return null;
  }
  
  try {
    const messageData = createChatMessageData({
      thread_id: asId(threadId),
      content: content,
      sender: sender,
      reference_entries: referenceEntries || null
    });

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single();
    
    if (error) {
      console.error('Error adding chat message:', error);
      return null;
    }
    
    return asSingleRecord(data);
  } catch (err) {
    console.error('Unexpected error in addChatMessage:', err);
    return null;
  }
};

/**
 * Delete a chat thread and its messages
 */
export const deleteChatThread = async (threadId: string) => {
  if (!threadId) return false;
  
  try {
    // First delete all messages in the thread
    const { error: messagesError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('thread_id', asId(threadId));
    
    if (messagesError) {
      console.error('Error deleting chat messages:', messagesError);
      return false;
    }
    
    // Then delete the thread
    const { error: threadError } = await supabase
      .from('chat_threads')
      .delete()
      .eq('id', asId(threadId));
    
    if (threadError) {
      console.error('Error deleting chat thread:', threadError);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Unexpected error in deleteChatThread:', err);
    return false;
  }
};

/**
 * Helper for journal entries
 */
export const saveJournalEntry = async (entryData: any, userId: string) => {
  if (!userId) {
    console.error('No user ID provided to saveJournalEntry');
    return null;
  }
  
  try {
    // Ensure user has a profile
    await ensureUserProfile(userId);
    
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
    
    if (entryData.id) {
      // Update existing entry
      const { data, error } = await supabase
        .from('Journal Entries')
        .update(dbEntry as any)
        .eq('id', entryData.id as any)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating journal entry:', error);
        return null;
      }
      
      return data;
    } else {
      // Insert new entry
      const { data, error } = await supabase
        .from('Journal Entries')
        .insert(dbEntry as any)
        .select()
        .single();
      
      if (error) {
        console.error('Error inserting journal entry:', error);
        return null;
      }
      
      return data;
    }
  } catch (err) {
    console.error('Unexpected error in saveJournalEntry:', err);
    return null;
  }
};

/**
 * Get journal entries for a user
 */
export const getJournalEntries = async (userId: string) => {
  if (!userId) return [];
  
  try {
    // Ensure user has a profile
    await ensureUserProfile(userId);
    
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('*')
      .eq('user_id', asId(userId))
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching journal entries:', error);
      return [];
    }
    
    return asDataArray(data);
  } catch (err) {
    console.error('Unexpected error in getJournalEntries:', err);
    return [];
  }
};

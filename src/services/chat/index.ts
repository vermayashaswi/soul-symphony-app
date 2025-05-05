
// Re-export all chat-related services and types
export * from './types';
export * from './threadService';
export * from './messageService';
export * from './useChatPersistence';
export * from './queryPlannerService';

// Explicitly re-export functions needed by chatPersistenceService.ts
export { getUserChatThreads } from './threadService';
export { getThreadMessages } from './messageService';
export { saveMessage } from './messageService';
export const createChatThread = async (userId: string, title: string = 'New Conversation') => {
  try {
    const { data, error } = await supabase.from('chat_threads').insert({
      user_id: userId,
      title
    }).select().single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating chat thread:', error);
    return null;
  }
};
export { updateThreadTitle } from './threadService';

// Add the missing supabase import for createChatThread function
import { supabase } from '@/integrations/supabase/client';

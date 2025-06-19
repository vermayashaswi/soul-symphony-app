
// This file is kept for compatibility, but will be deprecated in favor of the modular structure
// Please import from 'src/services/chat' instead
import { 
  getUserChatThreads,
  getThreadMessages,
  saveMessage,
  createThread,
  updateThreadTitle
} from './chat/messageService';
import { useChatPersistence } from './chat/useChatPersistence';
import { ChatThread, ChatMessage } from './chat/types';

// Re-export everything for backward compatibility
export type { ChatThread, ChatMessage };

export {
  getUserChatThreads,
  getThreadMessages,
  saveMessage,
  createThread as createChatThread,
  updateThreadTitle,
  useChatPersistence
};


// This file is kept for compatibility, but will be deprecated in favor of the modular structure
// Please import from 'src/services/chat' instead
import { 
  getUserChatThreads as getThreads,
  getThreadMessages as getMessages,
  saveMessage as saveMsg,
  createChatThread as createThread,
  updateThreadTitle as updateTitle,
  useChatPersistence as usePersistence
} from './chat';
import { ChatThread as Thread, ChatMessage as Message } from './chat/types';

// Re-export everything for backward compatibility
export type ChatThread = Thread;
export type ChatMessage = Message;

export const getUserChatThreads = getThreads;
export const getThreadMessages = getMessages;
export const saveMessage = saveMsg;
export const createChatThread = createThread;
export const updateThreadTitle = updateTitle;
export const useChatPersistence = usePersistence;

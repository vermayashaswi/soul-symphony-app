
// Re-export all chat service functions for easier imports
export * from './messageService';
export * from './types';
export * from './useChatPersistence';

// Explicitly export the key functions to avoid conflicts
export {
  sendMessage,
  createThread,
  getUserChatThreads,
  getThreadMessages,
  saveMessage,
  updateThreadTitle
} from './messageService';

export type { 
  ChatThread, 
  ChatMessage,
  SubQueryResponse,
  MessageResponse as SendMessageResponse // Export MessageResponse as SendMessageResponse for backward compatibility
} from './types';

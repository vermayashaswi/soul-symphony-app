
// Re-export all chat service functions for easier imports
export * from './messageService';
// Explicitly re-export types to avoid conflicts
export type { ChatThread, SubQueryResponse, TimeAnalysis } from './types';
// Export ChatMessage from only one place to avoid conflicts
export type { ChatMessage as ServiceChatMessage } from './types'; 
export * from './useChatPersistence';

// Export functions from messageService for backward compatibility
export { 
  processWithStructuredPrompt,
  getUserChatThreads,
  getThreadMessages,
  saveMessage,
  createThread,
  updateThreadTitle,
  getUserTimezoneOffset
} from './messageService';

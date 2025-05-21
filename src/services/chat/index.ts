
// Re-export all chat service functions for easier imports
export * from './messageService';
// Explicitly re-export types to avoid conflicts
export type { ChatThread, SubQueryResponse } from './types';
// Export ChatMessage from only one place to avoid conflicts
export type { ChatMessage as ServiceChatMessage } from './types'; 
export * from './useChatPersistence';
// Export the processWithStructuredPrompt function
export { processWithStructuredPrompt } from './messageService';
// Export any other chat services here

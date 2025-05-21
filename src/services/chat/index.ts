
// Re-export all chat service functions for easier imports
export * from './messageService';
// Explicitly re-export types to avoid conflicts
export type { ChatThread, SubQueryResponse } from './types';
// Export ChatMessage from only one place to avoid conflicts
export type { ChatMessage as ServiceChatMessage } from './types'; 
export * from './useChatPersistence';
// Export the processWithStructuredPrompt function
export { processWithStructuredPrompt } from './messageService';
// Export time analysis types for ReferencesDisplay
export interface TimeAnalysis {
  totalEntries: number;
  peakHours: Array<{hour: number, label: string, count: number}>;
  timePeriods: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
  };
}
// Export any other chat services here

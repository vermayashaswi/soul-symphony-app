
import { ThemeUpdateEvent } from "@/services/chat/types";

/**
 * Notifies components about theme updates for journal entries
 */
export const notifyThemeUpdate = (entryId: number) => {
  console.log(`[theme-update-notifier] Notifying theme update for entry: ${entryId}`);
  
  // Create the event payload using the standardized type
  const eventPayload: ThemeUpdateEvent = {
    entryId,
    timestamp: Date.now(),
    source: 'theme-extractor'
  };
  
  // Dispatch a custom event with the entry ID
  window.dispatchEvent(new CustomEvent('journalThemesUpdated', {
    detail: eventPayload
  }));
};

/**
 * Estimate the token count of a text string
 * This is a rough approximation: 1 token ≈ 4 characters for English text
 */
export const estimateTokenCount = (text: string): number => {
  if (!text) return 0;
  // Roughly 4 characters per token for English text
  return Math.ceil(text.length / 4);
};

/**
 * Truncate text to fit within a token limit
 * @param text The text to truncate
 * @param maxTokens Maximum number of tokens
 * @returns Truncated text
 */
export const truncateToTokenLimit = (text: string, maxTokens: number): string => {
  if (!text) return '';
  
  const estimatedTokens = estimateTokenCount(text);
  if (estimatedTokens <= maxTokens) return text;
  
  // Truncate to approximately the right number of characters
  const charLimit = maxTokens * 4;
  return text.substring(0, charLimit) + '...';
};

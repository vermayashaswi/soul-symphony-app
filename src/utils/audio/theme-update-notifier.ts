
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


/**
 * Notifies components about theme updates for journal entries
 */
export const notifyThemeUpdate = (entryId: number) => {
  console.log(`[theme-update-notifier] Notifying theme update for entry: ${entryId}`);
  
  // Dispatch a custom event with the entry ID
  window.dispatchEvent(new CustomEvent('journalThemesUpdated', {
    detail: { 
      entryId,
      timestamp: Date.now()
    }
  }));
};

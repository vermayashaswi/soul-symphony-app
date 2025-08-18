/**
 * Entry Visibility Coordinator - Prevents overlap between processing loaders and processed entries
 */
class EntryVisibilityCoordinator {
  private hiddenProcessedEntries = new Set<string>();
  private activeLoaders = new Set<string>();

  /**
   * Check if a processed entry should be hidden (because its loader is active)
   */
  shouldHideProcessedEntry(tempId: string): boolean {
    return this.activeLoaders.has(tempId);
  }

  /**
   * Mark an entry as having an active loader
   */
  markLoaderActive(tempId: string) {
    console.log(`[EntryVisibilityCoordinator] Marking loader active: ${tempId}`);
    this.activeLoaders.add(tempId);
    this.hiddenProcessedEntries.add(tempId);
  }

  /**
   * Mark a loader as being cleaned up (hide the processed entry temporarily)
   */
  markLoaderCleanupStarted(tempId: string) {
    console.log(`[EntryVisibilityCoordinator] Loader cleanup started: ${tempId}`);
    this.hiddenProcessedEntries.add(tempId);
  }

  /**
   * Mark loader cleanup as complete (allow processed entry to show)
   */
  markLoaderCleanupComplete(tempId: string) {
    console.log(`[EntryVisibilityCoordinator] Loader cleanup complete: ${tempId}`);
    this.activeLoaders.delete(tempId);
    this.hiddenProcessedEntries.delete(tempId);
  }

  /**
   * Get all active loader tempIds
   */
  getActiveLoaders(): string[] {
    return Array.from(this.activeLoaders);
  }

  /**
   * Get all hidden processed entry tempIds
   */
  getHiddenProcessedEntries(): string[] {
    return Array.from(this.hiddenProcessedEntries);
  }

  /**
   * Clear all state
   */
  clearAll() {
    console.log('[EntryVisibilityCoordinator] Clearing all state');
    this.activeLoaders.clear();
    this.hiddenProcessedEntries.clear();
  }
}

// Export singleton
export const entryVisibilityCoordinator = new EntryVisibilityCoordinator();

// Listen for loader events
if (typeof window !== 'undefined') {
  window.addEventListener('processingStarted', (event: CustomEvent) => {
    if (event.detail?.tempId) {
      entryVisibilityCoordinator.markLoaderActive(event.detail.tempId);
    }
  });

  window.addEventListener('loaderCleanupStarted', (event: CustomEvent) => {
    if (event.detail?.tempId) {
      entryVisibilityCoordinator.markLoaderCleanupStarted(event.detail.tempId);
    }
  });

  window.addEventListener('loaderCleanupComplete', (event: CustomEvent) => {
    if (event.detail?.tempId) {
      entryVisibilityCoordinator.markLoaderCleanupComplete(event.detail.tempId);
    }
  });
}
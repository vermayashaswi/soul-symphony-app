
import { Subject, BehaviorSubject } from 'rxjs';
import { toast } from '@/hooks/use-toast';
import { JournalEntry } from '@/types/journal';

// Define entry states for our state machine
export enum EntryProcessingState {
  IDLE = 'idle',
  RECORDING = 'recording',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

// Define entry processing object structure
export interface ProcessingEntry {
  tempId: string;
  entryId?: number;
  state: EntryProcessingState;
  startTime: number;
  lastUpdated: number;
  retryCount: number;
  error?: string;
  minVisibleUntil: number; // Timestamp for guaranteed minimum visibility
  isDisplayed?: boolean; // Flag to track if this entry is currently displayed
}

// Singleton class to manage processing state across components
class ProcessingStateManager {
  private static instance: ProcessingStateManager;
  private processingEntries: Map<string, ProcessingEntry> = new Map();
  
  // Observable streams for components to subscribe to
  private entriesSubject = new BehaviorSubject<ProcessingEntry[]>([]);
  private stateChangeSubject = new Subject<{tempId: string, oldState: EntryProcessingState, newState: EntryProcessingState}>();
  private errorSubject = new Subject<{tempId: string, error: string}>();
  
  // Debounce control
  private lastUpdateTime = 0;
  private readonly DEBOUNCE_TIME = 50; // ms
  
  // Constants for configuration
  private readonly MIN_VISIBILITY_TIME = 2000; // 2 seconds minimum visibility for cards (reduced from 4s)
  private readonly MAX_RETRY_COUNT = 3;
  private readonly AUTO_CLEANUP_INTERVAL = 30000; // 30 seconds (reduced from 60s)
  
  private cleanupTimer: NodeJS.Timeout | null = null;

  private constructor() {
    // Initialize cleanup timer
    this.cleanupTimer = setInterval(() => this.cleanupStaleEntries(), this.AUTO_CLEANUP_INTERVAL);
    
    // Listen for global events from non-React contexts
    if (typeof window !== 'undefined') {
      window.addEventListener('processingEntryCompleted', this.handleExternalCompletionEvent as EventListener);
      window.addEventListener('processingEntryFailed', this.handleExternalErrorEvent as EventListener);
      window.addEventListener('processingCardDisplayed', this.handleCardDisplayedEvent as EventListener);
      window.addEventListener('processingCardRemoved', this.handleCardRemovedEvent as EventListener);
      
      // Add listener for force cleanup of all cards
      window.addEventListener('forceRemoveAllProcessingCards', () => {
        console.log('[ProcessingStateManager] Received force cleanup all event');
        this.cleanupAllEntries();
      });
    }
  }

  public static getInstance(): ProcessingStateManager {
    if (!ProcessingStateManager.instance) {
      ProcessingStateManager.instance = new ProcessingStateManager();
    }
    return ProcessingStateManager.instance;
  }
  
  // Start tracking a new processing entry
  public startProcessing(tempId: string): void {
    if (this.shouldDebounce()) return;
    
    // First check if we're already tracking this tempId
    if (this.processingEntries.has(tempId)) {
      console.log(`[ProcessingStateManager] Entry ${tempId} already exists, skipping duplicate registration`);
      return;
    }
    
    const now = Date.now();
    const entry: ProcessingEntry = {
      tempId,
      state: EntryProcessingState.PROCESSING,
      startTime: now,
      lastUpdated: now,
      retryCount: 0,
      minVisibleUntil: now + this.MIN_VISIBILITY_TIME,
      isDisplayed: false
    };
    
    this.processingEntries.set(tempId, entry);
    this.notifySubscribers();
    
    // Store in localStorage for persistence across navigations
    this.persistToLocalStorage();
    
    console.log(`[ProcessingStateManager] Started processing entry: ${tempId}`);
    
    // Emit an event to ensure the processing state is consistent across components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('processingEntryRegistered', {
        detail: { tempId, timestamp: now }
      }));
    }
  }
  
  // Update the state of a processing entry
  public updateEntryState(tempId: string, state: EntryProcessingState, error?: string): void {
    if (this.shouldDebounce()) return;
    
    const entry = this.processingEntries.get(tempId);
    if (!entry) {
      // If we don't have the entry yet, create it
      if (state === EntryProcessingState.PROCESSING) {
        this.startProcessing(tempId);
      }
      return;
    }
    
    const oldState = entry.state;
    
    // Skip if state hasn't changed
    if (oldState === state && !error) {
      console.log(`[ProcessingStateManager] State already ${state} for ${tempId}, skipping update`);
      return;
    }
    
    const now = Date.now();
    
    // Update the entry properties
    entry.state = state;
    entry.lastUpdated = now;
    
    // If we're transitioning to error state
    if (state === EntryProcessingState.ERROR) {
      entry.error = error || 'Unknown error';
      entry.retryCount += 1;
      this.errorSubject.next({tempId, error: entry.error});
      
      // Auto-retry if we haven't exceeded max retries
      if (entry.retryCount <= this.MAX_RETRY_COUNT) {
        setTimeout(() => this.retryProcessing(tempId), 2000 * entry.retryCount);
      } else {
        // Show error toast if max retries exceeded
        toast({
          title: 'Processing failed',
          description: 'Failed to process journal entry after multiple attempts.',
          variant: 'destructive'
        });
      }
    }
    
    // If completing, ensure minimum visibility time
    if (state === EntryProcessingState.COMPLETED) {
      const timeVisible = now - entry.startTime;
      
      console.log(`[ProcessingStateManager] Marking entry ${tempId} as completed. Visible time: ${timeVisible}ms`);
      
      if (timeVisible < this.MIN_VISIBILITY_TIME) {
        // Don't remove yet, schedule removal after minimum visibility time
        entry.minVisibleUntil = now + (this.MIN_VISIBILITY_TIME - timeVisible);
        setTimeout(() => this.cleanupEntry(tempId), this.MIN_VISIBILITY_TIME - timeVisible + 500);
        console.log(`[ProcessingStateManager] Scheduling cleanup for ${tempId} in ${this.MIN_VISIBILITY_TIME - timeVisible + 500}ms`);
      } else {
        // We've already been visible long enough, schedule a short cleanup
        setTimeout(() => this.cleanupEntry(tempId), 1000);
        console.log(`[ProcessingStateManager] Scheduling immediate cleanup for ${tempId} in 1000ms`);
      }
      
      // Fire a global event to ensure all instances know this entry is complete
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('processingEntryFullyCompleted', {
          detail: { 
            tempId, 
            entryId: entry.entryId, 
            timestamp: now,
            forceCleanup: true
          }
        }));
      }
    }
    
    this.processingEntries.set(tempId, entry);
    this.stateChangeSubject.next({tempId, oldState, newState: state});
    this.notifySubscribers();
    this.persistToLocalStorage();
    
    console.log(`[ProcessingStateManager] Updated entry ${tempId} state: ${oldState} -> ${state}`);
  }
  
  // Map a temp ID to an entry ID when processing completes
  public setEntryId(tempId: string, entryId: number): void {
    const entry = this.processingEntries.get(tempId);
    if (!entry) {
      console.log(`[ProcessingStateManager] No entry found for tempId ${tempId}, creating new one`);
      this.startProcessing(tempId);
      const newEntry = this.processingEntries.get(tempId);
      if (newEntry) {
        newEntry.entryId = entryId;
        this.processingEntries.set(tempId, newEntry);
      }
    } else {
      entry.entryId = entryId;
      this.processingEntries.set(tempId, entry);
    }
    
    this.notifySubscribers();
    this.persistToLocalStorage();
    
    // Store mapping in localStorage for cross-page survival
    const mappingStr = localStorage.getItem('processingToEntryMap') || '{}';
    const mapping = JSON.parse(mappingStr);
    mapping[tempId] = entryId;
    localStorage.setItem('processingToEntryMap', JSON.stringify(mapping));
    
    console.log(`[ProcessingStateManager] Mapped tempId ${tempId} to entryId ${entryId}`);
    
    // Dispatch an event to notify all components about this mapping
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('processingEntryMapped', {
        detail: { 
          tempId, 
          entryId,
          timestamp: Date.now(),
          forceNotify: true
        }
      }));
    }
    
    // After mapping, update to completed state if not already completed
    if (entry && entry.state !== EntryProcessingState.COMPLETED) {
      this.updateEntryState(tempId, EntryProcessingState.COMPLETED);
      
      // Also schedule removal after a short delay
      setTimeout(() => {
        this.removeEntry(tempId);
      }, 2000);
    }
  }
  
  // Get entry ID from temp ID
  public getEntryId(tempId: string): number | undefined {
    const entry = this.processingEntries.get(tempId);
    if (entry && entry.entryId) {
      return entry.entryId;
    }
    
    // Try localStorage as fallback
    try {
      const mappingStr = localStorage.getItem('processingToEntryMap') || '{}';
      const mapping = JSON.parse(mappingStr);
      const entryId = mapping[tempId];
      return entryId ? Number(entryId) : undefined;
    } catch {
      return undefined;
    }
  }
  
  // Get an entry by ID (new method)
  public getEntryById(tempId: string): ProcessingEntry | undefined {
    return this.processingEntries.get(tempId);
  }
  
  // Retry processing an entry that failed
  public retryProcessing(tempId: string): void {
    const entry = this.processingEntries.get(tempId);
    if (!entry) return;
    
    entry.state = EntryProcessingState.PROCESSING;
    entry.lastUpdated = Date.now();
    this.processingEntries.set(tempId, entry);
    this.notifySubscribers();
    
    // Dispatch an event to request retry
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('retryProcessingEntry', {
        detail: { tempId, timestamp: Date.now() }
      }));
    }
    
    console.log(`[ProcessingStateManager] Retrying processing for entry ${tempId}`);
  }
  
  // Manually remove an entry (e.g. for deletion)
  public removeEntry(tempIdOrEntryId: string | number): void {
    console.log(`[ProcessingStateManager] Removing entry: ${tempIdOrEntryId} (${typeof tempIdOrEntryId})`);
    
    if (typeof tempIdOrEntryId === 'number') {
      // Find by entry ID
      let tempIdsToRemove: string[] = [];
      
      for (const [tempId, entry] of this.processingEntries.entries()) {
        if (entry.entryId === tempIdOrEntryId) {
          tempIdsToRemove.push(tempId);
          console.log(`[ProcessingStateManager] Found matching tempId ${tempId} for entryId ${tempIdOrEntryId}`);
        }
      }
      
      // Remove each matching tempId
      tempIdsToRemove.forEach(tempId => {
        this.processingEntries.delete(tempId);
        console.log(`[ProcessingStateManager] Removed entry with tempId ${tempId}`);
        
        // Also dispatch cleanup events
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('processingCardRemove', {
            detail: { tempId, timestamp: Date.now(), forceCleanup: true }
          }));
          
          // Additional force remove event
          window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
            detail: { tempId, timestamp: Date.now(), forceCleanup: true, immediate: true }
          }));
        }
      });
    } else {
      // Remove by temp ID
      this.processingEntries.delete(tempIdOrEntryId);
      console.log(`[ProcessingStateManager] Removed entry with tempId ${tempIdOrEntryId}`);
      
      // Dispatch a cleanup event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('processingCardRemove', {
          detail: { tempId: tempIdOrEntryId, timestamp: Date.now(), forceCleanup: true }
        }));
        
        // Additional force remove event
        window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
          detail: { tempId: tempIdOrEntryId, timestamp: Date.now(), forceCleanup: true, immediate: true }
        }));
      }
    }
    
    this.notifySubscribers();
    this.persistToLocalStorage();
  }
  
  // Track when a processing card is displayed in the UI
  private handleCardDisplayedEvent = (event: CustomEvent) => {
    if (!event.detail?.tempId) return;
    
    const entry = this.processingEntries.get(event.detail.tempId);
    if (entry) {
      entry.isDisplayed = true;
      this.processingEntries.set(event.detail.tempId, entry);
      console.log(`[ProcessingStateManager] Entry ${event.detail.tempId} is now displayed`);
    }
  };
  
  // Track when a processing card is removed from the UI
  private handleCardRemovedEvent = (event: CustomEvent) => {
    if (!event.detail?.tempId) return;
    
    const entry = this.processingEntries.get(event.detail.tempId);
    if (entry) {
      entry.isDisplayed = false;
      this.processingEntries.set(event.detail.tempId, entry);
      console.log(`[ProcessingStateManager] Entry ${event.detail.tempId} is no longer displayed`);
      
      // If the entry is completed and no longer displayed, we can safely remove it
      if (entry.state === EntryProcessingState.COMPLETED) {
        setTimeout(() => this.cleanupEntry(event.detail.tempId), 500);
      }
    }
  };
  
  // Get list of all processing entries
  public getProcessingEntries(): ProcessingEntry[] {
    return Array.from(this.processingEntries.values());
  }
  
  // Get active processing entry IDs (only those in processing state)
  public getActiveProcessingEntryIds(): string[] {
    return Array.from(this.processingEntries.values())
      .filter(entry => entry.state === EntryProcessingState.PROCESSING)
      .map(entry => entry.tempId);
  }
  
  // Check if an entry is still processing
  public isProcessing(tempIdOrEntryId: string | number): boolean {
    if (!tempIdOrEntryId) return false;
    
    if (typeof tempIdOrEntryId === 'number') {
      // Check by entry ID
      for (const entry of this.processingEntries.values()) {
        if (entry.entryId === tempIdOrEntryId && entry.state === EntryProcessingState.PROCESSING) {
          return true;
        }
      }
      return false;
    } else {
      // Check by temp ID
      const entry = this.processingEntries.get(tempIdOrEntryId);
      return entry?.state === EntryProcessingState.PROCESSING;
    }
  }
  
  // Check if an entry is in error state
  public hasError(tempId: string): boolean {
    const entry = this.processingEntries.get(tempId);
    return entry?.state === EntryProcessingState.ERROR;
  }
  
  // Clear all entries (for reset or testing)
  public clearAll(): void {
    this.processingEntries.clear();
    this.notifySubscribers();
    this.persistToLocalStorage();
    
    // Clear localStorage entries
    localStorage.removeItem('processingEntries');
    localStorage.removeItem('processingToEntryMap');
    
    console.log('[ProcessingStateManager] Cleared all entries');
    
    // Also force update UI
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
        detail: { entries: [], lastUpdate: Date.now(), forceUpdate: true }
      }));
      
      // Force remove all processing cards
      window.dispatchEvent(new CustomEvent('forceRemoveAllProcessingCards', {
        detail: { timestamp: Date.now() }
      }));
    }
  }
  
  // Force cleanup all entries regardless of state (new method)
  public cleanupAllEntries(): void {
    console.log('[ProcessingStateManager] Force cleaning all entries');
    
    const entries = Array.from(this.processingEntries.keys());
    let cleanedCount = 0;
    
    entries.forEach(tempId => {
      this.processingEntries.delete(tempId);
      cleanedCount++;
      
      // Dispatch events to ensure UI is updated
      window.dispatchEvent(new CustomEvent('processingCardRemove', {
        detail: { tempId, timestamp: Date.now(), forceCleanup: true }
      }));
      
      window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
        detail: { tempId, timestamp: Date.now(), forceCleanup: true, immediate: true }
      }));
    });
    
    if (cleanedCount > 0) {
      console.log(`[ProcessingStateManager] Force cleaned ${cleanedCount} entries`);
      this.notifySubscribers();
      this.persistToLocalStorage();
      
      // Trigger global UI refresh
      window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
        detail: { entries: [], lastUpdate: Date.now(), forceUpdate: true }
      }));
    }
  }
  
  // Get observables for components to subscribe
  public entriesChanges() {
    return this.entriesSubject.asObservable();
  }
  
  public stateChanges() {
    return this.stateChangeSubject.asObservable();
  }
  
  public errorEvents() {
    return this.errorSubject.asObservable();
  }
  
  // Restore state from localStorage on reload/navigation
  public restoreFromLocalStorage(): void {
    try {
      console.log('[ProcessingStateManager] Attempting to restore state from localStorage');
      // Restore processing entries
      const entriesStr = localStorage.getItem('processingEntries');
      if (entriesStr) {
        const entries: ProcessingEntry[] = JSON.parse(entriesStr);
        console.log(`[ProcessingStateManager] Found ${entries.length} entries in localStorage`);
        
        entries.forEach(entry => {
          // Don't restore really old entries (> 2 minutes)
          const isStale = Date.now() - entry.lastUpdated > 2 * 60 * 1000;
          if (!isStale) {
            // Reset the isDisplayed flag on restore
            entry.isDisplayed = false;
            this.processingEntries.set(entry.tempId, entry);
            console.log(`[ProcessingStateManager] Restored entry ${entry.tempId} (state: ${entry.state})`);
          } else {
            console.log(`[ProcessingStateManager] Skipping stale entry ${entry.tempId}`);
          }
        });
      }
      
      // Clean out any entries that should be visible but aren't in processing state
      this.processingEntries.forEach((entry, tempId) => {
        if (entry.state !== EntryProcessingState.PROCESSING && 
            Date.now() > entry.minVisibleUntil) {
          console.log(`[ProcessingStateManager] Removing completed entry ${tempId} on restore`);
          this.processingEntries.delete(tempId);
        }
      });
      
      this.notifySubscribers();
      console.log('[ProcessingStateManager] Restored state from localStorage');
    } catch (error) {
      console.error('[ProcessingStateManager] Error restoring from localStorage:', error);
    }
  }

  // Event handlers for external events
  private handleExternalCompletionEvent = (event: CustomEvent) => {
    if (event.detail?.tempId) {
      const { tempId, entryId } = event.detail;
      console.log(`[ProcessingStateManager] External completion event for ${tempId}${entryId ? ` -> ${entryId}` : ''}`);
      
      if (entryId) {
        this.setEntryId(tempId, entryId);
      }
      this.updateEntryState(tempId, EntryProcessingState.COMPLETED);
      
      // If forceCleanup is set, clean up immediately
      if (event.detail.forceClearProcessingCard) {
        setTimeout(() => {
          this.cleanupEntry(tempId);
        }, 500);
      }
    }
  };
  
  private handleExternalErrorEvent = (event: CustomEvent) => {
    if (event.detail?.tempId) {
      const { tempId, error } = event.detail;
      console.log(`[ProcessingStateManager] External error event for ${tempId}: ${error}`);
      this.updateEntryState(tempId, EntryProcessingState.ERROR, error);
    }
  };
  
  // Clean up a specific entry
  private cleanupEntry(tempId: string): void {
    console.log(`[ProcessingStateManager] Attempting to clean up entry ${tempId}`);
    
    const entry = this.processingEntries.get(tempId);
    if (!entry) {
      console.log(`[ProcessingStateManager] Entry ${tempId} not found for cleanup`);
      return;
    }
    
    // Only clean up if we've met minimum visibility time and entry is completed or errored
    const isCompleted = entry.state === EntryProcessingState.COMPLETED;
    const isErrored = entry.state === EntryProcessingState.ERROR;
    const visibilityTimeMet = Date.now() >= entry.minVisibleUntil;
    
    if ((isCompleted || isErrored) && visibilityTimeMet) {
      this.processingEntries.delete(tempId);
      this.notifySubscribers();
      this.persistToLocalStorage();
      
      console.log(`[ProcessingStateManager] Cleaned up entry ${tempId} (state: ${entry.state})`);
      
      // Also dispatch an event to ensure the UI clears any loading cards
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('processingCardRemove', {
          detail: { 
            tempId, 
            entryId: entry.entryId, 
            timestamp: Date.now(), 
            forceCleanup: true 
          }
        }));
        
        // Additional force remove event
        window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
          detail: { 
            tempId, 
            entryId: entry.entryId,
            timestamp: Date.now(), 
            forceCleanup: true,
            immediate: true
          }
        }));
      }
    } else {
      console.log(`[ProcessingStateManager] Not cleaning up entry ${tempId} yet: completed=${isCompleted}, errored=${isErrored}, visibilityMet=${visibilityTimeMet}`);
    }
  }
  
  // Periodically clean up stale entries
  private cleanupStaleEntries(): void {
    const now = Date.now();
    let hasChanges = false;
    
    this.processingEntries.forEach((entry, tempId) => {
      // Clean up completed entries that have met minimum visibility time
      if (entry.state === EntryProcessingState.COMPLETED && now >= entry.minVisibleUntil) {
        this.processingEntries.delete(tempId);
        hasChanges = true;
        console.log(`[ProcessingStateManager] Auto-cleaned completed entry ${tempId}`);
        
        // Also dispatch events to ensure UI is updated
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('processingCardRemove', {
            detail: { 
              tempId, 
              entryId: entry.entryId, 
              timestamp: now, 
              forceCleanup: true 
            }
          }));
          
          // Additional force remove event
          window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
            detail: { 
              tempId, 
              entryId: entry.entryId,
              timestamp: now, 
              forceCleanup: true,
              immediate: true
            }
          }));
        }
      }
      
      // Clean up error entries after 3 minutes (reduced from 5)
      if (entry.state === EntryProcessingState.ERROR && 
          now - entry.lastUpdated > 3 * 60 * 1000) {
        this.processingEntries.delete(tempId);
        hasChanges = true;
        console.log(`[ProcessingStateManager] Auto-cleaned error entry ${tempId}`);
      }
      
      // Handle stale entries that are still marked as processing after 45 seconds (reduced from 10 min)
      if (entry.state === EntryProcessingState.PROCESSING && 
          now - entry.lastUpdated > 45 * 1000) {
        // First mark as error
        entry.state = EntryProcessingState.ERROR;
        entry.error = 'Processing timed out';
        hasChanges = true;
        console.log(`[ProcessingStateManager] Marked stale entry ${tempId} as error (age: ${now - entry.startTime}ms)`);
        
        // Then schedule removal after a short delay
        setTimeout(() => {
          this.removeEntry(tempId);
        }, 5000);
      }
    });
    
    if (hasChanges) {
      this.notifySubscribers();
      this.persistToLocalStorage();
    }
  }
  
  // Utility to check if we should debounce an update
  private shouldDebounce(): boolean {
    const now = Date.now();
    if (now - this.lastUpdateTime < this.DEBOUNCE_TIME) {
      return true;
    }
    this.lastUpdateTime = now;
    return false;
  }
  
  // Notify all subscribers of state changes
  private notifySubscribers(): void {
    this.entriesSubject.next(Array.from(this.processingEntries.values()));
  }
  
  // Persist current state to localStorage
  private persistToLocalStorage(): void {
    try {
      const entries = Array.from(this.processingEntries.values());
      localStorage.setItem('processingEntries', JSON.stringify(entries));
    } catch (error) {
      console.error('[ProcessingStateManager] Error persisting to localStorage:', error);
    }
  }
  
  // Cleanup on app shutdown
  public dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('processingEntryCompleted', this.handleExternalCompletionEvent as EventListener);
      window.removeEventListener('processingEntryFailed', this.handleExternalErrorEvent as EventListener);
      window.removeEventListener('processingCardDisplayed', this.handleCardDisplayedEvent as EventListener);
      window.removeEventListener('processingCardRemoved', this.handleCardRemovedEvent as EventListener);
    }
  }
}

// Export singleton instance
export const processingStateManager = ProcessingStateManager.getInstance();

// Hook to use processing state in components
export function useProcessingState() {
  return processingStateManager;
}

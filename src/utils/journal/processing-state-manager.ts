
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
  private readonly MIN_VISIBILITY_TIME = 4000; // 4 seconds minimum visibility for cards
  private readonly MAX_RETRY_COUNT = 3;
  private readonly AUTO_CLEANUP_INTERVAL = 60000; // 1 minute
  
  private cleanupTimer: NodeJS.Timeout | null = null;

  private constructor() {
    // Initialize cleanup timer
    this.cleanupTimer = setInterval(() => this.cleanupStaleEntries(), this.AUTO_CLEANUP_INTERVAL);
    
    // Listen for global events from non-React contexts
    if (typeof window !== 'undefined') {
      window.addEventListener('processingEntryCompleted', this.handleExternalCompletionEvent as EventListener);
      window.addEventListener('processingEntryFailed', this.handleExternalErrorEvent as EventListener);
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
    
    const now = Date.now();
    const entry: ProcessingEntry = {
      tempId,
      state: EntryProcessingState.PROCESSING,
      startTime: now,
      lastUpdated: now,
      retryCount: 0,
      minVisibleUntil: now + this.MIN_VISIBILITY_TIME
    };
    
    this.processingEntries.set(tempId, entry);
    this.notifySubscribers();
    
    // Store in localStorage for persistence across navigations
    this.persistToLocalStorage();
    
    console.log(`[ProcessingStateManager] Started processing entry: ${tempId}`);
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
      if (timeVisible < this.MIN_VISIBILITY_TIME) {
        // Don't remove yet, schedule removal after minimum visibility time
        entry.minVisibleUntil = now + (this.MIN_VISIBILITY_TIME - timeVisible);
        setTimeout(() => this.cleanupEntry(tempId), this.MIN_VISIBILITY_TIME - timeVisible + 500);
      } else {
        // We've already been visible long enough, schedule a short cleanup
        setTimeout(() => this.cleanupEntry(tempId), 1500);
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
    if (!entry) return;
    
    entry.entryId = entryId;
    this.processingEntries.set(tempId, entry);
    this.notifySubscribers();
    this.persistToLocalStorage();
    
    // Store mapping in localStorage for cross-page survival
    const mappingStr = localStorage.getItem('processingToEntryMap') || '{}';
    const mapping = JSON.parse(mappingStr);
    mapping[tempId] = entryId;
    localStorage.setItem('processingToEntryMap', JSON.stringify(mapping));
    
    console.log(`[ProcessingStateManager] Mapped tempId ${tempId} to entryId ${entryId}`);
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
    if (typeof tempIdOrEntryId === 'number') {
      // Find by entry ID
      for (const [tempId, entry] of this.processingEntries.entries()) {
        if (entry.entryId === tempIdOrEntryId) {
          this.processingEntries.delete(tempId);
        }
      }
    } else {
      // Remove by temp ID
      this.processingEntries.delete(tempIdOrEntryId);
    }
    
    this.notifySubscribers();
    this.persistToLocalStorage();
    
    console.log(`[ProcessingStateManager] Removed entry ${tempIdOrEntryId}`);
  }
  
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
      // Restore processing entries
      const entriesStr = localStorage.getItem('processingEntries');
      if (entriesStr) {
        const entries: ProcessingEntry[] = JSON.parse(entriesStr);
        entries.forEach(entry => {
          // Don't restore really old entries (> 5 minutes)
          const isStale = Date.now() - entry.lastUpdated > 5 * 60 * 1000;
          if (!isStale) {
            this.processingEntries.set(entry.tempId, entry);
          }
        });
      }
      
      // Clean out any entries that should be visible but aren't in processing state
      this.processingEntries.forEach((entry, tempId) => {
        if (entry.state !== EntryProcessingState.PROCESSING && 
            Date.now() > entry.minVisibleUntil) {
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
      if (entryId) {
        this.setEntryId(tempId, entryId);
      }
      this.updateEntryState(tempId, EntryProcessingState.COMPLETED);
    }
  };
  
  private handleExternalErrorEvent = (event: CustomEvent) => {
    if (event.detail?.tempId) {
      const { tempId, error } = event.detail;
      this.updateEntryState(tempId, EntryProcessingState.ERROR, error);
    }
  };
  
  // Clean up a specific entry
  private cleanupEntry(tempId: string): void {
    const entry = this.processingEntries.get(tempId);
    if (!entry) return;
    
    // Only clean up if we've met minimum visibility time
    if (Date.now() >= entry.minVisibleUntil) {
      this.processingEntries.delete(tempId);
      this.notifySubscribers();
      this.persistToLocalStorage();
      console.log(`[ProcessingStateManager] Cleaned up entry ${tempId}`);
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
      }
      
      // Clean up error entries after 5 minutes
      if (entry.state === EntryProcessingState.ERROR && 
          now - entry.lastUpdated > 5 * 60 * 1000) {
        this.processingEntries.delete(tempId);
        hasChanges = true;
        console.log(`[ProcessingStateManager] Auto-cleaned error entry ${tempId}`);
      }
      
      // Handle stale entries that are still marked as processing after 10 minutes
      if (entry.state === EntryProcessingState.PROCESSING && 
          now - entry.lastUpdated > 10 * 60 * 1000) {
        entry.state = EntryProcessingState.ERROR;
        entry.error = 'Processing timed out';
        hasChanges = true;
        console.log(`[ProcessingStateManager] Marked stale entry ${tempId} as error`);
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
    }
  }
}

// Export singleton instance
export const processingStateManager = ProcessingStateManager.getInstance();

// Hook to use processing state in components
export function useProcessingState() {
  return processingStateManager;
}

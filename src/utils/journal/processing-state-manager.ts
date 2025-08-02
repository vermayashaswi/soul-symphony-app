import { BehaviorSubject, Observable } from 'rxjs';
import { showSaveError, showGeneralError } from '@/utils/toast-messages';
import { logger } from '@/utils/logger';

// Define the processing state enum - simplified
export enum EntryProcessingState {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

// Define the processing entry type
export interface ProcessingEntry {
  tempId: string;
  entryId?: number;
  startTime: number;
  state: EntryProcessingState;
  errorMessage?: string;
  isVisible: boolean; // New field for smart transparency
}

export class ProcessingStateManager {
  private processingEntries: ProcessingEntry[] = [];
  private entriesSubject = new BehaviorSubject<ProcessingEntry[]>([]);
  private activeStartProcessingCalls = new Set<string>(); // Prevent duplicates
  private immediateProcessingState = new Set<string>(); // Track immediate processing
  private processingIntentFlag = false; // Emergency fallback flag
  
  private logger = logger.createLogger('ProcessingStateManager');
  
  constructor() {
    this.logger.debug('Initialized with immediate cleanup');
  }
  
  // Emergency fallback methods for immediate processing detection
  public setProcessingIntent(value: boolean): void {
    this.processingIntentFlag = value;
    this.logger.debug('Processing intent set', { value });
    
    // Clear intent after shorter delay if not overridden
    if (value) {
      setTimeout(() => {
        if (this.processingIntentFlag && this.processingEntries.length === 0) {
          this.processingIntentFlag = false;
          this.logger.debug('Auto-cleared processing intent flag');
        }
      }, 1000); // Reduced from 3s to 1s
    }
  }
  
  public hasProcessingIntent(): boolean {
    return this.processingIntentFlag;
  }
  
  // Enhanced immediate detection method
  public hasAnyImmediateProcessing(): boolean {
    return this.processingIntentFlag || 
           this.immediateProcessingState.size > 0 || 
           this.getVisibleProcessingEntries().length > 0;
  }
  
  public startProcessing(tempId: string): void {
    this.logger.debug('Starting processing', { tempId });
    
    // Clear processing intent since we now have real processing
    this.processingIntentFlag = false;
    
    // Strict duplicate prevention with active call tracking
    if (this.activeStartProcessingCalls.has(tempId)) {
      this.logger.debug('StartProcessing already in progress, ignoring', { tempId });
      return;
    }
    
    // Additional check for existing entries
    const existingEntry = this.processingEntries.find(e => e.tempId === tempId);
    if (existingEntry) {
      this.logger.debug('Entry already exists, making visible instead', { tempId });
      existingEntry.isVisible = true;
      this.immediateProcessingState.add(tempId);
      this.notifySubscribers();
      return;
    }
    
    // Mark as active to prevent race conditions
    this.activeStartProcessingCalls.add(tempId);
    
    // Add to immediate state for instant detection
    this.immediateProcessingState.add(tempId);
    
    const entry: ProcessingEntry = {
      tempId,
      startTime: Date.now(),
      state: EntryProcessingState.PROCESSING,
      isVisible: true
    };
    
    this.processingEntries.push(entry);
    this.logger.debug('Added entry', { tempId, totalEntries: this.processingEntries.length });
    
    // Immediately notify subscribers SYNCHRONOUSLY
    this.notifySubscribers();
    
    // Dispatch immediate event for UI updates SYNCHRONOUSLY
    window.dispatchEvent(new CustomEvent('processingStarted', {
      detail: { tempId, timestamp: Date.now(), immediate: true }
    }));
    
    // Also dispatch immediate processing state change
    window.dispatchEvent(new CustomEvent('immediateProcessingStarted', {
      detail: { tempId, timestamp: Date.now() }
    }));
    
    // Clean up active call tracking after shorter delay
    setTimeout(() => {
      this.activeStartProcessingCalls.delete(tempId);
    }, 500); // Reduced from 1s to 500ms
  }
  
  // New method to check immediate processing state
  public isImmediatelyProcessing(tempId: string): boolean {
    return this.immediateProcessingState.has(tempId) || this.isProcessing(tempId);
  }
  
  // New method to get immediate processing count
  public getImmediateProcessingCount(): number {
    return this.immediateProcessingState.size + this.getVisibleProcessingEntries().length;
  }
  
  // New method to check if any processing is happening right now
  public hasAnyProcessing(): boolean {
    return this.immediateProcessingState.size > 0 || this.getVisibleProcessingEntries().length > 0;
  }
  
  public updateEntryState(tempId: string, state: EntryProcessingState, errorMessage?: string): void {
    const entry = this.processingEntries.find(e => e.tempId === tempId);
    if (!entry) {
      this.logger.debug('Entry not found for state update', { tempId });
      return;
    }
    
    entry.state = state;
    if (errorMessage) {
      entry.errorMessage = errorMessage;
    }
    
    // Clear from immediate state when completing
    if (state === EntryProcessingState.COMPLETED) {
      this.immediateProcessingState.delete(tempId);
      this.logger.debug('Entry completed, checking for real entry', { tempId });
      this.checkAndHideEntry(tempId);
    }
    
    this.notifySubscribers();
    this.logger.debug('Updated state', { tempId, state });
  }
  
  private checkAndHideEntry(tempId: string): void {
    // IMMEDIATE DOM check with smart selectors
    const realEntryExists = this.hasRealEntryInDOM(tempId);
    
    if (realEntryExists) {
      this.logger.debug('Real entry found, hiding immediately', { tempId });
      this.hideEntry(tempId);
      
      // Remove IMMEDIATELY - no delays
      this.removeEntry(tempId);
    } else {
      // Quick retry with much shorter timeout
      setTimeout(() => {
        const retryCheck = this.hasRealEntryInDOM(tempId);
        if (retryCheck) {
          this.logger.debug('Real entry found on retry', { tempId });
          this.hideEntry(tempId);
          this.removeEntry(tempId); // Remove immediately on retry too
        } else {
          // Force cleanup if no real entry found
          this.logger.debug('Force cleanup - no real entry detected', { tempId });
          this.removeEntry(tempId);
        }
      }, 100); // Reduced from 500ms to 100ms
    }
  }
  
  private hasRealEntryInDOM(tempId: string): boolean {
    // Multiple strategies to detect real entry
    const selectors = [
      `[data-temp-id="${tempId}"][data-processing="false"]`,
      `[data-temp-id="${tempId}"].journal-entry-card:not(.processing-card)`,
      `[data-entry-id]:not([data-loading-skeleton="true"])[data-temp-id="${tempId}"]`,
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Additional check for content
        const hasContent = element.querySelector('.journal-entry-content') || 
                          element.textContent?.trim().length > 20;
        if (hasContent) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  public hideEntry(tempId: string): void {
    const entry = this.processingEntries.find(e => e.tempId === tempId);
    if (entry) {
      entry.isVisible = false;
      this.immediateProcessingState.delete(tempId);
      this.notifySubscribers();
      console.log(`[ProcessingStateManager] Hidden entry ${tempId}`);
      
      // Dispatch event for immediate UI update
      window.dispatchEvent(new CustomEvent('processingEntryHidden', {
        detail: { tempId, timestamp: Date.now() }
      }));
    }
  }
  
  public setEntryId(tempId: string, entryId: number): void {
    const entry = this.processingEntries.find(e => e.tempId === tempId);
    if (entry) {
      entry.entryId = entryId;
      this.immediateProcessingState.delete(tempId);
      this.notifySubscribers();
      console.log(`[ProcessingStateManager] Set entry ID for ${tempId} to ${entryId}`);
      
      // Immediately hide since we have a real entry ID
      this.hideEntry(tempId);
      this.removeEntry(tempId); // Remove immediately, no delays
    }
  }
  
  public removeEntry(tempId: string): void {
    const initialLength = this.processingEntries.length;
    this.processingEntries = this.processingEntries.filter(entry => entry.tempId !== tempId);
    
    if (initialLength !== this.processingEntries.length) {
      this.immediateProcessingState.delete(tempId);
      this.notifySubscribers();
      console.log(`[ProcessingStateManager] Removed entry ${tempId}. Remaining entries: ${this.processingEntries.length}`);
      
      // Clean up active call tracking
      this.activeStartProcessingCalls.delete(tempId);
    }
  }
  
  public getEntryById(tempId: string): ProcessingEntry | undefined {
    return this.processingEntries.find(entry => entry.tempId === tempId);
  }
  
  public isProcessing(tempId: string): boolean {
    const entry = this.processingEntries.find(entry => entry.tempId === tempId);
    return entry ? entry.state === EntryProcessingState.PROCESSING : false;
  }
  
  public isVisible(tempId: string): boolean {
    const entry = this.processingEntries.find(entry => entry.tempId === tempId);
    return entry ? entry.isVisible : false;
  }
  
  public hasError(tempId: string): boolean {
    const entry = this.processingEntries.find(entry => entry.tempId === tempId);
    return entry ? entry.state === EntryProcessingState.ERROR : false;
  }
  
  public getEntryId(tempId: string): number | undefined {
    const entry = this.processingEntries.find(entry => entry.tempId === tempId);
    return entry?.entryId;
  }
  
  public entriesChanges(): Observable<ProcessingEntry[]> {
    return this.entriesSubject.asObservable();
  }
  
  public getProcessingEntries(): ProcessingEntry[] {
    return [...this.processingEntries];
  }
  
  public getVisibleProcessingEntries(): ProcessingEntry[] {
    return this.processingEntries.filter(entry => entry.isVisible);
  }
  
  public retryProcessing(tempId: string): void {
    const entry = this.processingEntries.find(e => e.tempId === tempId);
    if (entry && entry.state === EntryProcessingState.ERROR) {
      entry.state = EntryProcessingState.PROCESSING;
      entry.errorMessage = undefined;
      entry.isVisible = true;
      this.immediateProcessingState.add(tempId);
      this.notifySubscribers();
      console.log(`[ProcessingStateManager] Retrying processing for ${tempId}`);
    }
  }
  
  public restoreFromLocalStorage(): void {
    try {
      const storedEntries = localStorage.getItem('processingEntries');
      if (storedEntries) {
        const parsed = JSON.parse(storedEntries);
        // Clean up old entries - reduced timeout from 30s to 10s
        const now = Date.now();
        this.processingEntries = parsed
          .filter((entry: ProcessingEntry) => now - entry.startTime < 10000)
          .map((entry: ProcessingEntry) => ({
            ...entry,
            isVisible: entry.isVisible !== undefined ? entry.isVisible : true
          }));
        this.notifySubscribers();
        console.log(`[ProcessingStateManager] Restored ${this.processingEntries.length} entries from localStorage`);
      }
    } catch (error) {
      console.error('[ProcessingStateManager] Error restoring from localStorage:', error);
      showSaveError();
    }
  }
  
  public saveToLocalStorage(): void {
    try {
      localStorage.setItem('processingEntries', JSON.stringify(this.processingEntries));
    } catch (error) {
      console.error('[ProcessingStateManager] Error saving to localStorage:', error);
      showSaveError();
    }
  }
  
  public dispose(): void {
    this.processingEntries = [];
    this.activeStartProcessingCalls.clear();
    this.immediateProcessingState.clear();
    this.processingIntentFlag = false;
    this.notifySubscribers();
    console.log('[ProcessingStateManager] Disposed state manager');
  }
  
  public clearAll(): void {
    this.processingEntries = [];
    this.activeStartProcessingCalls.clear();
    this.immediateProcessingState.clear();
    this.processingIntentFlag = false;
    this.notifySubscribers();
    console.log('[ProcessingStateManager] Cleared all processing entries');
    
    try {
      localStorage.removeItem('processingEntries');
    } catch (error) {
      console.error('[ProcessingStateManager] Error clearing localStorage:', error);
    }
  }
  
  private notifySubscribers(): void {
    console.log(`[ProcessingStateManager] Notifying subscribers with ${this.processingEntries.length} entries`);
    this.entriesSubject.next([...this.processingEntries]);
    this.saveToLocalStorage();
    
    // Also dispatch a general event for fallback listeners
    window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
      detail: { 
        entries: [...this.processingEntries], 
        timestamp: Date.now() 
      }
    }));
  }
  
  public handleError(tempId: string, errorMessage: string): void {
    const entry = this.processingEntries.find(e => e.tempId === tempId);
    if (entry) {
      entry.state = EntryProcessingState.ERROR;
      entry.errorMessage = errorMessage;
      entry.isVisible = true; // Make sure error is visible
      this.immediateProcessingState.delete(tempId);
      this.notifySubscribers();
      
      showGeneralError();
      console.log(`[ProcessingStateManager] Error for ${tempId}: ${errorMessage}`);
    }
  }
  
  // New method to force hide all processing entries (emergency cleanup)
  public forceHideAll(): void {
    this.processingEntries.forEach(entry => {
      entry.isVisible = false;
    });
    this.immediateProcessingState.clear();
    this.processingIntentFlag = false;
    this.notifySubscribers();
    console.log('[ProcessingStateManager] Force hid all processing entries');
  }
}

// Export a singleton instance
export const processingStateManager = new ProcessingStateManager();

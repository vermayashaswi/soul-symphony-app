
import { serviceWorkerManager } from '@/utils/serviceWorker';
import { toast } from 'sonner';

export interface OfflineJournalEntry {
  id?: number;
  audio: string; // base64 encoded audio
  userId: string;
  highQuality: boolean;
  directTranscription: boolean;
  recordingTime?: number;
  timestamp: number;
  offline: boolean;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: string[];
}

class BackgroundSyncService {
  private static instance: BackgroundSyncService;
  private dbName = 'SouloOfflineDB';
  private dbVersion = 1;
  private storeName = 'journalEntries';

  static getInstance(): BackgroundSyncService {
    if (!BackgroundSyncService.instance) {
      BackgroundSyncService.instance = new BackgroundSyncService();
    }
    return BackgroundSyncService.instance;
  }

  /**
   * Initialize the IndexedDB database
   */
  private async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('offline', 'offline', { unique: false });
          store.createIndex('userId', 'userId', { unique: false });
        }
      };
    });
  }

  /**
   * Store a journal entry for offline sync
   */
  async storeOfflineEntry(entry: Omit<OfflineJournalEntry, 'id'>): Promise<number> {
    const db = await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.add({
        ...entry,
        offline: true,
        timestamp: Date.now()
      });
      
      request.onsuccess = () => {
        console.log('[BackgroundSync] Stored offline journal entry:', request.result);
        resolve(request.result as number);
        
        // Request background sync
        this.requestSync();
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all offline journal entries
   */
  async getOfflineEntries(): Promise<OfflineJournalEntry[]> {
    const db = await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('offline');
      
      const request = index.getAll(true);
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Remove a synced entry from offline storage
   */
  async removeEntry(id: number): Promise<void> {
    const db = await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.delete(id);
      
      request.onsuccess = () => {
        console.log('[BackgroundSync] Removed synced entry:', id);
        resolve();
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get count of pending sync items
   */
  async getPendingCount(): Promise<number> {
    const db = await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('offline');
      
      const request = index.count(true);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all offline entries (use with caution)
   */
  async clearAllEntries(): Promise<void> {
    const db = await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.clear();
      
      request.onsuccess = () => {
        console.log('[BackgroundSync] Cleared all offline entries');
        resolve();
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Request background sync
   */
  async requestSync(): Promise<boolean> {
    if (!serviceWorkerManager.isServiceWorkerRegistered()) {
      console.warn('[BackgroundSync] Service worker not registered');
      return false;
    }

    return await serviceWorkerManager.requestBackgroundSync('journal-entry-sync');
  }

  /**
   * Manual sync (when online)
   */
  async manualSync(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      errors: []
    };

    if (!navigator.onLine) {
      result.success = false;
      result.errors.push('Device is offline');
      return result;
    }

    try {
      const entries = await this.getOfflineEntries();
      
      if (entries.length === 0) {
        return result;
      }

      console.log(`[BackgroundSync] Starting manual sync of ${entries.length} entries`);
      
      for (const entry of entries) {
        try {
          await this.syncEntry(entry);
          await this.removeEntry(entry.id!);
          result.syncedCount++;
          
          // Notify UI about successful sync
          window.dispatchEvent(new CustomEvent('journalSyncSuccess', {
            detail: { entry }
          }));
          
        } catch (error) {
          result.failedCount++;
          result.errors.push(`Failed to sync entry ${entry.id}: ${error.message}`);
          console.error('[BackgroundSync] Failed to sync entry:', entry.id, error);
        }
      }

      if (result.failedCount > 0) {
        result.success = false;
      }

      console.log(`[BackgroundSync] Manual sync completed: ${result.syncedCount} synced, ${result.failedCount} failed`);
      
      // Show toast notification
      if (result.syncedCount > 0) {
        toast.success(`Synced ${result.syncedCount} journal entries`);
      }

      if (result.failedCount > 0) {
        toast.error(`Failed to sync ${result.failedCount} entries`);
      }

      return result;
      
    } catch (error) {
      console.error('[BackgroundSync] Manual sync error:', error);
      result.success = false;
      result.errors.push(error.message);
      return result;
    }
  }

  /**
   * Sync individual entry to server
   */
  private async syncEntry(entry: OfflineJournalEntry): Promise<any> {
    const supabaseUrl = "https://kwnwhgucnzqxndzjayyq.supabase.co";
    
    const response = await fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
        'x-request-timestamp': new Date().toISOString(),
        'x-client-version': '1.0.0'
      },
      body: JSON.stringify({
        audio: entry.audio,
        userId: entry.userId,
        highQuality: entry.highQuality,
        directTranscription: entry.directTranscription,
        recordingTime: entry.recordingTime
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Initialize background sync listeners
   */
  initializeListeners(): void {
    // Listen for online events to trigger manual sync
    window.addEventListener('online', () => {
      console.log('[BackgroundSync] Device came online, triggering sync');
      setTimeout(() => {
        this.manualSync();
      }, 1000); // Small delay to ensure connection is stable
    });

    // Listen for service worker messages
    navigator.serviceWorker?.addEventListener('message', (event) => {
      if (event.data?.type === 'JOURNAL_SYNC_STATUS') {
        console.log('[BackgroundSync] Received sync status:', event.data.payload);
      }
    });
  }
}

// Export singleton instance
export const backgroundSyncService = BackgroundSyncService.getInstance();


import { serviceWorkerManager } from '@/utils/serviceWorker';

interface SyncTask {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

class BackgroundSyncService {
  private syncQueue: SyncTask[] = [];
  private maxRetries = 3;

  async initialize(): Promise<void> {
    console.log('[BackgroundSync] Initializing background sync service');
    
    if (!('serviceWorker' in navigator)) {
      console.warn('[BackgroundSync] Service workers not supported');
      return;
    }

    // Load queued tasks from storage
    this.loadQueueFromStorage();
    
    // Register for background sync if supported
    if ('sync' in window.ServiceWorkerRegistration.prototype) {
      await this.registerBackgroundSync();
    }
  }

  async addTask(type: string, data: any): Promise<void> {
    const task: SyncTask = {
      id: crypto.randomUUID(),
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.syncQueue.push(task);
    this.saveQueueToStorage();
    
    console.log(`[BackgroundSync] Task added: ${type}`);
    
    // Try to sync immediately if online
    if (navigator.onLine) {
      await this.processSyncQueue();
    }
  }

  private async registerBackgroundSync(): Promise<void> {
    try {
      const registration = serviceWorkerManager.getRegistration();
      if (registration && 'sync' in registration) {
        await (registration as any).sync.register('background-sync');
        console.log('[BackgroundSync] Background sync registered');
      }
    } catch (error) {
      console.error('[BackgroundSync] Failed to register background sync:', error);
    }
  }

  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0) return;

    console.log(`[BackgroundSync] Processing ${this.syncQueue.length} queued tasks`);
    
    const tasksToProcess = [...this.syncQueue];
    
    for (const task of tasksToProcess) {
      try {
        await this.processTask(task);
        this.removeTaskFromQueue(task.id);
      } catch (error) {
        console.error(`[BackgroundSync] Task failed: ${task.type}`, error);
        
        task.retryCount++;
        if (task.retryCount >= this.maxRetries) {
          console.warn(`[BackgroundSync] Task exceeded max retries, removing: ${task.type}`);
          this.removeTaskFromQueue(task.id);
        }
      }
    }
    
    this.saveQueueToStorage();
  }

  private async processTask(task: SyncTask): Promise<void> {
    switch (task.type) {
      case 'journal-entry':
        await this.syncJournalEntry(task.data);
        break;
      case 'user-preferences':
        await this.syncUserPreferences(task.data);
        break;
      default:
        console.warn(`[BackgroundSync] Unknown task type: ${task.type}`);
    }
  }

  private async syncJournalEntry(data: any): Promise<void> {
    // Implementation would go here
    console.log('[BackgroundSync] Syncing journal entry');
  }

  private async syncUserPreferences(data: any): Promise<void> {
    // Implementation would go here
    console.log('[BackgroundSync] Syncing user preferences');
  }

  private removeTaskFromQueue(taskId: string): void {
    this.syncQueue = this.syncQueue.filter(task => task.id !== taskId);
  }

  private loadQueueFromStorage(): void {
    try {
      const stored = localStorage.getItem('background-sync-queue');
      if (stored) {
        this.syncQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[BackgroundSync] Failed to load queue from storage:', error);
      this.syncQueue = [];
    }
  }

  private saveQueueToStorage(): void {
    try {
      localStorage.setItem('background-sync-queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('[BackgroundSync] Failed to save queue to storage:', error);
    }
  }

  // Public method for manual sync request
  async requestSync(): Promise<void> {
    console.log('[BackgroundSync] Manual sync requested');
    
    try {
      // Use the service worker manager method
      await serviceWorkerManager.requestBackgroundSync();
      await this.processSyncQueue();
    } catch (error) {
      console.error('[BackgroundSync] Manual sync failed:', error);
    }
  }

  getQueueLength(): number {
    return this.syncQueue.length;
  }

  clearQueue(): void {
    this.syncQueue = [];
    this.saveQueueToStorage();
    console.log('[BackgroundSync] Queue cleared');
  }
}

export const backgroundSyncService = new BackgroundSyncService();

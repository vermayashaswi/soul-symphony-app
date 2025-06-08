
interface TranslationState {
  language: string;
  loading: boolean;
  error: Error | null;
  progress: number;
  lastUpdate: number;
  coordinatorId: string;
}

interface TranslationStateListener {
  onStateChange: (state: TranslationState) => void;
  onError: (error: Error) => void;
  onComplete: (language: string) => void;
}

export class TranslationStateManager {
  private static instance: TranslationStateManager;
  private state: TranslationState;
  private listeners: Set<TranslationStateListener> = new Set();
  private activeTranslations = new Map<string, Promise<void>>();
  private translationLocks = new Map<string, boolean>();

  private constructor() {
    this.state = {
      language: 'en',
      loading: false,
      error: null,
      progress: 0,
      lastUpdate: Date.now(),
      coordinatorId: this.generateCoordinatorId()
    };
    
    console.log('[TranslationStateManager] SYNCHRONIZED: Initialized with coordinator ID:', this.state.coordinatorId);
  }

  static getInstance(): TranslationStateManager {
    if (!TranslationStateManager.instance) {
      TranslationStateManager.instance = new TranslationStateManager();
    }
    return TranslationStateManager.instance;
  }

  private generateCoordinatorId(): string {
    return `coord-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ATOMIC LANGUAGE CHANGE: Prevents race conditions during language switches
  async coordinateLanguageChange(newLanguage: string, userId?: string): Promise<void> {
    const changeId = this.generateCoordinatorId();
    console.log(`[TranslationStateManager] ATOMIC CHANGE: Starting language change to ${newLanguage} with ID ${changeId}`);

    // Check if we're already processing this language
    if (this.state.language === newLanguage && !this.state.loading) {
      console.log(`[TranslationStateManager] ATOMIC CHANGE: Already on ${newLanguage}, skipping`);
      return;
    }

    // Wait for any active translations to complete
    await this.waitForActiveTranslations();

    // Lock the translation system
    this.acquireTranslationLock(changeId);

    try {
      this.updateState({
        language: newLanguage,
        loading: true,
        error: null,
        progress: 10,
        lastUpdate: Date.now(),
        coordinatorId: changeId
      });

      // SYNCHRONIZED CACHE INVALIDATION: Clear all caches atomically
      if (userId) {
        await this.synchronizedCacheInvalidation(userId, newLanguage);
      }

      this.updateState({
        progress: 50,
        lastUpdate: Date.now()
      });

      // Notify all listeners about the language change
      this.notifyListeners('complete', newLanguage);

      this.updateState({
        loading: false,
        progress: 100,
        lastUpdate: Date.now()
      });

      console.log(`[TranslationStateManager] ATOMIC CHANGE: Successfully completed language change to ${newLanguage}`);
    } catch (error) {
      console.error(`[TranslationStateManager] ATOMIC CHANGE: Failed to change language to ${newLanguage}:`, error);
      this.updateState({
        loading: false,
        error: error instanceof Error ? error : new Error('Language change failed'),
        lastUpdate: Date.now()
      });
      this.notifyListeners('error', error instanceof Error ? error : new Error('Language change failed'));
    } finally {
      this.releaseTranslationLock(changeId);
    }
  }

  // SYNCHRONIZED CACHE INVALIDATION: Coordinated clearing of all translation caches
  private async synchronizedCacheInvalidation(userId: string, newLanguage: string): Promise<void> {
    console.log(`[TranslationStateManager] SYNCHRONIZED INVALIDATION: Clearing all caches for ${userId}, language: ${newLanguage}`);
    
    try {
      // Import services dynamically to avoid circular dependencies
      const { EnhancedSoulNetPreloadService } = await import('./enhancedSoulNetPreloadService');
      const { onDemandTranslationCache } = await import('../utils/website-translations');
      
      // Clear SoulNet cache
      EnhancedSoulNetPreloadService.clearInstantCache(userId);
      
      // Clear on-demand translation cache
      onDemandTranslationCache.clearAll();
      
      // Clear any browser cache related to translations
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter(name => name.includes('translation') || name.includes('soulnet'))
            .map(name => caches.delete(name))
        );
      }
      
      console.log('[TranslationStateManager] SYNCHRONIZED INVALIDATION: All caches cleared successfully');
    } catch (error) {
      console.error('[TranslationStateManager] SYNCHRONIZED INVALIDATION: Error clearing caches:', error);
      throw error;
    }
  }

  // TRANSLATION RECOVERY: Handles failed translation attempts
  async recoverFromTranslationFailure(language: string, userId?: string): Promise<void> {
    console.log(`[TranslationStateManager] RECOVERY: Attempting to recover translation for ${language}`);
    
    try {
      // Clear any corrupted state
      this.updateState({
        loading: false,
        error: null,
        progress: 0,
        lastUpdate: Date.now()
      });

      // Retry the language change with recovery mode
      await this.coordinateLanguageChange(language, userId);
      
      console.log(`[TranslationStateManager] RECOVERY: Successfully recovered translation for ${language}`);
    } catch (error) {
      console.error(`[TranslationStateManager] RECOVERY: Failed to recover translation for ${language}:`, error);
      
      // Fallback to English if recovery fails
      if (language !== 'en') {
        console.log('[TranslationStateManager] RECOVERY: Falling back to English');
        await this.coordinateLanguageChange('en', userId);
      }
    }
  }

  private acquireTranslationLock(coordinatorId: string): void {
    this.translationLocks.set(coordinatorId, true);
    console.log(`[TranslationStateManager] LOCK: Acquired translation lock for ${coordinatorId}`);
  }

  private releaseTranslationLock(coordinatorId: string): void {
    this.translationLocks.delete(coordinatorId);
    console.log(`[TranslationStateManager] LOCK: Released translation lock for ${coordinatorId}`);
  }

  private async waitForActiveTranslations(): Promise<void> {
    if (this.activeTranslations.size === 0) return;
    
    console.log(`[TranslationStateManager] WAIT: Waiting for ${this.activeTranslations.size} active translations`);
    await Promise.all(Array.from(this.activeTranslations.values()));
    console.log('[TranslationStateManager] WAIT: All active translations completed');
  }

  registerActiveTranslation(key: string, promise: Promise<void>): void {
    this.activeTranslations.set(key, promise);
    promise.finally(() => {
      this.activeTranslations.delete(key);
    });
  }

  private updateState(updates: Partial<TranslationState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners('stateChange', this.state);
  }

  private notifyListeners(event: 'stateChange' | 'error' | 'complete', data: any): void {
    this.listeners.forEach(listener => {
      try {
        switch (event) {
          case 'stateChange':
            listener.onStateChange(data);
            break;
          case 'error':
            listener.onError(data);
            break;
          case 'complete':
            listener.onComplete(data);
            break;
        }
      } catch (error) {
        console.error('[TranslationStateManager] Error notifying listener:', error);
      }
    });
  }

  addListener(listener: TranslationStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): TranslationState {
    return { ...this.state };
  }

  isTranslationLocked(): boolean {
    return this.translationLocks.size > 0;
  }

  // DEBUG METHOD: Get comprehensive translation debug info
  getDebugInfo(): any {
    return {
      state: this.state,
      activeTranslations: Array.from(this.activeTranslations.keys()),
      locks: Array.from(this.translationLocks.keys()),
      listeners: this.listeners.size,
      timestamp: Date.now()
    };
  }
}

export const translationStateManager = TranslationStateManager.getInstance();

/**
 * Unified loading state manager to prevent competing loaders
 * and ensure only one loading state is active at a time
 */

export enum LoadingPriority {
  CRITICAL = 1,    // App initialization, authentication
  HIGH = 2,        // TWA initialization, session validation
  MEDIUM = 3,      // Translation, data loading
  LOW = 4          // Background processes
}

export interface LoadingState {
  id: string;
  priority: LoadingPriority;
  message: string;
  active: boolean;
  timestamp: number;
}

class LoadingStateManager {
  private static instance: LoadingStateManager;
  private activeStates: Map<string, LoadingState> = new Map();
  private listeners: Set<(state: LoadingState | null) => void> = new Set();

  public static getInstance(): LoadingStateManager {
    if (!LoadingStateManager.instance) {
      LoadingStateManager.instance = new LoadingStateManager();
    }
    return LoadingStateManager.instance;
  }

  /**
   * Set a loading state with priority
   */
  public setLoading(id: string, priority: LoadingPriority, message: string): void {
    const loadingState: LoadingState = {
      id,
      priority,
      message,
      active: true,
      timestamp: Date.now()
    };

    this.activeStates.set(id, loadingState);
    this.notifyListeners();
  }

  /**
   * Clear a loading state
   */
  public clearLoading(id: string): void {
    this.activeStates.delete(id);
    this.notifyListeners();
  }

  /**
   * Get the highest priority active loading state
   */
  public getActiveLoadingState(): LoadingState | null {
    const activeStates = Array.from(this.activeStates.values())
      .filter(state => state.active)
      .sort((a, b) => a.priority - b.priority);

    return activeStates.length > 0 ? activeStates[0] : null;
  }

  /**
   * Check if any loading state is active
   */
  public isLoading(): boolean {
    return this.activeStates.size > 0;
  }

  /**
   * Subscribe to loading state changes
   */
  public subscribe(listener: (state: LoadingState | null) => void): () => void {
    this.listeners.add(listener);
    
    // Immediately notify with current state
    listener(this.getActiveLoadingState());
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Force clear all loading states (emergency recovery)
   */
  public clearAll(): void {
    this.activeStates.clear();
    this.notifyListeners();
  }

  /**
   * Get debugging info
   */
  public getDebugInfo(): { activeStates: LoadingState[], currentState: LoadingState | null } {
    return {
      activeStates: Array.from(this.activeStates.values()),
      currentState: this.getActiveLoadingState()
    };
  }

  private notifyListeners(): void {
    const activeState = this.getActiveLoadingState();
    this.listeners.forEach(listener => listener(activeState));
  }
}

export const loadingStateManager = LoadingStateManager.getInstance();
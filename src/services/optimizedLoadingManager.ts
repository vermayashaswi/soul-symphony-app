/**
 * Optimized Loading Manager
 * Prevents infinite loading states and manages app initialization efficiently
 */

export interface LoadingState {
  auth: boolean;
  profile: boolean;
  subscription: boolean;
  journal: boolean;
  routing: boolean;
}

export interface LoadingTimeouts {
  auth: number;
  profile: number;
  subscription: number;
  journal: number;
  routing: number;
}

class OptimizedLoadingManager {
  private loadingStates: LoadingState = {
    auth: true,
    profile: true,
    subscription: true,
    journal: true,
    routing: true
  };

  private timeouts: Map<keyof LoadingState, NodeJS.Timeout> = new Map();
  private listeners: Map<string, (state: LoadingState) => void> = new Map();

  // Maximum loading times before forcing completion (in milliseconds)
  private readonly MAX_LOADING_TIMES: LoadingTimeouts = {
    auth: 10000,      // 10 seconds max for auth
    profile: 8000,    // 8 seconds max for profile
    subscription: 6000, // 6 seconds max for subscription
    journal: 5000,    // 5 seconds max for journal loading
    routing: 3000     // 3 seconds max for routing
  };

  constructor() {
    this.setupLoadingTimeouts();
  }

  /**
   * Set up automatic timeout for each loading state
   */
  private setupLoadingTimeouts(): void {
    Object.keys(this.MAX_LOADING_TIMES).forEach(key => {
      const loadingKey = key as keyof LoadingState;
      const timeout = setTimeout(() => {
        console.warn(`[LoadingManager] Force completing ${loadingKey} loading after timeout`);
        this.setLoadingComplete(loadingKey, true);
      }, this.MAX_LOADING_TIMES[loadingKey]);
      
      this.timeouts.set(loadingKey, timeout);
    });
  }

  /**
   * Set loading state for a specific component
   */
  setLoading(component: keyof LoadingState, isLoading: boolean): void {
    const wasLoading = this.loadingStates[component];
    this.loadingStates[component] = isLoading;

    // Clear timeout if loading is complete
    if (!isLoading && wasLoading) {
      const timeout = this.timeouts.get(component);
      if (timeout) {
        clearTimeout(timeout);
        this.timeouts.delete(component);
      }
    }

    console.log(`[LoadingManager] ${component} loading: ${isLoading}`);
    this.notifyListeners();
  }

  /**
   * Force complete loading for a component
   */
  setLoadingComplete(component: keyof LoadingState, forced: boolean = false): void {
    if (forced) {
      console.warn(`[LoadingManager] Force completing ${component} loading`);
    }
    this.setLoading(component, false);
  }

  /**
   * Get current loading state
   */
  getLoadingState(): LoadingState {
    return { ...this.loadingStates };
  }

  /**
   * Check if any critical components are still loading
   */
  isCriticallyLoading(): boolean {
    return this.loadingStates.auth || this.loadingStates.routing;
  }

  /**
   * Check if app is ready for navigation
   */
  isAppReady(): boolean {
    return !this.loadingStates.auth && !this.loadingStates.routing;
  }

  /**
   * Check if all components are loaded
   */
  isFullyLoaded(): boolean {
    return Object.values(this.loadingStates).every(state => !state);
  }

  /**
   * Get loading progress percentage
   */
  getLoadingProgress(): number {
    const totalComponents = Object.keys(this.loadingStates).length;
    const loadedComponents = Object.values(this.loadingStates).filter(state => !state).length;
    return Math.round((loadedComponents / totalComponents) * 100);
  }

  /**
   * Subscribe to loading state changes
   */
  subscribe(id: string, callback: (state: LoadingState) => void): void {
    this.listeners.set(id, callback);
    // Immediately call with current state
    callback(this.getLoadingState());
  }

  /**
   * Unsubscribe from loading state changes
   */
  unsubscribe(id: string): void {
    this.listeners.delete(id);
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyListeners(): void {
    const currentState = this.getLoadingState();
    this.listeners.forEach(callback => callback(currentState));
  }

  /**
   * Reset all loading states (useful for re-authentication)
   */
  reset(): void {
    console.log('[LoadingManager] Resetting all loading states');
    
    // Clear existing timeouts
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();

    // Reset states
    this.loadingStates = {
      auth: true,
      profile: true,
      subscription: true,
      journal: true,
      routing: true
    };

    // Setup new timeouts
    this.setupLoadingTimeouts();
    this.notifyListeners();
  }

  /**
   * Set multiple loading states at once
   */
  setBatchLoading(states: Partial<LoadingState>): void {
    Object.keys(states).forEach(key => {
      const loadingKey = key as keyof LoadingState;
      if (states[loadingKey] !== undefined) {
        this.loadingStates[loadingKey] = states[loadingKey]!;
      }
    });
    this.notifyListeners();
  }

  /**
   * Emergency stop all loading (last resort for infinite loading)
   */
  emergencyStop(): void {
    console.warn('[LoadingManager] EMERGENCY STOP - Force completing all loading states');
    
    // Clear all timeouts
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();

    // Set all to not loading
    Object.keys(this.loadingStates).forEach(key => {
      this.loadingStates[key as keyof LoadingState] = false;
    });

    this.notifyListeners();
  }

  /**
   * Cleanup when manager is no longer needed
   */
  destroy(): void {
    // Clear all timeouts
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();
    
    // Clear listeners
    this.listeners.clear();
    
    console.log('[LoadingManager] Destroyed');
  }
}

// Export singleton instance
export const optimizedLoadingManager = new OptimizedLoadingManager();
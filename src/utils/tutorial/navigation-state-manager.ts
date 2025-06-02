
// Navigation state manager to prevent app freezing during tutorial transitions

interface NavigationState {
  isNavigating: boolean;
  targetRoute: string | null;
  currentStep: number;
  timeoutId: number | null;
  transitionProtection: boolean;
  transitionTimeoutId: number | null; // NEW: Separate timeout for transition protection
}

class NavigationStateManager {
  private state: NavigationState = {
    isNavigating: false,
    targetRoute: null,
    currentStep: 0,
    timeoutId: null,
    transitionProtection: false,
    transitionTimeoutId: null
  };

  private listeners: ((state: NavigationState) => void)[] = [];

  // Start navigation with timeout protection
  startNavigation(targetRoute: string, currentStep: number) {
    console.log(`[NavigationManager] Starting navigation to ${targetRoute} for step ${currentStep}`);
    
    // Clear any existing timeouts
    if (this.state.timeoutId) {
      clearTimeout(this.state.timeoutId);
    }
    if (this.state.transitionTimeoutId) {
      clearTimeout(this.state.transitionTimeoutId);
    }
    
    this.state = {
      ...this.state,
      isNavigating: true,
      targetRoute,
      currentStep,
      transitionProtection: false,
      timeoutId: window.setTimeout(() => {
        console.warn('[NavigationManager] Navigation timeout - forcing completion');
        this.completeNavigation();
      }, 5000), // 5 second timeout to prevent hanging
      transitionTimeoutId: null
    };
    
    this.notifyListeners();
  }

  // ENHANCED: Start step transition protection with longer duration
  startStepTransition(stepId: number) {
    console.log(`[NavigationManager] Starting step transition protection for step ${stepId}`);
    
    // Clear existing transition timeout
    if (this.state.transitionTimeoutId) {
      clearTimeout(this.state.transitionTimeoutId);
    }
    
    this.state.transitionProtection = true;
    this.state.currentStep = stepId;
    this.notifyListeners();
    
    // INCREASED: Auto-clear transition protection after 3 seconds instead of 1 second
    this.state.transitionTimeoutId = window.setTimeout(() => {
      if (this.state.transitionProtection) {
        console.log('[NavigationManager] Auto-clearing step transition protection after 3 seconds');
        this.clearStepTransition();
      }
    }, 3000);
  }

  // Clear step transition protection
  clearStepTransition() {
    console.log('[NavigationManager] Clearing step transition protection');
    
    if (this.state.transitionTimeoutId) {
      clearTimeout(this.state.transitionTimeoutId);
      this.state.transitionTimeoutId = null;
    }
    
    this.state.transitionProtection = false;
    this.notifyListeners();
  }

  // Complete navigation and reset state
  completeNavigation() {
    console.log('[NavigationManager] Completing navigation');
    
    if (this.state.timeoutId) {
      clearTimeout(this.state.timeoutId);
    }
    
    this.state = {
      isNavigating: false,
      targetRoute: null,
      currentStep: 0,
      timeoutId: null,
      transitionProtection: false,
      transitionTimeoutId: null
    };
    
    this.notifyListeners();
  }

  // Check if navigation is in progress
  isNavigating(): boolean {
    return this.state.isNavigating;
  }

  // Check if step transition is protected
  isStepTransitionProtected(): boolean {
    return this.state.transitionProtection;
  }

  // Get current navigation state
  getState(): Readonly<NavigationState> {
    return { ...this.state };
  }

  // Subscribe to navigation state changes
  subscribe(listener: (state: NavigationState) => void) {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Notify all listeners of state changes
  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.getState());
      } catch (error) {
        console.error('[NavigationManager] Error notifying listener:', error);
      }
    });
  }

  // Force reset - emergency function
  forceReset() {
    console.warn('[NavigationManager] Force resetting navigation state');
    
    if (this.state.timeoutId) {
      clearTimeout(this.state.timeoutId);
    }
    if (this.state.transitionTimeoutId) {
      clearTimeout(this.state.transitionTimeoutId);
    }
    
    this.state = {
      isNavigating: false,
      targetRoute: null,
      currentStep: 0,
      timeoutId: null,
      transitionProtection: false,
      transitionTimeoutId: null
    };
    
    this.notifyListeners();
  }
}

// Export singleton instance
export const navigationManager = new NavigationStateManager();


// Navigation state manager to prevent app freezing during tutorial transitions

interface NavigationState {
  isNavigating: boolean;
  targetRoute: string | null;
  currentStep: number;
  timeoutId: number | null;
  transitionProtection: boolean; // NEW: Protect during step transitions
}

class NavigationStateManager {
  private state: NavigationState = {
    isNavigating: false,
    targetRoute: null,
    currentStep: 0,
    timeoutId: null,
    transitionProtection: false
  };

  private listeners: ((state: NavigationState) => void)[] = [];

  // Start navigation with timeout protection
  startNavigation(targetRoute: string, currentStep: number) {
    console.log(`[NavigationManager] Starting navigation to ${targetRoute} for step ${currentStep}`);
    
    // Clear any existing timeout
    if (this.state.timeoutId) {
      clearTimeout(this.state.timeoutId);
    }
    
    this.state = {
      isNavigating: true,
      targetRoute,
      currentStep,
      transitionProtection: false,
      timeoutId: window.setTimeout(() => {
        console.warn('[NavigationManager] Navigation timeout - forcing completion');
        this.completeNavigation();
      }, 5000) // 5 second timeout to prevent hanging
    };
    
    this.notifyListeners();
  }

  // NEW: Start step transition protection
  startStepTransition(stepId: number) {
    console.log(`[NavigationManager] Starting step transition protection for step ${stepId}`);
    this.state.transitionProtection = true;
    this.state.currentStep = stepId;
    this.notifyListeners();
    
    // Auto-clear transition protection after a short delay
    setTimeout(() => {
      if (this.state.transitionProtection) {
        console.log('[NavigationManager] Auto-clearing step transition protection');
        this.clearStepTransition();
      }
    }, 1000);
  }

  // NEW: Clear step transition protection
  clearStepTransition() {
    console.log('[NavigationManager] Clearing step transition protection');
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
      transitionProtection: false
    };
    
    this.notifyListeners();
  }

  // Check if navigation is in progress
  isNavigating(): boolean {
    return this.state.isNavigating;
  }

  // NEW: Check if step transition is protected
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
    
    this.state = {
      isNavigating: false,
      targetRoute: null,
      currentStep: 0,
      timeoutId: null,
      transitionProtection: false
    };
    
    this.notifyListeners();
  }
}

// Export singleton instance
export const navigationManager = new NavigationStateManager();

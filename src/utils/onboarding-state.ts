/**
 * Onboarding State Manager
 * Helps coordinate service initialization only after onboarding is complete
 */

export interface OnboardingState {
  isComplete: boolean;
  checkedAt: number;
}

class OnboardingStateManager {
  private static instance: OnboardingStateManager;
  private state: OnboardingState = {
    isComplete: false,
    checkedAt: 0
  };

  static getInstance(): OnboardingStateManager {
    if (!OnboardingStateManager.instance) {
      OnboardingStateManager.instance = new OnboardingStateManager();
    }
    return OnboardingStateManager.instance;
  }

  /**
   * Check if onboarding/authentication flow is complete
   */
  isOnboardingComplete(): boolean {
    // If we haven't checked recently, return false as a safety measure
    const now = Date.now();
    if (now - this.state.checkedAt > 30000) { // 30 seconds cache
      return false;
    }
    
    return this.state.isComplete;
  }

  /**
   * Mark onboarding as complete
   */
  setOnboardingComplete(complete: boolean): void {
    console.log('[OnboardingState] Setting onboarding complete:', complete);
    this.state.isComplete = complete;
    this.state.checkedAt = Date.now();
  }

  /**
   * Check current user authentication and onboarding state
   */
  async checkOnboardingState(user: any): Promise<boolean> {
    if (!user) {
      this.setOnboardingComplete(false);
      return false;
    }

    // If user is authenticated and we're not on auth/onboarding routes, consider it complete
    const currentPath = window.location.pathname;
    const isOnAuthPage = currentPath.includes('/auth') || currentPath.includes('/onboarding') || currentPath === '/';
    
    const isComplete = !isOnAuthPage;
    this.setOnboardingComplete(isComplete);
    
    console.log('[OnboardingState] Checked onboarding state:', {
      hasUser: !!user,
      currentPath,
      isOnAuthPage,
      isComplete
    });

    return isComplete;
  }

  /**
   * Reset onboarding state
   */
  reset(): void {
    this.state = {
      isComplete: false,
      checkedAt: 0
    };
  }
}

export const onboardingStateManager = OnboardingStateManager.getInstance();
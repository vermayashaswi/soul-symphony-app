import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { nativeAppInitService } from './nativeAppInitService';
import { nativeNavigationService } from './nativeNavigationService';

interface UserProfile {
  id: string;
  email?: string;
  onboarding_completed?: boolean;
  is_premium?: boolean;
  subscription_status?: string;
}

interface AppState {
  isInitialized: boolean;
  isInitializing: boolean;
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  error: string | null;
}

class AppStateManager {
  private static instance: AppStateManager;
  private state: AppState = {
    isInitialized: false,
    isInitializing: false,
    user: null,
    session: null,
    userProfile: null,
    error: null
  };
  
  private listeners: Set<(state: AppState) => void> = new Set();
  private initializationPromise: Promise<void> | null = null;

  static getInstance(): AppStateManager {
    if (!AppStateManager.instance) {
      AppStateManager.instance = new AppStateManager();
    }
    return AppStateManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.state.isInitialized) return;
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    console.log('[AppState] Starting app initialization...');
    
    this.updateState({ 
      isInitializing: true,
      error: null
    });

    try {
      // Phase 1: Initialize native services
      await nativeAppInitService.initialize();
      
      // Phase 2: Get current session synchronously from localStorage first
      const storedSession = this.getStoredSession();
      if (storedSession) {
        console.log('[AppState] Found stored session, using immediately');
        this.updateState({
          session: storedSession,
          user: storedSession.user
        });
      }

      // Phase 3: Setup auth listener (but don't wait for it)
      this.setupAuthListener();
      
      // Phase 4: Verify session with Supabase (async, non-blocking)
      this.verifySessionAsync();
      
      // Phase 5: Initialize non-critical services (async, non-blocking)
      this.initializeNonCriticalServices();
      
      // Mark as initialized
      this.updateState({ 
        isInitialized: true,
        isInitializing: false
      });
      
      console.log('[AppState] App initialization completed');
      
    } catch (error) {
      console.error('[AppState] Initialization failed:', error);
      this.updateState({
        isInitialized: true, // Still mark as initialized to prevent blocking
        isInitializing: false,
        error: error instanceof Error ? error.message : 'Initialization failed'
      });
    }
  }

  private async initializeNonCriticalServices(): Promise<void> {
    try {
      // Initialize journal reminder service after app is ready
      const { journalReminderService } = await import('@/services/journalReminderService');
      setTimeout(() => {
        journalReminderService.initializeOnAppStart().catch(error => {
          console.warn('[AppState] Journal reminder service initialization failed (non-fatal):', error);
        });
      }, 1000);
    } catch (error) {
      console.warn('[AppState] Non-critical service initialization failed:', error);
    }
  }

  private getStoredSession(): Session | null {
    try {
      const stored = localStorage.getItem('sb-kwnwhgucnzqxndzjayyq-auth-token');
      if (!stored) return null;
      
      const sessionData = JSON.parse(stored);
      const now = Date.now() / 1000;
      
      if (sessionData?.access_token && sessionData?.expires_at && sessionData.expires_at > now) {
        return sessionData as Session;
      }
    } catch (error) {
      console.warn('[AppState] Failed to parse stored session:', error);
    }
    return null;
  }

  private setupAuthListener(): void {
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AppState] Auth state changed:', event);
      
      this.updateState({
        session,
        user: session?.user ?? null
      });

      // Load user profile if we have a user but no profile
      if (session?.user && !this.state.userProfile) {
        setTimeout(() => this.loadUserProfile(session.user.id), 0);
      }

      // Handle navigation for auth events
      if (event === 'SIGNED_IN' && session) {
        setTimeout(() => this.handleSuccessfulAuth(session), 100);
      } else if (event === 'SIGNED_OUT') {
        this.updateState({ userProfile: null });
      }
    });
  }

  private async verifySessionAsync(): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Only update if we don't already have a session or if it's different
      if (!this.state.session || session?.access_token !== this.state.session?.access_token) {
        this.updateState({
          session,
          user: session?.user ?? null
        });
      }
    } catch (error) {
      console.warn('[AppState] Session verification failed:', error);
    }
  }

  private async loadUserProfile(userId: string): Promise<void> {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      this.updateState({ userProfile: profile });
    } catch (error) {
      console.warn('[AppState] Failed to load user profile:', error);
    }
  }

  private handleSuccessfulAuth(session: Session): void {
    const currentPath = window.location.pathname;
    
    // Don't redirect if already in app or on auth page
    if (currentPath.startsWith('/app') || currentPath === '/auth') {
      return;
    }
    
    // Check if user needs onboarding
    if (!this.state.userProfile?.onboarding_completed) {
      nativeNavigationService.navigateToOnboarding();
    } else {
      nativeNavigationService.navigateToAuthenticatedHome();
    }
  }

  private updateState(updates: Partial<AppState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener({ ...this.state });
      } catch (error) {
        console.error('[AppState] Listener error:', error);
      }
    });
  }

  // Public API
  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener);
    
    // Immediately notify with current state
    listener({ ...this.state });
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): AppState {
    return { ...this.state };
  }

  isAuthenticated(): boolean {
    return !!this.state.session && !!this.state.user;
  }

  requiresOnboarding(): boolean {
    return this.isAuthenticated() && !this.state.userProfile?.onboarding_completed;
  }

  isPremium(): boolean {
    return this.state.userProfile?.is_premium === true;
  }

  async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut();
      this.updateState({
        session: null,
        user: null,
        userProfile: null
      });
      nativeNavigationService.navigateToAuth();
    } catch (error) {
      console.error('[AppState] Sign out failed:', error);
      throw error;
    }
  }

  async refreshProfile(): Promise<void> {
    if (this.state.user?.id) {
      await this.loadUserProfile(this.state.user.id);
    }
  }
}

export const appStateManager = AppStateManager.getInstance();
export type { AppState, UserProfile };
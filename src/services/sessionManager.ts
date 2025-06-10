
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { logInfo, logError, logAuth } from '@/components/debug/DebugPanel';

export interface SessionState {
  session: Session | null;
  user: User | null;
  isExpired: boolean;
  lastRefresh: number;
}

class SessionManager {
  private static instance: SessionManager;
  private sessionCheckInterval: NodeJS.Timeout | null = null;
  private readonly SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly SESSION_REFRESH_THRESHOLD = 10 * 60 * 1000; // 10 minutes before expiry
  private isRefreshing = false;
  private refreshPromise: Promise<Session | null> | null = null;

  private constructor() {}

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Start monitoring session status
   */
  startSessionMonitoring(): void {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
    }

    this.sessionCheckInterval = setInterval(async () => {
      await this.checkAndRefreshSession();
    }, this.SESSION_CHECK_INTERVAL);

    logInfo('Session monitoring started', 'SessionManager');
  }

  /**
   * Stop monitoring session status
   */
  stopSessionMonitoring(): void {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
    logInfo('Session monitoring stopped', 'SessionManager');
  }

  /**
   * Check if session needs refresh and refresh if necessary
   */
  async checkAndRefreshSession(): Promise<Session | null> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        logError(`Session check error: ${error.message}`, 'SessionManager', error);
        return null;
      }

      if (!session) {
        logInfo('No active session found', 'SessionManager');
        return null;
      }

      // Check if session is close to expiry
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      if (timeUntilExpiry <= this.SESSION_REFRESH_THRESHOLD) {
        logInfo(`Session expires in ${Math.round(timeUntilExpiry / 1000 / 60)} minutes, refreshing...`, 'SessionManager');
        return await this.refreshSession();
      }

      return session;
    } catch (error: any) {
      logError(`Error checking session: ${error.message}`, 'SessionManager', error);
      return null;
    }
  }

  /**
   * Refresh the current session with deduplication
   */
  async refreshSession(): Promise<Session | null> {
    // Prevent multiple simultaneous refresh attempts
    if (this.isRefreshing && this.refreshPromise) {
      logInfo('Session refresh already in progress, waiting...', 'SessionManager');
      return await this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performSessionRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual session refresh
   */
  private async performSessionRefresh(): Promise<Session | null> {
    try {
      logInfo('Attempting to refresh session...', 'SessionManager');
      
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        logError(`Session refresh failed: ${error.message}`, 'SessionManager', error);
        return null;
      }

      if (data.session) {
        logAuth('Session refreshed successfully', 'SessionManager', {
          userId: data.session.user?.id,
          expiresAt: new Date(data.session.expires_at! * 1000).toISOString()
        });
        return data.session;
      }

      logError('Session refresh returned no session', 'SessionManager');
      return null;
    } catch (error: any) {
      logError(`Session refresh error: ${error.message}`, 'SessionManager', error);
      return null;
    }
  }

  /**
   * Get current session state with expiry check
   */
  async getSessionState(): Promise<SessionState> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        logError(`Error getting session state: ${error.message}`, 'SessionManager', error);
        return { session: null, user: null, isExpired: true, lastRefresh: Date.now() };
      }

      const isExpired = session ? this.isSessionExpired(session) : true;
      
      return {
        session,
        user: session?.user ?? null,
        isExpired,
        lastRefresh: Date.now()
      };
    } catch (error: any) {
      logError(`Exception getting session state: ${error.message}`, 'SessionManager', error);
      return { session: null, user: null, isExpired: true, lastRefresh: Date.now() };
    }
  }

  /**
   * Check if a session is expired or close to expiry
   */
  private isSessionExpired(session: Session): boolean {
    if (!session.expires_at) return true;
    
    const expiresAt = session.expires_at * 1000;
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    
    return timeUntilExpiry <= 60000; // Consider expired if less than 1 minute remaining
  }

  /**
   * Validate session and refresh if needed
   */
  async validateAndRefreshSession(): Promise<{ session: Session | null; refreshed: boolean }> {
    const sessionState = await this.getSessionState();
    
    if (!sessionState.session) {
      return { session: null, refreshed: false };
    }

    if (sessionState.isExpired) {
      logInfo('Session expired, attempting refresh...', 'SessionManager');
      const refreshedSession = await this.refreshSession();
      return { session: refreshedSession, refreshed: !!refreshedSession };
    }

    return { session: sessionState.session, refreshed: false };
  }

  /**
   * Clear session monitoring on cleanup
   */
  cleanup(): void {
    this.stopSessionMonitoring();
    this.isRefreshing = false;
    this.refreshPromise = null;
  }
}

export const sessionManager = SessionManager.getInstance();

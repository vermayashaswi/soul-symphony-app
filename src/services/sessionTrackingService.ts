import { supabase } from '@/integrations/supabase/client';
import { nativeIntegrationService } from './nativeIntegrationService';

export interface SessionData {
  id?: string;
  user_id?: string;
  device_type?: string;
  ip_address?: string;
  country?: string;
  app_language?: string;
  start_page?: string;
  most_interacted_page?: string;
  total_page_views?: number;
  pages_visited?: string[];
  page_interactions?: Record<string, number>;
  is_active?: boolean;
  session_start?: string;
  last_activity?: string;
}

export interface PageInteraction {
  page: string;
  timestamp: number;
  action?: string;
}

// In-memory session data for anonymous users
interface AnonymousSessionData {
  sessionId: string;
  device_type?: string;
  start_page?: string;
  most_interacted_page?: string;
  total_page_views: number;
  pages_visited: string[];
  page_interactions: Record<string, number>;
  session_start: number;
  last_activity: number;
  isAnonymous: true;
}

class SessionTrackingService {
  private currentSessionId: string | null = null;
  private anonymousSession: AnonymousSessionData | null = null;
  private pageInteractions: Record<string, number> = {};
  private pagesVisited: Set<string> = new Set();
  private currentPage: string = '';
  private sessionStartTime: number = Date.now();
  private lastActivityTime: number = Date.now();
  private activityTimer: NodeJS.Timeout | null = null;
  private saveTimer: NodeJS.Timeout | null = null;
  private idleCheckTimer: NodeJS.Timeout | null = null;
  
  // Configuration constants
  private readonly ACTIVITY_UPDATE_INTERVAL = 30000; // 30 seconds
  private readonly SAVE_DEBOUNCE_MS = 2000; // 2 seconds
  private readonly IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  private isInitializing = false;
  private hasBeenIdle = false;

  async initializeSession(userId?: string): Promise<string | null> {
    if (this.isInitializing) {
      console.log('[SessionTracking] Session initialization already in progress');
      return this.currentSessionId || this.anonymousSession?.sessionId || null;
    }

    this.isInitializing = true;

    try {
      console.log('[SessionTracking] Initializing session for user:', userId);
      
      // Clear any existing session data
      this.cleanup();

      if (userId) {
        // For authenticated users, use database
        const sessionId = await this.createAuthenticatedSession(userId);
        this.isInitializing = false;
        return sessionId;
      } else {
        // For anonymous users, create in-memory session only
        const sessionId = await this.createAnonymousSession();
        this.isInitializing = false;
        return sessionId;
      }

    } catch (error) {
      console.error('[SessionTracking] Failed to initialize session:', error);
      this.isInitializing = false;
      return null;
    }
  }

  private async createAuthenticatedSession(userId: string): Promise<string | null> {
    try {
      // First, try to resume an existing session
      const { data, error } = await supabase.rpc('resume_or_create_session', {
        p_user_id: userId,
        p_device_type: this.getDeviceInfo().type,
        p_entry_page: this.getCurrentPagePath()
      });

      if (error) {
        console.error('[SessionTracking] Error calling resume_or_create_session:', error);
        return null;
      }

      if (data) {
        this.currentSessionId = data;
        this.currentPage = this.getCurrentPagePath();
        this.pagesVisited.add(this.currentPage);
        this.pageInteractions[this.currentPage] = 1;
        this.sessionStartTime = Date.now();
        this.lastActivityTime = Date.now();
        
        console.log('[SessionTracking] Authenticated session created/resumed:', this.currentSessionId);
        this.startActivityTracking();
        return this.currentSessionId;
      }

      return null;
    } catch (error) {
      console.error('[SessionTracking] Error creating authenticated session:', error);
      return null;
    }
  }

  private async createAnonymousSession(): Promise<string | null> {
    try {
      const sessionId = this.generateSessionId();
      const startPage = this.getCurrentPagePath();
      
      // Create in-memory session for anonymous users
      this.anonymousSession = {
        sessionId,
        isAnonymous: true,
        device_type: this.getDeviceInfo().type,
        start_page: startPage,
        total_page_views: 1,
        pages_visited: [startPage],
        page_interactions: { [startPage]: 1 },
        session_start: Date.now(),
        last_activity: Date.now(),
      };

      // Initialize local tracking variables
      this.currentPage = startPage;
      this.pagesVisited.add(startPage);
      this.pageInteractions[startPage] = 1;
      this.sessionStartTime = Date.now();
      this.lastActivityTime = Date.now();

      // Store basic info in localStorage for session persistence
      localStorage.setItem('anonymous_session_id', sessionId);
      localStorage.setItem('anonymous_session_start', Date.now().toString());
      
      console.log('[SessionTracking] Anonymous session created (in-memory only):', sessionId);
      
      // Start basic activity tracking (no database updates)
      this.startAnonymousActivityTracking();
      
      return sessionId;
    } catch (error) {
      console.error('[SessionTracking] Failed to create anonymous session:', error);
      return null;
    }
  }

  async trackPageView(page: string): Promise<void> {
    const session = this.getCurrentSession();
    if (!session) return;

    try {
      this.currentPage = page;
      this.pagesVisited.add(page);
      this.pageInteractions[page] = (this.pageInteractions[page] || 0) + 1;
      this.updateLastActivity();

      // Update session data
      if (this.anonymousSession) {
        this.anonymousSession.pages_visited.push(page);
        this.anonymousSession.total_page_views++;
        this.anonymousSession.last_activity = Date.now();
        this.anonymousSession.page_interactions[page] = this.pageInteractions[page];
      }

      // Save to database only for authenticated users
      if (this.currentSessionId) {
        this.debounceSave();
      }
      
      console.log('[SessionTracking] Page view tracked:', page);
    } catch (error) {
      console.error('[SessionTracking] Error tracking page view:', error);
    }
  }

  async trackInteraction(page: string, action?: string): Promise<void> {
    const session = this.getCurrentSession();
    if (!session) return;

    try {
      this.pageInteractions[page] = (this.pageInteractions[page] || 0) + 1;
      this.updateLastActivity();
      
      // Update current page if different
      if (page !== this.currentPage) {
        this.currentPage = page;
        this.pagesVisited.add(page);
      }

      // Update session data
      if (this.anonymousSession) {
        if (!this.anonymousSession.pages_visited.includes(page)) {
          this.anonymousSession.pages_visited.push(page);
        }
        this.anonymousSession.page_interactions[page] = this.pageInteractions[page];
        this.anonymousSession.last_activity = Date.now();
        this.anonymousSession.most_interacted_page = this.getMostInteractedPage();
      }

      // Save to database only for authenticated users
      if (this.currentSessionId) {
        this.debounceSave();
      }
      
      console.log('[SessionTracking] Interaction tracked:', { page, action });
    } catch (error) {
      console.error('[SessionTracking] Error tracking interaction:', error);
    }
  }

  private updateLastActivity(): void {
    this.lastActivityTime = Date.now();
    this.hasBeenIdle = false;
  }

  async extendSessionActivity(): Promise<void> {
    // Only extend activity for authenticated users in database
    if (!this.currentSessionId) return;

    try {
      const { data, error } = await supabase.rpc('extend_session_activity', {
        p_session_id: this.currentSessionId,
        p_user_id: await this.getCurrentUserId()
      });

      if (error) {
        console.error('[SessionTracking] Error extending session activity:', error);
      } else {
        this.updateLastActivity();
        console.log('[SessionTracking] Session activity extended');
      }
    } catch (error) {
      console.error('[SessionTracking] Error extending session activity:', error);
    }
  }

  async endSession(reason: 'user_action' | 'idle_timeout' | 'app_close' = 'user_action'): Promise<void> {
    const session = this.getCurrentSession();
    if (!session) return;

    try {
      const sessionDuration = Date.now() - this.sessionStartTime;
      const mostInteractedPage = this.getMostInteractedPage();

      // Only update database for authenticated users
      if (this.currentSessionId) {
        await supabase
          .from('user_sessions')
          .update({
            session_end: new Date().toISOString(),
            session_duration: `${Math.floor(sessionDuration / 1000)} seconds`,
            most_interacted_page: mostInteractedPage,
            total_page_views: this.pagesVisited.size,
            pages_visited: Array.from(this.pagesVisited),
            page_interactions: this.pageInteractions,
            is_active: false,
          })
          .eq('id', this.currentSessionId);
      }

      console.log(`[SessionTracking] Session ended (${reason}):`, session.sessionId || this.currentSessionId);
      
      // Clean up
      this.cleanup();
    } catch (error) {
      console.error('[SessionTracking] Error ending session:', error);
    }
  }

  async handleIdleDetection(isIdle: boolean): Promise<void> {
    const session = this.getCurrentSession();
    if (!session) return;

    if (isIdle && !this.hasBeenIdle) {
      this.hasBeenIdle = true;
      console.log('[SessionTracking] User has gone idle, but keeping session active');
      
    } else if (!isIdle && this.hasBeenIdle) {
      this.hasBeenIdle = false;
      console.log('[SessionTracking] User is active again');
      this.updateLastActivity();
      
      // Only extend database session for authenticated users
      if (this.currentSessionId) {
        await this.extendSessionActivity();
      }
    }
  }

  async handleAppStateChange(state: 'background' | 'foreground' | 'terminated'): Promise<void> {
    const session = this.getCurrentSession();
    if (!session) return;

    switch (state) {
      case 'background':
        console.log('[SessionTracking] App backgrounded - continuing session');
        // Only save to database for authenticated users
        if (this.currentSessionId) {
          await this.saveCurrentState();
        }
        break;
        
      case 'foreground':
        console.log('[SessionTracking] App foregrounded - resuming session');
        this.updateLastActivity();
        if (this.currentSessionId) {
          await this.extendSessionActivity();
        }
        break;
        
      case 'terminated':
        console.log('[SessionTracking] App terminated - ending session');
        await this.endSession('app_close');
        break;
    }
  }

  private getCurrentSession(): { sessionId: string } | null {
    if (this.currentSessionId) {
      return { sessionId: this.currentSessionId };
    }
    if (this.anonymousSession) {
      return { sessionId: this.anonymousSession.sessionId };
    }
    return null;
  }

  private async getCurrentUserId(): Promise<string | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    } catch (error) {
      return null;
    }
  }

  private getDeviceInfo() {
    const isNative = nativeIntegrationService.isRunningNatively();
    const userAgent = navigator.userAgent;
    
    let deviceType = 'web';
    if (isNative) {
      deviceType = 'mobile_app';
    } else if (/Mobi|Android/i.test(userAgent)) {
      deviceType = 'mobile_web';
    } else if (/Tablet|iPad/i.test(userAgent)) {
      deviceType = 'tablet_web';
    } else {
      deviceType = 'desktop_web';
    }

    return { type: deviceType };
  }

  private getCurrentPagePath(): string {
    if (typeof window !== 'undefined') {
      return window.location.pathname + window.location.search;
    }
    return '/';
  }

  private getMostInteractedPage(): string {
    let maxInteractions = 0;
    let mostInteractedPage = '';
    
    for (const [page, interactions] of Object.entries(this.pageInteractions)) {
      if (interactions > maxInteractions) {
        maxInteractions = interactions;
        mostInteractedPage = page;
      }
    }
    
    return mostInteractedPage || this.currentPage;
  }

  private generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private startActivityTracking(): void {
    // Update activity every 30 seconds for authenticated users
    this.activityTimer = setInterval(() => {
      this.extendSessionActivity();
    }, this.ACTIVITY_UPDATE_INTERVAL);

    // Check for idle timeout every 5 minutes
    this.idleCheckTimer = setInterval(() => {
      this.checkForIdleTimeout();
    }, this.CLEANUP_INTERVAL_MS);

    this.setupEventListeners();
  }

  private startAnonymousActivityTracking(): void {
    // For anonymous users, only check for idle timeout, no database updates
    this.idleCheckTimer = setInterval(() => {
      this.checkForIdleTimeout();
    }, this.CLEANUP_INTERVAL_MS);

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for page visibility changes
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          // App is hidden/backgrounded - save state for authenticated users
          if (this.currentSessionId) {
            this.debounceSave();
          }
        } else {
          // App is visible again - update activity
          this.updateLastActivity();
          if (this.currentSessionId) {
            this.extendSessionActivity();
          }
        }
      });

      // Listen for beforeunload to save session data for authenticated users
      window.addEventListener('beforeunload', () => {
        if (this.currentSessionId) {
          this.saveCurrentStateSync();
        }
      });
    }
  }

  private checkForIdleTimeout(): void {
    const session = this.getCurrentSession();
    if (!session) return;

    const idleTime = Date.now() - this.lastActivityTime;
    
    if (idleTime > this.IDLE_TIMEOUT_MS) {
      console.log('[SessionTracking] Session has exceeded idle timeout, ending session');
      this.endSession('idle_timeout');
    }
  }

  private debounceSave(): void {
    if (!this.currentSessionId) return; // Only save authenticated sessions to database
    
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    
    this.saveTimer = setTimeout(() => {
      this.saveCurrentState();
    }, this.SAVE_DEBOUNCE_MS);
  }

  private async saveCurrentState(): Promise<void> {
    if (!this.currentSessionId) return; // Only save authenticated sessions

    try {
      const mostInteractedPage = this.getMostInteractedPage();
      
      await supabase
        .from('user_sessions')
        .update({
          most_interacted_page: mostInteractedPage,
          total_page_views: this.pagesVisited.size,
          pages_visited: Array.from(this.pagesVisited),
          page_interactions: this.pageInteractions,
          last_activity: new Date().toISOString(),
        })
        .eq('id', this.currentSessionId);
        
      console.log('[SessionTracking] Session state saved');
    } catch (error) {
      console.error('[SessionTracking] Error saving session state:', error);
    }
  }

  private saveCurrentStateSync(): void {
    if (!this.currentSessionId || typeof navigator === 'undefined' || !navigator.sendBeacon) {
      return;
    }

    try {
      const mostInteractedPage = this.getMostInteractedPage();
      const updateData = {
        most_interacted_page: mostInteractedPage,
        total_page_views: this.pagesVisited.size,
        pages_visited: Array.from(this.pagesVisited),
        page_interactions: this.pageInteractions,
        last_activity: new Date().toISOString(),
      };

      // Use sendBeacon for reliable data transmission during page unload
      const SUPABASE_URL = "https://kwnwhgucnzqxndzjayyq.supabase.co";
      const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3bndoZ3VjbnpxeG5kempheXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIzMzk4ODMsImV4cCI6MjA1NzkxNTg4M30.UAB3e5b44iJa9kKT391xyJKoQmlUOtsAi-yp4UEqZrc";
      
      const url = `${SUPABASE_URL}/rest/v1/user_sessions?id=eq.${this.currentSessionId}`;
      const payload = JSON.stringify(updateData);
      
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
      console.log('[SessionTracking] Session state saved synchronously');
    } catch (error) {
      console.error('[SessionTracking] Error saving session state synchronously:', error);
    }
  }

  private cleanup(): void {
    if (this.activityTimer) {
      clearInterval(this.activityTimer);
      this.activityTimer = null;
    }
    
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer);
      this.idleCheckTimer = null;
    }
    
    this.currentSessionId = null;
    this.anonymousSession = null;
    this.pageInteractions = {};
    this.pagesVisited.clear();
    this.currentPage = '';
    this.hasBeenIdle = false;
    this.isInitializing = false;

    // Clear anonymous session from localStorage
    localStorage.removeItem('anonymous_session_id');
    localStorage.removeItem('anonymous_session_start');
  }

  // Static cleanup method for expired sessions
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('cleanup_idle_sessions');
      
      if (error) {
        console.error('[SessionTracking] Error cleaning up expired sessions:', error);
        return 0;
      }
      
      console.log(`[SessionTracking] Cleaned up ${data} expired sessions`);
      return data || 0;
    } catch (error) {
      console.error('[SessionTracking] Error cleaning up expired sessions:', error);
      return 0;
    }
  }

  // Public getters for debugging and analytics
  getCurrentSessionId(): string | null {
    return this.currentSessionId || this.anonymousSession?.sessionId || null;
  }

  getSessionStats() {
    const session = this.getCurrentSession();
    
    return {
      currentPage: this.currentPage,
      pagesVisited: Array.from(this.pagesVisited),
      pageInteractions: { ...this.pageInteractions },
      sessionDuration: Date.now() - this.sessionStartTime,
      isActive: !!session,
      isAnonymous: !!this.anonymousSession,
      isAuthenticated: !!this.currentSessionId,
      lastActivityTime: this.lastActivityTime,
      isIdle: this.hasBeenIdle,
      timeSinceLastActivity: Date.now() - this.lastActivityTime,
    };
  }

  isSessionActive(): boolean {
    return !!(this.currentSessionId || this.anonymousSession);
  }
}

export const sessionTrackingService = new SessionTrackingService();
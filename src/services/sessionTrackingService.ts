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

class SessionTrackingService {
  private currentSessionId: string | null = null;
  private pageInteractions: Record<string, number> = {};
  private pagesVisited: Set<string> = new Set();
  private currentPage: string = '';
  private sessionStartTime: number = Date.now();
  private lastActivityTime: number = Date.now();
  private activityTimer: NodeJS.Timeout | null = null;
  private saveTimer: NodeJS.Timeout | null = null;

  async initializeSession(userId?: string): Promise<string | null> {
    try {
      console.log('[SessionTracking] Initializing session for user:', userId);
      
      // Get device and location info
      const deviceInfo = this.getDeviceInfo();
      const locationInfo = await this.getLocationInfo();
      const startPage = this.getCurrentPagePath();
      
      // Get current language from localStorage or default to 'en'
      const appLanguage = localStorage.getItem('i18nextLng') || 'en';

      const sessionData: Partial<SessionData> = {
        user_id: userId || undefined,
        device_type: deviceInfo.type,
        ip_address: locationInfo.ip,
        country: locationInfo.country,
        app_language: appLanguage,
        start_page: startPage,
        total_page_views: 1,
        pages_visited: [startPage],
        page_interactions: {},
        is_active: true,
      };

      const { data, error } = await supabase
        .from('user_sessions')
        .insert(sessionData)
        .select('id')
        .single();

      if (error) {
        console.error('[SessionTracking] Error creating session:', error);
        return null;
      }

      this.currentSessionId = data.id;
      this.currentPage = startPage;
      this.pagesVisited.add(startPage);
      this.pageInteractions[startPage] = (this.pageInteractions[startPage] || 0) + 1;
      
      console.log('[SessionTracking] Session initialized:', this.currentSessionId);
      
      // Start activity tracking
      this.startActivityTracking();
      
      return this.currentSessionId;
    } catch (error) {
      console.error('[SessionTracking] Failed to initialize session:', error);
      return null;
    }
  }

  async trackPageView(page: string): Promise<void> {
    if (!this.currentSessionId) return;

    try {
      this.currentPage = page;
      this.pagesVisited.add(page);
      this.pageInteractions[page] = (this.pageInteractions[page] || 0) + 1;
      this.lastActivityTime = Date.now();

      // Debounced save to avoid too many database calls
      this.debounceSave();
      
      console.log('[SessionTracking] Page view tracked:', page);
    } catch (error) {
      console.error('[SessionTracking] Error tracking page view:', error);
    }
  }

  async trackInteraction(page: string, action?: string): Promise<void> {
    if (!this.currentSessionId) return;

    try {
      this.pageInteractions[page] = (this.pageInteractions[page] || 0) + 1;
      this.lastActivityTime = Date.now();
      
      // Update current page if different
      if (page !== this.currentPage) {
        this.currentPage = page;
        this.pagesVisited.add(page);
      }

      this.debounceSave();
      
      console.log('[SessionTracking] Interaction tracked:', { page, action });
    } catch (error) {
      console.error('[SessionTracking] Error tracking interaction:', error);
    }
  }

  async endSession(): Promise<void> {
    if (!this.currentSessionId) return;

    try {
      const sessionDuration = Date.now() - this.sessionStartTime;
      const mostInteractedPage = this.getMostInteractedPage();

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

      console.log('[SessionTracking] Session ended:', this.currentSessionId);
      
      // Clean up
      this.cleanup();
    } catch (error) {
      console.error('[SessionTracking] Error ending session:', error);
    }
  }

  async updateActivity(): Promise<void> {
    if (!this.currentSessionId) return;

    try {
      this.lastActivityTime = Date.now();
      
      await supabase
        .from('user_sessions')
        .update({
          last_activity: new Date().toISOString(),
        })
        .eq('id', this.currentSessionId);
    } catch (error) {
      console.error('[SessionTracking] Error updating activity:', error);
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

  private async getLocationInfo(): Promise<{ ip?: string; country?: string }> {
    try {
      // Try to get IP and country from a free service with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://ipapi.co/json/', {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        return {
          ip: data.ip,
          country: data.country_name || data.country,
        };
      }
    } catch (error) {
      console.warn('[SessionTracking] Could not fetch location info:', error);
    }
    
    return {};
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

  private startActivityTracking(): void {
    // Update activity every 30 seconds
    this.activityTimer = setInterval(() => {
      this.updateActivity();
    }, 30000);

    // Listen for page visibility changes
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.debounceSave();
        } else {
          this.updateActivity();
        }
      });

      // Listen for beforeunload to save session
      window.addEventListener('beforeunload', () => {
        this.endSession();
      });
    }
  }

  private debounceSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    
    this.saveTimer = setTimeout(() => {
      this.saveCurrentState();
    }, 2000); // Save after 2 seconds of inactivity
  }

  private async saveCurrentState(): Promise<void> {
    if (!this.currentSessionId) return;

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

  private cleanup(): void {
    if (this.activityTimer) {
      clearInterval(this.activityTimer);
      this.activityTimer = null;
    }
    
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    
    this.currentSessionId = null;
    this.pageInteractions = {};
    this.pagesVisited.clear();
    this.currentPage = '';
  }

  // Public getters for debugging and analytics
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  getSessionStats() {
    return {
      currentPage: this.currentPage,
      pagesVisited: Array.from(this.pagesVisited),
      pageInteractions: { ...this.pageInteractions },
      sessionDuration: Date.now() - this.sessionStartTime,
      isActive: !!this.currentSessionId,
    };
  }
}

export const sessionTrackingService = new SessionTrackingService();
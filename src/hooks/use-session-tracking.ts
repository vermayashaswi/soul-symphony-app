
import { useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SessionTrackingService } from '@/services/sessionTrackingService';

interface UseSessionTrackingOptions {
  trackPageViews?: boolean;
  trackTimeOnPage?: boolean;
  autoInitialize?: boolean;
}

interface SessionInfo {
  sessionId: string | null;
  isNewSession: boolean;
  sessionStart: Date | null;
}

export const useSessionTracking = (options: UseSessionTrackingOptions = {}) => {
  const { user } = useAuth();
  const {
    trackPageViews = true,
    trackTimeOnPage = true,
    autoInitialize = true
  } = options;

  // Initialize session tracking when user is available
  useEffect(() => {
    if (user && autoInitialize) {
      SessionTrackingService.initializeSessionTracking();
    }
  }, [user, autoInitialize]);

  // Track page views
  useEffect(() => {
    if (!trackPageViews || !user) return;

    const handleRouteChange = () => {
      SessionTrackingService.updateSessionActivity(window.location.pathname);
    };

    // Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', handleRouteChange);

    // Track initial page view
    handleRouteChange();

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [trackPageViews, user]);

  // Track time on page
  useEffect(() => {
    if (!trackTimeOnPage || !user) return;

    let startTime = Date.now();
    let isActive = true;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        isActive = false;
      } else {
        startTime = Date.now();
        isActive = true;
        SessionTrackingService.updateSessionActivity(window.location.pathname);
      }
    };

    const trackTimeSpent = () => {
      if (isActive) {
        const timeSpent = Date.now() - startTime;
        if (timeSpent > 10000) { // Only track if more than 10 seconds
          SessionTrackingService.trackConversion('page_time_spent', {
            page: window.location.pathname,
            timeSpent: Math.round(timeSpent / 1000), // in seconds
            timestamp: new Date().toISOString()
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Track time spent when leaving the page
    window.addEventListener('beforeunload', trackTimeSpent);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', trackTimeSpent);
      trackTimeSpent(); // Track time when component unmounts
    };
  }, [trackTimeOnPage, user]);

  // Callback functions for manual tracking
  const trackConversion = useCallback(async (eventType: string, eventData: Record<string, any> = {}) => {
    if (!user) {
      console.warn('Cannot track conversion: user not authenticated');
      return;
    }
    
    await SessionTrackingService.trackConversion(eventType, eventData);
  }, [user]);

  const updateActivity = useCallback(async (page?: string) => {
    if (!user) return;
    
    await SessionTrackingService.updateSessionActivity(page || window.location.pathname);
  }, [user]);

  const getCurrentSession = useCallback((): SessionInfo => {
    const sessionInfo = SessionTrackingService.getCurrentSession();
    return {
      sessionId: sessionInfo?.sessionId || null,
      isNewSession: sessionInfo?.isNewSession || false,
      sessionStart: sessionInfo?.sessionStart || null
    };
  }, []);

  const closeSession = useCallback(async () => {
    await SessionTrackingService.closeCurrentSession();
  }, []);

  return {
    trackConversion,
    updateActivity,
    getCurrentSession,
    closeSession,
    isUserAuthenticated: !!user
  };
};

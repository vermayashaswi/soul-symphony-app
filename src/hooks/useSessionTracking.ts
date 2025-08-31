import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { sessionTrackingService } from '@/services/sessionTrackingService';
import { useSessionValidation } from './useSessionValidation';
import { useIdleDetection } from './use-idle-detection';
import { supabase } from '@/integrations/supabase/client';

export const useSessionTracking = () => {
  const location = useLocation();
  const { session } = useSessionValidation();
  
  // Set up idle detection with 30 minute timeout (matching service)
  const { isIdle } = useIdleDetection({
    timeout: 30 * 60 * 1000, // 30 minutes
    events: ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'focus'],
  });

  // Initialize session when component mounts or user changes
  useEffect(() => {
    // Only initialize session for /app routes
    if (!location.pathname.startsWith('/app')) {
      return;
    }

    // Prevent duplicate initialization
    if (sessionTrackingService.isSessionActive()) {
      console.log('[SessionTracking] Session already active, skipping initialization');
      return;
    }

    const initSession = async () => {
      const userId = session?.user?.id;
      await sessionTrackingService.initializeSession(userId);
    };

    initSession();

    // Don't cleanup on unmount - let the session continue
    // Sessions should only end due to idle timeout or explicit user action
  }, [session?.user?.id, location.pathname]);

  // Handle idle detection
  useEffect(() => {
    if (!location.pathname.startsWith('/app')) {
      return;
    }

    sessionTrackingService.handleIdleDetection(isIdle);
  }, [isIdle, location.pathname]);

  // Track page views when route changes (only for /app routes)
  useEffect(() => {
    if (!location.pathname.startsWith('/app')) {
      return;
    }
    
    const currentPath = location.pathname + location.search;
    sessionTrackingService.trackPageView(currentPath);
  }, [location.pathname, location.search]);


  // Cleanup expired sessions periodically
  useEffect(() => {
    const cleanupInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase.rpc('cleanup_idle_sessions');
        if (error) {
          console.error('[SessionTracking] Error cleaning up expired sessions:', error);
        } else {
          console.log(`[SessionTracking] Cleaned up ${data} expired sessions`);
        }
      } catch (error) {
        console.error('[SessionTracking] Error cleaning up expired sessions:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => clearInterval(cleanupInterval);
  }, []);

  // Track interactions (only for /app routes)
  const trackInteraction = useCallback((action?: string) => {
    if (!location.pathname.startsWith('/app')) {
      return;
    }
    
    const currentPath = location.pathname + location.search;
    sessionTrackingService.trackInteraction(currentPath, action);
  }, [location.pathname, location.search]);

  // Track specific page interaction
  const trackPageInteraction = useCallback((page: string, action?: string) => {
    sessionTrackingService.trackInteraction(page, action);
  }, []);

  // Get current session stats
  const getSessionStats = useCallback(() => {
    return sessionTrackingService.getSessionStats();
  }, []);

  // Get current session ID
  const getCurrentSessionId = useCallback(() => {
    return sessionTrackingService.getCurrentSessionId();
  }, []);

  // Manually end session (for explicit user logout)
  const endSession = useCallback((reason: 'user_action' | 'idle_timeout' | 'app_close' = 'user_action') => {
    sessionTrackingService.endSession(reason);
  }, []);

  return {
    trackInteraction,
    trackPageInteraction,
    getSessionStats,
    getCurrentSessionId,
    endSession,
    isIdle,
    isSessionActive: sessionTrackingService.isSessionActive(),
  };
};
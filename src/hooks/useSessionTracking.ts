import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { sessionTrackingService } from '@/services/sessionTrackingService';
import { useSessionValidation } from './useSessionValidation';

export const useSessionTracking = () => {
  const location = useLocation();
  const { session } = useSessionValidation();

  // Initialize session when component mounts or user changes
  useEffect(() => {
    // Only initialize session for /app routes
    if (!location.pathname.startsWith('/app')) {
      return;
    }

    const initSession = async () => {
      const userId = session?.user?.id;
      await sessionTrackingService.initializeSession(userId);
    };

    initSession();

    // Cleanup on unmount
    return () => {
      sessionTrackingService.endSession();
    };
  }, [session?.user?.id, location.pathname]);

  // Track page views when route changes (only for /app routes)
  useEffect(() => {
    if (!location.pathname.startsWith('/app')) {
      return;
    }
    
    const currentPath = location.pathname + location.search;
    sessionTrackingService.trackPageView(currentPath);
  }, [location.pathname, location.search]);

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

  return {
    trackInteraction,
    trackPageInteraction,
    getSessionStats,
    getCurrentSessionId,
  };
};
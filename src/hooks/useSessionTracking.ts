import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { sessionTrackingService } from '@/services/sessionTrackingService';
import { useSessionValidation } from './useSessionValidation';

export const useSessionTracking = () => {
  const location = useLocation();
  const { session } = useSessionValidation();

  // Initialize session when component mounts or user changes
  useEffect(() => {
    const initSession = async () => {
      const userId = session?.user?.id;
      await sessionTrackingService.initializeSession(userId);
    };

    initSession();

    // Cleanup on unmount
    return () => {
      sessionTrackingService.endSession();
    };
  }, [session?.user?.id]);

  // Track page views when route changes
  useEffect(() => {
    const currentPath = location.pathname + location.search;
    sessionTrackingService.trackPageView(currentPath);
  }, [location.pathname, location.search]);

  // Track interactions
  const trackInteraction = useCallback((action?: string) => {
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
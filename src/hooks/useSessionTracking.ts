import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { sessionManager, SessionState, SessionMetrics } from '@/services/sessionManager';
import { SessionTrackingService } from '@/services/sessionTrackingService';

interface UseSessionTrackingOptions {
  enableDebug?: boolean;
  trackPageViews?: boolean;
  enableHeartbeat?: boolean;
  onSessionStart?: (sessionId: string) => void;
  onSessionEnd?: (sessionId: string, metrics: SessionMetrics) => void;
}

export const useSessionTracking = (options: UseSessionTrackingOptions = {}) => {
  const {
    enableDebug = false,
    trackPageViews = true,
    enableHeartbeat = true,
    onSessionStart,
    onSessionEnd
  } = options;

  const location = useLocation();
  const [currentSession, setCurrentSession] = useState<SessionState | null>(null);
  const [sessionMetrics, setSessionMetrics] = useState<SessionMetrics | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const sessionStartedRef = useRef(false);
  const currentUserRef = useRef<string | null>(null);

  // Initialize SessionManager
  useEffect(() => {
    const initializeSessionManager = async () => {
      try {
        sessionManager.setDebugEnabled(enableDebug);
        await sessionManager.initialize();
        setIsInitialized(true);
        
        if (enableDebug) {
          console.log('[useSessionTracking] SessionManager initialized');
        }
      } catch (error) {
        console.error('[useSessionTracking] Failed to initialize SessionManager:', error);
      }
    };

    initializeSessionManager();
  }, [enableDebug]);

  // Handle authentication state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user;
      
      if (enableDebug) {
        console.log('[useSessionTracking] Auth state changed:', { event, userId: user?.id });
      }

      // Handle session start when user logs in
      if (event === 'SIGNED_IN' && user && !sessionStartedRef.current) {
        await handleSessionStart(user.id);
      }
      
      // Handle session end when user logs out
      if (event === 'SIGNED_OUT' && sessionStartedRef.current) {
        await handleSessionEnd();
      }

      // Update current user reference
      currentUserRef.current = user?.id || null;
    });

    return () => subscription.unsubscribe();
  }, [enableDebug]);

  // Handle app launch session start for already authenticated users
  useEffect(() => {
    const checkForExistingSession = async () => {
      if (!isInitialized) return;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        if (user && !sessionStartedRef.current) {
          if (enableDebug) {
            console.log('[useSessionTracking] Found existing session, starting tracking');
          }
          await handleSessionStart(user.id);
        }
      } catch (error) {
        console.error('[useSessionTracking] Error checking existing session:', error);
      }
    };

    checkForExistingSession();
  }, [isInitialized, enableDebug]);

  // Track page views
  useEffect(() => {
    if (!trackPageViews || !sessionStartedRef.current) return;

    const trackPageView = async () => {
      try {
        sessionManager.trackPageView(location.pathname);
        updateSessionState();
        
        if (enableDebug) {
          console.log('[useSessionTracking] Page view tracked:', location.pathname);
        }
      } catch (error) {
        console.error('[useSessionTracking] Error tracking page view:', error);
      }
    };

    trackPageView();
  }, [location.pathname, trackPageViews, enableDebug]);

  // Periodic session updates and metrics collection
  useEffect(() => {
    if (!enableHeartbeat || !sessionStartedRef.current) return;

    const interval = setInterval(() => {
      updateSessionState();
      updateSessionMetrics();
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [enableHeartbeat]);

  const handleSessionStart = async (userId: string) => {
    if (sessionStartedRef.current) {
      if (enableDebug) {
        console.log('[useSessionTracking] Session already started, skipping');
      }
      return;
    }

    try {
      // Get device and location info
      const deviceInfo = getDeviceInfo();
      const locationData = await SessionTrackingService.detectLocation();
      const utmParams = SessionTrackingService.extractUtmParameters();

      // Start session using SessionManager
      const sessionId = await sessionManager.startSession(userId, {
        entryPage: window.location.pathname,
        deviceType: deviceInfo.deviceType,
        userAgent: navigator.userAgent,
        appVersion: getAppVersion()
      });

      if (sessionId) {
        sessionStartedRef.current = true;
        updateSessionState();
        updateSessionMetrics();
        
        if (onSessionStart && sessionId) {
          onSessionStart(sessionId.id);
        }

        if (enableDebug) {
          console.log('[useSessionTracking] Session started successfully:', sessionId);
        }

        // Track initial conversion event
        await SessionTrackingService.trackConversion('session_start', {
          entryPage: window.location.pathname,
          deviceType: deviceInfo.deviceType,
          ...locationData,
          ...utmParams
        });
      }
    } catch (error) {
      console.error('[useSessionTracking] Error starting session:', error);
    }
  };

  const handleSessionEnd = async () => {
    if (!sessionStartedRef.current) return;

    try {
      const metrics = await sessionManager.getSessionMetrics();
      await sessionManager.terminateSession();
      
      sessionStartedRef.current = false;
      setCurrentSession(null);
      setSessionMetrics(null);

      if (onSessionEnd && currentSession?.id && metrics) {
        onSessionEnd(currentSession.id, metrics);
      }

      if (enableDebug) {
        console.log('[useSessionTracking] Session ended');
      }
    } catch (error) {
      console.error('[useSessionTracking] Error ending session:', error);
    }
  };

  const updateSessionState = async () => {
    const session = await sessionManager.getCurrentSession();
    setCurrentSession(session);
  };

  const updateSessionMetrics = async () => {
    const metrics = await sessionManager.getSessionMetrics();
    setSessionMetrics(metrics);
  };

  const getDeviceInfo = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    let deviceType = 'desktop';

    if (/android/i.test(userAgent)) {
      deviceType = 'mobile';
    } else if (/iphone|ipad|ipod/i.test(userAgent)) {
      deviceType = 'mobile';
    } else if (/tablet/i.test(userAgent)) {
      deviceType = 'tablet';
    }

    return { deviceType };
  };

  const getAppVersion = (): string => {
    return process.env.npm_package_version || '1.0.0';
  };

  // Manual session control methods
  const recordActivity = () => {
    sessionManager.recordActivity();
    updateSessionState();
  };

  const recordError = (error: Error) => {
    sessionManager.recordError(error);
    updateSessionState();
  };

  const recordCrash = () => {
    sessionManager.recordCrash();
    updateSessionState();
  };

  const trackConversion = async (eventType: string, eventData: Record<string, any> = {}) => {
    if (currentSession?.id) {
      await SessionTrackingService.trackConversion(eventType, eventData, currentSession.id);
    }
  };

  return {
    currentSession,
    sessionMetrics,
    isInitialized,
    isSessionActive: sessionStartedRef.current,
    recordActivity,
    recordError,
    recordCrash,
    trackConversion,
    updateSessionState,
    updateSessionMetrics
  };
};

export default useSessionTracking;
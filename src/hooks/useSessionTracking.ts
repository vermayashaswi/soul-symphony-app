import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { simpleSessionService } from '@/services/simpleSessionService';

interface UseSessionTrackingOptions {
  enableDebug?: boolean;
  trackPageViews?: boolean;
  onSessionStart?: (sessionId: string) => void;
  onSessionEnd?: (sessionId: string) => void;
}

interface SimpleSessionState {
  id: string | null;
  isActive: boolean;
  startTime: Date | null;
  pageViews: number;
}

export const useSessionTracking = (options: UseSessionTrackingOptions = {}) => {
  const {
    enableDebug = false,
    trackPageViews = true,
    onSessionStart,
    onSessionEnd
  } = options;

  const location = useLocation();
  const [currentSession, setCurrentSession] = useState<SimpleSessionState | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const sessionStartedRef = useRef(false);
  const currentUserRef = useRef<string | null>(null);

  // Initialize simple session tracking
  useEffect(() => {
    setIsInitialized(true);
    if (enableDebug) {
      console.log('[useSessionTracking] Simple session tracking initialized');
    }
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
        if (currentSession) {
          setCurrentSession(prev => prev ? {
            ...prev,
            pageViews: prev.pageViews + 1
          } : null);
        }
        
        if (enableDebug) {
          console.log('[useSessionTracking] Page view tracked:', location.pathname);
        }
      } catch (error) {
        console.error('[useSessionTracking] Error tracking page view:', error);
      }
    };

    trackPageView();
  }, [location.pathname, trackPageViews, enableDebug]);

  const handleSessionStart = async (userId: string) => {
    if (sessionStartedRef.current) {
      if (enableDebug) {
        console.log('[useSessionTracking] Session already started, skipping');
      }
      return;
    }

    try {
      // Start simple session
      const sessionId = await simpleSessionService.createSession({
        userId,
        deviceType: getDeviceType(),
        entryPage: window.location.pathname
      });

      if (sessionId) {
        sessionStartedRef.current = true;
        setCurrentSession({
          id: sessionId,
          isActive: true,
          startTime: new Date(),
          pageViews: 1
        });
        
        if (onSessionStart) {
          onSessionStart(sessionId);
        }

        if (enableDebug) {
          console.log('[useSessionTracking] Session started successfully:', sessionId);
        }
      }
    } catch (error) {
      console.error('[useSessionTracking] Error starting session:', error);
    }
  };

  const handleSessionEnd = async () => {
    if (!sessionStartedRef.current || !currentUserRef.current) return;

    try {
      await simpleSessionService.endSession(currentUserRef.current);
      
      const sessionId = currentSession?.id;
      sessionStartedRef.current = false;
      setCurrentSession(null);

      if (onSessionEnd && sessionId) {
        onSessionEnd(sessionId);
      }

      if (enableDebug) {
        console.log('[useSessionTracking] Session ended');
      }
    } catch (error) {
      console.error('[useSessionTracking] Error ending session:', error);
    }
  };

  const getDeviceType = (): string => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/android|iphone|ipad|ipod/i.test(userAgent)) {
      return 'mobile';
    } else if (/tablet/i.test(userAgent)) {
      return 'tablet';
    }
    return 'desktop';
  };

  // Simplified activity recording
  const recordActivity = () => {
    if (currentUserRef.current) {
      simpleSessionService.updateActivity(currentUserRef.current);
    }
  };

  return {
    currentSession,
    isInitialized,
    isSessionActive: sessionStartedRef.current,
    recordActivity
  };
};

export default useSessionTracking;
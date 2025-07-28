import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSessionTracking } from '@/hooks/useSessionTracking';
import { SessionState, SessionMetrics } from '@/services/sessionManager';

interface SessionContextType {
  currentSession: SessionState | null;
  sessionMetrics: SessionMetrics | null;
  isInitialized: boolean;
  isSessionActive: boolean;
  recordActivity: () => void;
  recordError: (error: Error) => void;
  recordCrash: () => void;
  trackConversion: (eventType: string, eventData?: Record<string, any>) => Promise<void>;
  updateSessionState: () => void;
  updateSessionMetrics: () => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

interface SessionProviderProps {
  children: React.ReactNode;
  enableDebug?: boolean;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ 
  children, 
  enableDebug = false 
}) => {
  const [sessionEvents, setSessionEvents] = useState<string[]>([]);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isStuckLoading, setIsStuckLoading] = useState(false);

  const sessionTracking = useSessionTracking({
    enableDebug,
    trackPageViews: true,
    enableHeartbeat: true,
    onSessionStart: (sessionId) => {
      setSessionEvents(prev => [...prev, `Session started: ${sessionId}`]);
      setSessionError(null); // Clear any previous errors
      setIsStuckLoading(false);
      if (enableDebug) {
        console.log('[SessionProvider] Session started:', sessionId);
      }
    },
    onSessionEnd: (sessionId, metrics) => {
      setSessionEvents(prev => [...prev, `Session ended: ${sessionId}`]);
      if (enableDebug) {
        console.log('[SessionProvider] Session ended:', { sessionId, metrics });
      }
    }
  });

  // Add timeout detection for stuck loading states
  useEffect(() => {
    if (!sessionTracking.isInitialized && !sessionError) {
      const stuckTimeout = setTimeout(() => {
        console.warn('[SessionProvider] Session initialization timeout detected');
        setIsStuckLoading(true);
        setSessionError('Session initialization is taking longer than expected');
      }, 10000); // 10 second timeout

      return () => clearTimeout(stuckTimeout);
    }
  }, [sessionTracking.isInitialized, sessionError]);

  // Global error handling for session tracking
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      if (sessionTracking.isSessionActive) {
        sessionTracking.recordError(new Error(event.message || 'Unknown error'));
        
        if (enableDebug) {
          console.log('[SessionProvider] Global error recorded:', event.message);
        }
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (sessionTracking.isSessionActive) {
        sessionTracking.recordError(new Error(event.reason?.toString() || 'Unhandled promise rejection'));
        
        if (enableDebug) {
          console.log('[SessionProvider] Unhandled rejection recorded:', event.reason);
        }
      }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [sessionTracking.isSessionActive, sessionTracking.recordError, enableDebug]);

  // Track critical app events as conversions
  useEffect(() => {
    const trackAppEvents = async () => {
      if (!sessionTracking.isSessionActive) return;

      // Track app-specific conversion events
      const criticalActions = [
        // Journal-related events
        'journal_entry_created',
        'journal_entry_analyzed', 
        'theme_explored',
        'emotion_tracked',
        
        // User engagement events
        'profile_completed',
        'onboarding_finished',
        'chat_conversation_started',
        'premium_upgrade'
      ];

      // You could listen for these events from other parts of the app
      // and track them as conversions automatically
    };

    trackAppEvents();
  }, [sessionTracking.isSessionActive]);

  const contextValue: SessionContextType = {
    ...sessionTracking
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = (): SessionContextType => {
  const context = useContext(SessionContext);
  
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  
  return context;
};

export default SessionProvider;
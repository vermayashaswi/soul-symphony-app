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

  const sessionTracking = useSessionTracking({
    enableDebug,
    trackPageViews: true,
    enableHeartbeat: true,
    onSessionStart: (sessionId) => {
      setSessionEvents(prev => [...prev, `Session started: ${sessionId}`]);
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
      {enableDebug && (
        <div 
          style={{ 
            position: 'fixed', 
            bottom: 0, 
            right: 0, 
            background: 'rgba(0,0,0,0.8)', 
            color: 'white', 
            padding: '10px',
            fontSize: '12px',
            maxWidth: '300px',
            maxHeight: '200px',
            overflow: 'auto',
            zIndex: 9999
          }}
        >
          <div><strong>Session Debug Panel</strong></div>
          <div>Active: {sessionTracking.isSessionActive ? 'Yes' : 'No'}</div>
          <div>ID: {sessionTracking.currentSession?.id?.substring(0, 8) || 'None'}</div>
          <div>State: {sessionTracking.currentSession?.state || 'None'}</div>
          <div>Page Views: {sessionTracking.currentSession?.pageViews || 0}</div>
          <div>Quality: {sessionTracking.currentSession?.qualityScore?.toFixed(2) || 'N/A'}</div>
          {sessionTracking.sessionMetrics && (
            <div>Duration: {Math.round(sessionTracking.sessionMetrics.duration / 1000)}s</div>
          )}
          <div style={{ marginTop: '5px', fontSize: '10px' }}>
            Recent events: {sessionEvents.slice(-3).join(', ')}
          </div>
        </div>
      )}
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
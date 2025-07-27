import React, { createContext, useContext, useEffect } from 'react';
import { useSessionTracking } from '@/hooks/useSessionTracking';

interface SimpleSessionState {
  id: string | null;
  isActive: boolean;
  startTime: Date | null;
  pageViews: number;
}

interface SessionContextType {
  currentSession: SimpleSessionState | null;
  isInitialized: boolean;
  isSessionActive: boolean;
  recordActivity: () => void;
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
  const sessionTracking = useSessionTracking({
    enableDebug,
    trackPageViews: true,
    onSessionStart: (sessionId) => {
      if (enableDebug) {
        console.log('[SessionProvider] Session started:', sessionId);
      }
    },
    onSessionEnd: (sessionId) => {
      if (enableDebug) {
        console.log('[SessionProvider] Session ended:', sessionId);
      }
    }
  });

  // Global error handling for session tracking
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      if (sessionTracking.isSessionActive && enableDebug) {
        console.log('[SessionProvider] Global error recorded:', event.message);
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (sessionTracking.isSessionActive && enableDebug) {
        console.log('[SessionProvider] Unhandled rejection recorded:', event.reason);
      }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [sessionTracking.isSessionActive, enableDebug]);

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
            maxHeight: '100px',
            overflow: 'auto',
            zIndex: 9999
          }}
        >
          <div><strong>Simple Session Debug</strong></div>
          <div>Active: {sessionTracking.isSessionActive ? 'Yes' : 'No'}</div>
          <div>ID: {sessionTracking.currentSession?.id?.substring(0, 8) || 'None'}</div>
          <div>Page Views: {sessionTracking.currentSession?.pageViews || 0}</div>
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
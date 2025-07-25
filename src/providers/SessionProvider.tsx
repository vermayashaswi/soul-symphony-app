import React, { createContext, useContext, useEffect, useState } from 'react';
import { useOptimizedSessionTracking } from '@/hooks/useOptimizedSessionTracking';

interface SessionContextType {
  sessionState: { id: string | null; isActive: boolean; startTime: number };
  isInitialized: boolean;
  circuitBreakerState: string;
  resetCircuitBreaker: () => void;
  sessionEvents: string[];
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

  const sessionTracking = useOptimizedSessionTracking({
    enableDebug,
    deferLocationDetection: true,
    skipUTMTracking: true
  });

  // Lightweight error tracking
  useEffect(() => {
    if (enableDebug) {
      console.log('[SessionProvider] Optimized session tracking active');
    }
  }, [enableDebug]);

  const value: SessionContextType = {
    sessionState: sessionTracking.sessionState,
    isInitialized: sessionTracking.isInitialized,
    circuitBreakerState: sessionTracking.circuitBreakerState,
    resetCircuitBreaker: sessionTracking.resetCircuitBreaker,
    sessionEvents
  };

  return (
    <SessionContext.Provider value={value}>
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
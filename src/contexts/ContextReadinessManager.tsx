
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ContextReadinessState {
  isReady: boolean;
  error: Error | null;
}

interface ContextReadinessContextType {
  isReady: boolean;
  error: Error | null;
  markReady: () => void;
  markError: (error: Error) => void;
}

const ContextReadinessContext = createContext<ContextReadinessContextType | undefined>(undefined);

export function ContextReadinessProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ContextReadinessState>({
    isReady: false,
    error: null
  });

  const markReady = () => {
    setState(prev => ({ ...prev, isReady: true }));
  };

  const markError = (error: Error) => {
    setState(prev => ({ ...prev, error }));
  };

  // Auto-mark as ready after a brief delay to ensure React is initialized
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!state.error) {
        markReady();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [state.error]);

  return (
    <ContextReadinessContext.Provider value={{ 
      isReady: state.isReady, 
      error: state.error, 
      markReady, 
      markError 
    }}>
      {children}
    </ContextReadinessContext.Provider>
  );
}

export function useContextReadiness() {
  const context = useContext(ContextReadinessContext);
  if (context === undefined) {
    throw new Error('useContextReadiness must be used within a ContextReadinessProvider');
  }
  return context;
}

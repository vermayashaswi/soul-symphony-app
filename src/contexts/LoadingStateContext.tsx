import React, { createContext, useContext, ReactNode } from 'react';
import { useLoadingCoordinator } from '@/hooks/useLoadingCoordinator';
import { useDebugMonitor, usePerformanceMonitor } from '@/hooks/useDebugMonitor';

interface LoadingStateContextType {
  startLoading: (component: string, timeout?: number) => string;
  stopLoading: (id: string, reason?: string) => void;
  forceStopAllLoading: (reason?: string) => void;
  isAnyLoading: boolean;
  hasHungLoader: boolean;
  reportHang: (component: string, details?: any) => void;
  trackComponentMount: (componentName: string) => void;
  trackRender: (componentName: string) => void;
}

const LoadingStateContext = createContext<LoadingStateContextType | undefined>(undefined);

export const LoadingStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const {
    startLoading,
    stopLoading,
    forceStopAllLoading,
    isAnyLoading,
    hasHungLoader
  } = useLoadingCoordinator();

  const { reportHang } = useDebugMonitor({
    maxLoadingTime: 12000, // 12 seconds
    checkInterval: 3000, // Check every 3 seconds
    onHangDetected: (details) => {
      console.error('[LoadingState] Hang detected:', details);
      // Could send to analytics/monitoring service here
    }
  });

  const { trackComponentMount, trackRender } = usePerformanceMonitor();

  return (
    <LoadingStateContext.Provider
      value={{
        startLoading,
        stopLoading,
        forceStopAllLoading,
        isAnyLoading,
        hasHungLoader,
        reportHang,
        trackComponentMount,
        trackRender
      }}
    >
      {children}
    </LoadingStateContext.Provider>
  );
};

export const useLoadingState = (): LoadingStateContextType => {
  const context = useContext(LoadingStateContext);
  if (!context) {
    throw new Error('useLoadingState must be used within LoadingStateProvider');
  }
  return context;
};
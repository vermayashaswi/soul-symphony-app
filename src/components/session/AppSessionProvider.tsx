import React, { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { SessionTrackingProvider } from '@/contexts/SessionTrackingContext';
import { useNativeAppStateTracking } from '@/hooks/useNativeAppStateTracking';

interface AppSessionProviderProps {
  children: ReactNode;
}

export const AppSessionProvider: React.FC<AppSessionProviderProps> = ({ children }) => {
  const location = useLocation();
  
  // Set up native app state tracking
  useNativeAppStateTracking();
  
  // Only provide session tracking for /app routes
  const isAppRoute = location.pathname.startsWith('/app');
  
  if (!isAppRoute) {
    return <>{children}</>;
  }
  
  return (
    <SessionTrackingProvider>
      {children}
    </SessionTrackingProvider>
  );
};
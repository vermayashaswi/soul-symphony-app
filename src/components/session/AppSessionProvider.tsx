import React, { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { SessionTrackingProvider } from '@/contexts/SessionTrackingContext';

interface AppSessionProviderProps {
  children: ReactNode;
}

export const AppSessionProvider: React.FC<AppSessionProviderProps> = ({ children }) => {
  const location = useLocation();
  
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

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from './ProtectedRoute';
import MobilePreviewFrame from '@/components/MobilePreviewFrame';

// Check if this is running in a native mobile app environment
export const isNativeApp = (): boolean => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('nativeApp') === 'true' || 
         window.location.href.includes('capacitor://') || 
         window.location.href.includes('localhost');
};

// Check if the current route is an app route (starts with /app)
export const isAppRoute = (path: string): boolean => {
  return path.startsWith('/app');
};

interface RouteWrapperProps {
  children: React.ReactNode;
}

export const MobilePreviewWrapper: React.FC<RouteWrapperProps> = ({ children }) => {
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  return mobileDemo ? <MobilePreviewFrame>{children}</MobilePreviewFrame> : <>{children}</>;
};

interface AppRouteProps {
  element: React.ReactNode;
  requiresAuth?: boolean;
}

export const AppRouteWrapper: React.FC<AppRouteProps> = ({ element, requiresAuth }) => {
  const { user } = useAuth();
  const location = useLocation();
  
  // For auth route, redirect to home if already logged in
  if (location.pathname === '/app/auth' && user) {
    return <Navigate to="/app/home" replace />;
  }
  
  // Wrap in protection if needed
  if (requiresAuth) {
    return (
      <MobilePreviewWrapper>
        <ProtectedRoute>
          {element}
        </ProtectedRoute>
      </MobilePreviewWrapper>
    );
  }
  
  return <MobilePreviewWrapper>{element}</MobilePreviewWrapper>;
};

export const WebsiteRouteWrapper: React.FC<RouteWrapperProps> = ({ children }) => {
  return <MobilePreviewWrapper>{children}</MobilePreviewWrapper>;
};

interface RedirectRouteProps {
  to: string;
}

export const RedirectRoute: React.FC<RedirectRouteProps> = ({ to }) => {
  return <Navigate to={to} replace />;
};

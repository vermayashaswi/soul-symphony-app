
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
  
  // Redirect to app download page if not in native app
  if (!isNativeApp()) {
    return <Navigate to="/app-download" replace />;
  }
  
  // For auth route, redirect to home if already logged in
  if (location.pathname === '/auth' && user) {
    return <Navigate to="/home" replace />;
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

interface HomeRouteProps {
  element: React.ReactNode;
  onboardingElement: React.ReactNode;
}

export const HomeRouteWrapper: React.FC<HomeRouteProps> = ({ element, onboardingElement }) => {
  const { user } = useAuth();
  
  if (isNativeApp()) {
    if (user) {
      return <Navigate to="/home" replace />;
    } else {
      return <MobilePreviewWrapper>{element}</MobilePreviewWrapper>;
    }
  } else {
    // Website visitors see the landing page
    return <MobilePreviewWrapper>{element}</MobilePreviewWrapper>;
  }
};

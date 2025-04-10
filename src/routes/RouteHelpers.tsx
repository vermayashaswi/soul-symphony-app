
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
  
  // If we're in a browser but the URL is /app/*, check if it's an authorized app view
  if (!isNativeApp() && isAppRoute(location.pathname)) {
    // For auth route, allow access even in browser
    if (location.pathname === '/app/auth') {
      return <MobilePreviewWrapper>{element}</MobilePreviewWrapper>;
    }
    
    // For onboarding, allow access even in browser
    if (location.pathname === '/app' || location.pathname === '/app/onboarding') {
      return <MobilePreviewWrapper>{element}</MobilePreviewWrapper>;
    }
    
    // For other app routes in browser, redirect to download
    return <Navigate to="/app-download" replace />;
  }
  
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

interface HomeRouteProps {
  element: React.ReactNode;
  onboardingElement: React.ReactNode;
}

export const HomeRouteWrapper: React.FC<HomeRouteProps> = ({ element, onboardingElement }) => {
  const { user } = useAuth();
  const location = useLocation();
  
  if (isNativeApp()) {
    if (user) {
      return <Navigate to="/app/home" replace />;
    } else {
      // In native app with no user, show app onboarding
      return <Navigate to="/app" replace />;
    }
  } else {
    // Website visitors see the landing page
    return <MobilePreviewWrapper>{element}</MobilePreviewWrapper>;
  }
};

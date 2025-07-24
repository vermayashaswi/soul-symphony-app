import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { appRecoveryService } from '@/services/appRecoveryService';

interface SessionRouterProps {
  children: React.ReactNode;
  fallbackRoute?: string;
  requireAuth?: boolean;
}

export const SessionRouter: React.FC<SessionRouterProps> = ({ 
  children, 
  fallbackRoute = '/app/onboarding',
  requireAuth = false 
}) => {
  const { user, isLoading } = useAuth();
  const isNative = nativeIntegrationService.isRunningNatively();
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // Add timeout protection
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        console.warn('[SessionRouter] Loading timeout reached, triggering recovery');
        setHasTimedOut(true);
        appRecoveryService.triggerRecovery('session_router_timeout');
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
  }, [isLoading]);

  // If we've timed out and still loading, show fallback
  if (hasTimedOut && isLoading) {
    console.log('[SessionRouter] Timeout reached, proceeding without auth');
    return <Navigate to={fallbackRoute} replace />;
  }

  if (isLoading && !hasTimedOut) {
    // Loading state is now handled by UnifiedLoadingOverlay
    return null;
  }

  // Handle authentication requirements
  if (requireAuth && !user) {
    console.log('[SessionRouter] Auth required but no session, redirecting to:', fallbackRoute);
    return <Navigate to={fallbackRoute} replace />;
  }

  // For native apps with valid session, redirect authenticated users away from auth pages
  if (isNative && user) {
    const currentPath = window.location.pathname;
    const authPaths = ['/app/auth', '/app/onboarding', '/'];
    
    if (authPaths.includes(currentPath)) {
      console.log('[SessionRouter] Native app with session on auth path, redirecting to home');
      return <Navigate to="/app/home" replace />;
    }
  }

  return <>{children}</>;
};

export default SessionRouter;
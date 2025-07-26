import React from 'react';
import { useAppState } from '@/hooks/useAppState';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface RouteGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireOnboarding?: boolean;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({ 
  children, 
  requireAuth = false,
  requireOnboarding = false 
}) => {
  const { 
    isInitialized, 
    isInitializing, 
    isAuthenticated, 
    requiresOnboarding: needsOnboarding 
  } = useAppState();
  const location = useLocation();

  // Show loading during initialization
  if (isInitializing || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Auth required but user not authenticated
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/app/auth" state={{ from: location }} replace />;
  }

  // User is authenticated but needs onboarding
  if (isAuthenticated && needsOnboarding && !requireOnboarding) {
    return <Navigate to="/app/onboarding" replace />;
  }

  // Onboarding required but user doesn't need it
  if (requireOnboarding && isAuthenticated && !needsOnboarding) {
    return <Navigate to="/app/home" replace />;
  }

  return <>{children}</>;
};
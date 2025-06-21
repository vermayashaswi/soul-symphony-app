
import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/use-onboarding';

const ProtectedRoute: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { onboardingComplete, loading: onboardingLoading } = useOnboarding();
  const location = useLocation();
  
  console.log("ProtectedRoute - State:", { 
    user: !!user, 
    authLoading, 
    onboardingComplete, 
    onboardingLoading,
    path: location.pathname 
  });
  
  // Show loading while we're checking auth or onboarding status
  const isLoading = authLoading || onboardingLoading;
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // If no user, redirect to auth
  if (!user) {
    console.log("ProtectedRoute: No user, redirecting to auth");
    return <Navigate to="/app/auth" replace />;
  }
  
  // If user exists but onboarding is not complete, redirect to onboarding
  if (!onboardingComplete) {
    console.log("ProtectedRoute: User exists but onboarding not complete, redirecting to onboarding");
    return <Navigate to="/app/onboarding" replace />;
  }
  
  // Handle /app root path - redirect to home if user is authenticated and onboarded
  if (location.pathname === '/app' || location.pathname === '/app/') {
    console.log("ProtectedRoute: At /app root, redirecting to home");
    return <Navigate to="/app/home" replace />;
  }
  
  // User is authenticated and onboarded, render the protected content
  return <Outlet />;
};

export default ProtectedRoute;

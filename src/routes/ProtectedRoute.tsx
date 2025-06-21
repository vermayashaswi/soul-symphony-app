
import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/use-onboarding';

const ProtectedRoute: React.FC = () => {
  const { user, isLoading } = useAuth();
  const { onboardingComplete } = useOnboarding();
  const location = useLocation();
  
  console.log("ProtectedRoute - Auth state:", { 
    user: !!user, 
    isLoading, 
    onboardingComplete,
    path: location.pathname 
  });
  
  // Show loading only while auth is being checked
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // If not authenticated, redirect to auth
  if (!user) {
    console.log("Redirecting to auth from protected route:", location.pathname);
    return <Navigate to={`/app/auth?redirectTo=${location.pathname}`} replace />;
  }
  
  // Handle /app index route logic - redirect based on onboarding status
  if (location.pathname === '/app') {
    if (onboardingComplete) {
      console.log("User completed onboarding, redirecting to home");
      return <Navigate to="/app/home" replace />;
    } else {
      console.log("User has not completed onboarding, redirecting to onboarding");
      return <Navigate to="/app/onboarding" replace />;
    }
  }
  
  // For all other protected routes, render the child routes
  return <Outlet />;
};

export default ProtectedRoute;

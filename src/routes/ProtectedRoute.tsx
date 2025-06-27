
import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { detectTWAEnvironment } from '@/utils/twaDetection';

const ProtectedRoute: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  
  console.log('[ProtectedRoute] State:', { 
    hasUser: !!user, 
    isLoading, 
    path: location.pathname 
  });
  
  if (isLoading) {
    console.log('[ProtectedRoute] Auth is loading, showing spinner');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    console.log('[ProtectedRoute] No user found, redirecting to auth:', location.pathname);
    
    // In TWA environment, be more careful about redirects to avoid exit triggers
    const twaEnv = detectTWAEnvironment();
    const redirectPath = twaEnv.isTWA || twaEnv.isStandalone 
      ? `/app/auth?redirectTo=${encodeURIComponent(location.pathname)}`
      : `/app/auth?redirectTo=${encodeURIComponent(location.pathname)}`;
    
    return <Navigate to={redirectPath} replace />;
  }
  
  console.log('[ProtectedRoute] User authenticated, rendering protected content');
  
  // Use Outlet to render child routes
  return <Outlet />;
};

export default ProtectedRoute;

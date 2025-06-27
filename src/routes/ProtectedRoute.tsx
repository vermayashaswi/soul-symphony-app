
import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useSafeAuth } from '@/hooks/use-safe-auth';
import { detectTWAEnvironment } from '@/utils/twaDetection';

const ProtectedRoute: React.FC = () => {
  const location = useLocation();
  const { user, isLoading, error, isAvailable } = useSafeAuth();
  
  console.log('[ProtectedRoute] State:', { 
    hasUser: !!user, 
    isLoading, 
    error,
    isAvailable,
    path: location.pathname 
  });
  
  // If auth context is not available, show error message
  if (!isAvailable) {
    console.log('[ProtectedRoute] Auth context not available, showing error page');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-6 max-w-md">
          <h2 className="text-xl font-semibold mb-4">Authentication Loading</h2>
          <p className="text-muted-foreground mb-4">
            The authentication system is still initializing. Please wait a moment.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }
  
  // If there's an auth error, show it
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-6 max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-4">Authentication Error</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }
  
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

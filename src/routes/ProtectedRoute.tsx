
import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSession } from '@/providers/SessionProvider';

const ProtectedRoute: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const { recordActivity } = useSession();
  
  // Record activity when user accesses protected routes
  React.useEffect(() => {
    if (user) {
      recordActivity();
    }
  }, [user, recordActivity]);
  
  if (isLoading) {
    // Loading state is now handled by UnifiedLoadingOverlay
    return null;
  }
  
  if (!user) {
    console.log("[ProtectedRoute] REDIRECTING to auth from protected route:", location.pathname);
    
    // Store redirect path and go to auth
    localStorage.setItem('authRedirectTo', location.pathname);
    return <Navigate to="/app/auth" replace />;
  }
  
  // Use Outlet to render child routes
  return <Outlet />;
};

export default ProtectedRoute;


import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const ProtectedRoute = () => {
  console.log('[ProtectedRoute] Component mounting...');
  
  try {
    const { user, isLoading } = useAuth();
    
    console.log('[ProtectedRoute] Auth state:', { 
      hasUser: !!user, 
      userId: user?.id, 
      isLoading,
      userEmail: user?.email 
    });

    if (isLoading) {
      console.log('[ProtectedRoute] Still loading auth state, showing spinner');
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (!user) {
      console.log('[ProtectedRoute] No user found, redirecting to /app/auth');
      return <Navigate to="/app/auth" replace />;
    }

    console.log('[ProtectedRoute] User authenticated, rendering protected content');
    return <Outlet />;
  } catch (error) {
    console.error('[ProtectedRoute] Error in component:', error);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Authentication Error</h2>
          <p className="text-gray-600">{error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    );
  }
};

export default ProtectedRoute;

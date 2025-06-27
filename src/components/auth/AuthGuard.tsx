
import React, { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, fallback }) => {
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [authState, setAuthState] = useState<{
    user: any;
    isLoading: boolean;
  } | null>(null);

  useEffect(() => {
    console.log('[AuthGuard] Initializing auth guard...');
    
    // Add a small delay to ensure AuthProvider is fully initialized
    const initTimer = setTimeout(() => {
      try {
        console.log('[AuthGuard] Attempting to access auth context...');
        // This will throw if AuthProvider is not available
        const auth = useAuth();
        setAuthState({
          user: auth.user,
          isLoading: auth.isLoading
        });
        setIsReady(true);
        setHasError(false);
        console.log('[AuthGuard] Auth context accessed successfully');
      } catch (error) {
        console.error('[AuthGuard] Error accessing auth context:', error);
        setHasError(true);
        setIsReady(false);
        
        // Show user-friendly error
        toast.error('Authentication system is initializing. Please wait...');
      }
    }, 100);

    return () => clearTimeout(initTimer);
  }, []);

  // If there's an error accessing auth context
  if (hasError) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-6 max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-4">Authentication Loading</h2>
          <p className="text-muted-foreground mb-4">
            The authentication system is still starting up. Please wait a moment.
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

  // If auth guard is not ready yet
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthGuard;


import React, { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, fallback }) => {
  // Since we're now inside the router context, we can safely use useAuth
  try {
    const { isLoading } = useAuth();
    
    if (isLoading) {
      return fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center p-6 max-w-md">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <h2 className="text-xl font-semibold mb-2">Starting App</h2>
            <p className="text-muted-foreground">
              Initializing authentication system...
            </p>
          </div>
        </div>
      );
    }

    return <>{children}</>;
  } catch (error) {
    console.error('[AuthGuard] Auth context error:', error);
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-6 max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-4">Authentication Error</h2>
          <p className="text-muted-foreground mb-4">
            There was a problem with the authentication system. Please refresh the page.
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
};

export default AuthGuard;

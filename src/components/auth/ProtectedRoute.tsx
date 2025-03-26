
import { useState, useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/auth";
import { toast } from "sonner";
import { useDebugLogger } from "@/hooks/use-debug-logger";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, isLoading, refreshSession } = useAuth();
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  const { logInfo, logError } = useDebugLogger();
  const refreshAttemptedRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Try to refresh the session once when component mounts
  useEffect(() => {
    let isMounted = true;
    
    // Set a max timeout to prevent getting stuck in loading state
    timeoutRef.current = setTimeout(() => {
      if (isMounted && !authChecked) {
        logInfo('Force completing auth check due to timeout');
        setAuthChecked(true);
      }
    }, 1200); // Shorter timeout
    
    const checkAuth = async () => {
      // Only try to refresh once
      if (!user && !authChecked && !refreshAttemptedRef.current) {
        refreshAttemptedRef.current = true;
        logInfo("Protected route: No user found, attempting to refresh session");
        
        try {
          const refreshed = await refreshSession();
          
          // Only update state if the component is still mounted
          if (isMounted) {
            if (!refreshed) {
              logInfo("Session refresh failed, redirecting to auth");
            }
            setAuthChecked(true);
          }
        } catch (err) {
          logError("Error refreshing session:", err);
          if (isMounted) {
            setAuthChecked(true);
          }
        }
      } else if (user && !authChecked) {
        logInfo("Protected route: Tracking session for user", user.id, "on path", location.pathname);
        if (isMounted) {
          setAuthChecked(true);
        }
      }
    };
    
    checkAuth();
    
    return () => {
      isMounted = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [user, authChecked, refreshSession, location.pathname, logInfo, logError]);
  
  // If we have a user, render the protected content immediately
  if (user) {
    // Clean up timeout to prevent memory leaks
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    return <>{children}</>;
  }
  
  // Show minimal loading UI during the initial auth check
  if (isLoading && !authChecked) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-sm text-muted-foreground">Authenticating...</p>
        </div>
      </div>
    );
  }
  
  // If auth check is complete and no user is found, redirect to auth
  logInfo("Redirecting to auth from protected route:", location.pathname);
  return <Navigate to="/auth" state={{ from: location }} replace />;
};

export default ProtectedRoute;


import { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/auth";
import { toast } from "sonner";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, isLoading, refreshSession } = useAuth();
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  
  // Try to refresh the session once when component mounts
  useEffect(() => {
    let isMounted = true;
    
    const checkAuth = async () => {
      if (!user && !authChecked) {
        console.log("Protected route: No user found, attempting to refresh session");
        
        try {
          const refreshed = await refreshSession();
          
          // Only update state if the component is still mounted
          if (isMounted) {
            if (!refreshed) {
              console.log("Session refresh failed, redirecting to auth");
            }
            setAuthChecked(true);
          }
        } catch (err) {
          console.error("Error refreshing session:", err);
          if (isMounted) {
            setAuthChecked(true);
          }
        }
      } else if (user && !authChecked) {
        console.log("Protected route: Tracking session for user", user.id, "on path", location.pathname);
        if (isMounted) {
          setAuthChecked(true);
        }
      }
    };
    
    checkAuth();
    
    // Shorter timeout to prevent getting stuck
    const timeout = setTimeout(() => {
      if (isMounted && !authChecked) {
        console.log('Force completing auth check due to timeout');
        setAuthChecked(true);
      }
    }, 800);
    
    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [user, authChecked, refreshSession, location.pathname]);
  
  // If we have a user, render the protected content immediately
  if (user) {
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
  console.log("Redirecting to auth from protected route:", location.pathname);
  return <Navigate to="/auth" state={{ from: location }} replace />;
};

export default ProtectedRoute;

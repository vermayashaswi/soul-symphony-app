
import { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, isLoading, refreshSession } = useAuth();
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  
  // Try to refresh the session once when component mounts
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (!user && !authChecked) {
          console.log("Protected route: No user found, attempting to refresh session");
          await refreshSession();
        }
      } catch (err) {
        console.error("Error refreshing session:", err);
      } finally {
        setAuthChecked(true);
      }
    };
    
    checkAuth();
    
    // Force complete the check after a short timeout to prevent getting stuck
    const timeout = setTimeout(() => {
      if (!authChecked) {
        console.log('Force completing auth check due to timeout');
        setAuthChecked(true);
      }
    }, 1000); // Shorter timeout for faster fallback
    
    return () => clearTimeout(timeout);
  }, [user, authChecked, refreshSession]);
  
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

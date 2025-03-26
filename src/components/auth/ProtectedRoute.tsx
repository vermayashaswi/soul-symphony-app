
import { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { createOrUpdateSession, refreshAuthSession } from "@/utils/audio/auth-utils";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [refreshAttempted, setRefreshAttempted] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  
  // Force complete the loading state after a short timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading || !sessionChecked) {
        console.log('Force completing session check due to timeout');
        setSessionChecked(true);
        setRefreshAttempted(true);
      }
    }, 3000); // Reduced from 5000ms to 3000ms to improve user experience
    
    return () => clearTimeout(timeout);
  }, [isLoading, sessionChecked]);
  
  // Try to refresh the session if needed
  useEffect(() => {
    if (!isLoading && !user && !refreshAttempted) {
      console.log("Protected route: No user found, attempting to refresh session", {
        path: location.pathname
      });
      
      refreshAuthSession(false)
        .then(success => {
          console.log("Session refresh attempt completed:", success ? "Success" : "Failed");
          setRefreshAttempted(true);
          setSessionChecked(true);
        })
        .catch(() => {
          setRefreshAttempted(true);
          setSessionChecked(true);
        });
    } else if (!refreshAttempted && (user || isLoading)) {
      setSessionChecked(true);
    }
    
    if (user && !isLoading) {
      console.log("Protected route: Tracking session for user", user.id, "on path", location.pathname);
      
      // Update the session tracking without waiting for it to complete
      createOrUpdateSession(user.id, location.pathname)
        .catch(err => {
          console.error("Error tracking session:", err);
        });
    }
  }, [user, isLoading, location, refreshAttempted]);
  
  // Don't show loading state for too long
  if (isLoading && !sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // If we have a user, render the protected content
  if (user) {
    return <>{children}</>;
  }
  
  // If we've checked the session and still don't have a user, redirect to auth
  if (sessionChecked || refreshAttempted) {
    console.log("Redirecting to auth from protected route:", location.pathname);
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  
  // Fallback loading state - this should rarely be seen due to the timeout
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
};

export default ProtectedRoute;

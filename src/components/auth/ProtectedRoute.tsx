
import { useState, useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/auth";
import { createOrUpdateSession } from "@/utils/audio/auth-profile";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, isLoading, refreshSession } = useAuth();
  const location = useLocation();
  const [refreshAttempted, setRefreshAttempted] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const refreshAttemptedRef = useRef(false);
  
  // Force complete the loading state after a short timeout to prevent getting stuck
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!sessionChecked) {
        console.log('Force completing session check due to timeout');
        setSessionChecked(true);
        setRefreshAttempted(true);
        setIsCheckingAuth(false);
      }
    }, 1500); // Reduced timeout for faster fallback
    
    return () => clearTimeout(timeout);
  }, [sessionChecked]);
  
  // Try to refresh the session if needed - with simplified logic
  useEffect(() => {
    const handleSessionRefresh = async () => {
      // Skip if we already have user, already tried refreshing, or are still loading
      if (user || refreshAttemptedRef.current || !isCheckingAuth) {
        return;
      }
      
      console.log("Protected route: No user found, attempting to refresh session", {
        path: location.pathname
      });
      
      // Mark as attempted to prevent duplicate refresh attempts
      refreshAttemptedRef.current = true;
      setRefreshAttempted(true);
      
      try {
        setIsCheckingAuth(true);
        const success = await refreshSession();
        console.log("Session refresh attempt completed:", success ? "Success" : "Failed");
        
        setSessionChecked(true);
        setIsCheckingAuth(false);
      } catch (err) {
        console.error("Error refreshing session but continuing:", err);
        setRefreshAttempted(true);
        setSessionChecked(true);
        setIsCheckingAuth(false);
      }
    };
    
    handleSessionRefresh();
    
    // If we have a user, track the session silently
    if (user) {
      console.log("Protected route: Tracking session for user", user.id, "on path", location.pathname);
      
      // Update the session tracking without waiting for it to complete
      createOrUpdateSession(user.id, location.pathname)
        .catch(err => {
          console.error("Error tracking session but continuing:", err);
        });
        
      // Mark session as checked since we have a user
      if (!sessionChecked) {
        setSessionChecked(true);
        setRefreshAttempted(true);
        setIsCheckingAuth(false);
      }
    }
  }, [
    user, 
    isLoading, 
    location, 
    refreshAttempted, 
    refreshSession, 
    sessionChecked,
    isCheckingAuth
  ]);
  
  // If we have a user, render the protected content immediately
  if (user) {
    return <>{children}</>;
  }
  
  // If we've checked the session, completed loading, and still don't have a user, redirect to auth
  if ((sessionChecked && refreshAttempted) || !isLoading || !isCheckingAuth) {
    console.log("Redirecting to auth from protected route:", location.pathname);
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  
  // Show minimal loading UI with a shorter delay
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p className="text-sm text-muted-foreground">Authenticating...</p>
      </div>
    </div>
  );
};

export default ProtectedRoute;


import { useState, useEffect } from "react";
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
  const [retryCount, setRetryCount] = useState(0);
  const [silentError, setSilentError] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // Force complete the loading state after a short timeout to prevent getting stuck
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!sessionChecked) {
        console.log('Force completing session check due to timeout');
        setSessionChecked(true);
        setRefreshAttempted(true);
        setIsCheckingAuth(false);
      }
    }, 2000); // Reduced timeout for faster fallback
    
    return () => clearTimeout(timeout);
  }, [sessionChecked]);
  
  // Try to refresh the session if needed - with error handling
  useEffect(() => {
    const handleSessionRefresh = async () => {
      // Skip if we already have user, already tried refreshing, are still loading, or have error
      if (user || refreshAttempted || !isCheckingAuth || silentError) {
        return;
      }
      
      console.log("Protected route: No user found, attempting to refresh session", {
        path: location.pathname
      });
      
      try {
        setIsCheckingAuth(true);
        const success = await refreshSession();
        console.log("Session refresh attempt completed:", success ? "Success" : "Failed");
        
        // If refresh failed but we haven't exceeded retry limit, try again
        if (!success && retryCount < 1) { // Reduced retry count to minimize flickering
          console.log(`Session refresh failed, retrying (${retryCount + 1}/1)...`);
          setRetryCount(prev => prev + 1);
          
          // Add a small delay before retrying
          setTimeout(() => {
            setRefreshAttempted(false);
          }, 500);
          
          return;
        }
        
        setRefreshAttempted(true);
        setSessionChecked(true);
        setIsCheckingAuth(false);
      } catch (err) {
        console.error("Error refreshing session but continuing:", err);
        setSilentError(true);
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
    retryCount, 
    silentError, 
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
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
};

export default ProtectedRoute;

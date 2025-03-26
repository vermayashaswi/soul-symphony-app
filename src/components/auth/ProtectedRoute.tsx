
import { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { createOrUpdateSession } from "@/utils/audio/auth-utils";
import { Skeleton } from "@/components/ui/skeleton";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, isLoading, refreshSession } = useAuth();
  const location = useLocation();
  const [refreshAttempted, setRefreshAttempted] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  
  // Force complete the loading state after a shorter timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!sessionChecked) {
        console.log('Force completing session check due to timeout');
        setSessionChecked(true);
        setRefreshAttempted(true);
      }
    }, 1000); // Reduced timeout to prevent long loading screens
    
    return () => clearTimeout(timeout);
  }, [sessionChecked]);
  
  // Try to refresh the session if needed
  useEffect(() => {
    const handleSessionRefresh = async () => {
      if (!user && !refreshAttempted && !isLoading) {
        console.log("Protected route: No user found, attempting to refresh session", {
          path: location.pathname
        });
        
        try {
          const success = await refreshSession();
          console.log("Session refresh attempt completed:", success ? "Success" : "Failed");
        } catch (err) {
          console.error("Error refreshing session:", err);
        } finally {
          setRefreshAttempted(true);
          setSessionChecked(true);
        }
      } else if (!refreshAttempted || user) {
        // We either have a user or we've completed loading
        setSessionChecked(true);
        setRefreshAttempted(true);
      }
    };
    
    handleSessionRefresh();
    
    if (user) {
      console.log("Protected route: Tracking session for user", user.id, "on path", location.pathname);
      
      // Update the session tracking without waiting for it to complete
      createOrUpdateSession(user.id, location.pathname)
        .catch(err => {
          console.error("Error tracking session:", err);
        });
    }
  }, [user, isLoading, location, refreshAttempted, refreshSession]);
  
  // If we have a user, render the protected content immediately
  if (user) {
    return <>{children}</>;
  }
  
  // If we've checked the session, completed loading, and still don't have a user, redirect to auth
  if ((sessionChecked && refreshAttempted) || !isLoading) {
    console.log("Redirecting to auth from protected route:", location.pathname);
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  
  // Show minimal loading UI with a shorter delay
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="flex justify-center mb-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
        <Skeleton className="h-12 w-full rounded-md" />
        <Skeleton className="h-24 w-full rounded-md" />
      </div>
    </div>
  );
};

export default ProtectedRoute;

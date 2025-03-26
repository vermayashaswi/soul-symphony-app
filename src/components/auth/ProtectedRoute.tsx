
import { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { createOrUpdateSession, refreshAuthSession } from "@/utils/audio/auth-utils";
import { Skeleton } from "@/components/ui/skeleton";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, isLoading, refreshSession } = useAuth();
  const location = useLocation();
  const [refreshAttempted, setRefreshAttempted] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  
  // Force complete the loading state after a short timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!sessionChecked) {
        console.log('Force completing session check due to timeout');
        setSessionChecked(true);
        setRefreshAttempted(true);
      }
    }, 2000); // Balanced timeout that's not too short or long
    
    return () => clearTimeout(timeout);
  }, [sessionChecked]);
  
  // Try to refresh the session if needed
  useEffect(() => {
    const handleSessionRefresh = async () => {
      if (!user && !refreshAttempted) {
        console.log("Protected route: No user found, attempting to refresh session", {
          path: location.pathname
        });
        
        try {
          // Use the AuthContext refreshSession method instead for better state management
          const success = await refreshSession();
          console.log("Session refresh attempt completed:", success ? "Success" : "Failed");
        } catch (err) {
          console.error("Error refreshing session:", err);
        } finally {
          setRefreshAttempted(true);
          setSessionChecked(true);
        }
      } else if (!refreshAttempted) {
        // Either we have a user or we're still loading
        setSessionChecked(true);
      }
    };
    
    if (!isLoading) {
      handleSessionRefresh();
    }
    
    if (user) {
      console.log("Protected route: Tracking session for user", user.id, "on path", location.pathname);
      
      // Update the session tracking without waiting for it to complete
      createOrUpdateSession(user.id, location.pathname)
        .catch(err => {
          console.error("Error tracking session:", err);
        });
    }
  }, [user, isLoading, location, refreshAttempted, refreshSession]);
  
  // If we have a user, render the protected content
  if (user) {
    return <>{children}</>;
  }
  
  // If we've checked the session and still don't have a user, redirect to auth
  if (sessionChecked || refreshAttempted) {
    console.log("Redirecting to auth from protected route:", location.pathname);
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  
  // Better loading UI with skeleton components
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Skeleton className="h-12 w-full rounded-md" />
        <Skeleton className="h-32 w-full rounded-md" />
        <Skeleton className="h-12 w-3/4 rounded-md mx-auto" />
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    </div>
  );
};

export default ProtectedRoute;

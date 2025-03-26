
import { useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth";
import { hasAuthParams } from "@/utils/auth-utils";
import { useDebugLogger } from "@/hooks/use-debug-logger";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AuthStateListener = () => {
  const { user, refreshSession } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const initializeAttemptedRef = useRef(false);
  const handleAuthTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { logInfo, logError } = useDebugLogger();
  
  // Handle OAuth redirects that come with tokens in the URL
  useEffect(() => {
    // Prevent multiple initializations with a strong guard
    if (initializeAttemptedRef.current) {
      logInfo("AuthStateListener already initialized, skipping duplicate setup");
      return;
    }
    
    initializeAttemptedRef.current = true;
    logInfo("AuthStateListener: Setting up authentication listener");
    
    const handleAuthRedirection = () => {
      // Skip if on auth-related pages
      if (location.pathname === '/callback' || 
          location.pathname === '/auth/callback' || 
          location.pathname === '/auth') {
        return;
      }
      
      // Check if we have an auth token at any path (not just root)
      if (hasAuthParams()) {
        logInfo("AuthStateListener: Detected OAuth token or code in URL, redirecting to callback");
        
        // Redirect to the callback route with the hash and search params intact
        const callbackUrl = '/auth/callback' + location.search + location.hash;
        navigate(callbackUrl, { replace: true });
        return;
      }
    };
    
    // Handle any auth redirects in the URL - with error catching
    try {
      handleAuthRedirection();
    } catch (error) {
      logError("Error handling auth redirection:", error);
    }
    
    // Set up a periodic session check
    const sessionCheckInterval = setInterval(async () => {
      try {
        // Only check if we believe the user should be authenticated
        const authSuccess = localStorage.getItem('auth_success') === 'true';
        
        if (authSuccess && !user) {
          logInfo("Session check: We believe user should be authenticated but no user object exists");
          
          // Try to refresh the session
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            logError("Error getting session during check:", error);
            // Show a session error toast to inform user
            toast.error("Session error detected. Please try signing in again.");
            localStorage.removeItem('auth_success');
            return;
          }
          
          if (data.session) {
            logInfo("Found session during check, refreshing app state");
            const refreshResult = await refreshSession();
            logInfo("Session refresh result:", refreshResult ? "Success" : "Failed");
            
            // If on index page with valid session, redirect to journal
            if (refreshResult && location.pathname === '/') {
              logInfo("Redirecting to journal after session refresh");
              navigate('/journal');
            }
          } else {
            logInfo("No session found during check, clearing auth success flag");
            localStorage.removeItem('auth_success');
            
            // If trying to access protected page with no session, redirect to auth
            if (location.pathname !== '/' && location.pathname !== '/auth') {
              logInfo("Redirecting to auth page since no session was found");
              navigate('/auth');
            }
          }
        }
      } catch (e) {
        logError("Error in session check interval:", e);
      }
    }, 10000); // Check every 10 seconds
    
    return () => {
      logInfo("Cleaning up AuthStateListener");
      clearInterval(sessionCheckInterval);
      
      // Clear any pending timeouts
      if (handleAuthTimeoutRef.current) {
        clearTimeout(handleAuthTimeoutRef.current);
      }
      
      // Only reset the flag on actual unmount, not just re-renders
      document.addEventListener('beforeunload', () => {
        initializeAttemptedRef.current = false;
      }, { once: true });
    };
  }, [location.pathname, location.hash, location.search, navigate, logInfo, logError, refreshSession, user]);

  // Force session check when on index page and user appears to be logged in
  useEffect(() => {
    if (location.pathname === '/' && localStorage.getItem('auth_success') === 'true' && !user) {
      logInfo("Index page: User should be logged in but no user object exists, checking session");
      
      // Set a short timeout to avoid immediate execution
      const checkSessionTimeout = setTimeout(async () => {
        try {
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            logError("Error getting session on index page:", error);
            return;
          }
          
          if (data.session) {
            logInfo("Found valid session on index page, redirecting to journal");
            await refreshSession();
            navigate('/journal');
          }
        } catch (e) {
          logError("Error in index page session check:", e);
        }
      }, 500);
      
      return () => clearTimeout(checkSessionTimeout);
    }
  }, [location.pathname, navigate, user, refreshSession, logInfo, logError]);

  return null;
};

export default AuthStateListener;


import { useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth";
import { hasAuthParams } from "@/utils/auth-utils";
import { useDebugLogger } from "@/hooks/use-debug-logger";
import { supabase } from "@/integrations/supabase/client";

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
            return;
          }
          
          if (data.session) {
            logInfo("Found session during check, refreshing app state");
            await refreshSession();
          } else {
            logInfo("No session found during check, clearing auth success flag");
            localStorage.removeItem('auth_success');
          }
        }
      } catch (e) {
        logError("Error in session check interval:", e);
      }
    }, 30000); // Every 30 seconds
    
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

  return null;
};

export default AuthStateListener;


import { useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth";
import { hasAuthParams } from "@/utils/auth-utils";
import { useDebugLogger } from "@/hooks/use-debug-logger";

const AuthStateListener = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const initializeAttemptedRef = useRef(false);
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
    
    return () => {
      logInfo("Cleaning up AuthStateListener");
      // Only reset the flag on actual unmount, not just re-renders
      document.addEventListener('beforeunload', () => {
        initializeAttemptedRef.current = false;
      }, { once: true });
    };
  }, [location.pathname, location.hash, location.search, navigate, logInfo, logError]);

  return null;
};

export default AuthStateListener;

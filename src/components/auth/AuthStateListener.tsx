
import { useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth";
import { hasAuthParams } from "@/utils/auth-utils";

const AuthStateListener = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const initializeAttemptedRef = useRef(false);
  
  // Handle OAuth redirects that come with tokens in the URL
  useEffect(() => {
    // Prevent multiple initializations
    if (initializeAttemptedRef.current) {
      return;
    }
    
    initializeAttemptedRef.current = true;
    console.log("AuthStateListener: Setting up authentication listener");
    
    const handleAuthRedirection = () => {
      // Skip if on auth-related pages
      if (location.pathname === '/callback' || 
          location.pathname === '/auth/callback' || 
          location.pathname === '/auth') {
        return;
      }
      
      // Check if we have an auth token at any path (not just root)
      if (hasAuthParams()) {
        console.log("AuthStateListener: Detected OAuth token or code in URL, redirecting to callback");
        
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
      console.error("Error handling auth redirection:", error);
    }
    
    return () => {
      console.log("Cleaning up AuthStateListener");
    };
  }, [location.pathname, location.hash, location.search, navigate]);

  return null;
};

export default AuthStateListener;

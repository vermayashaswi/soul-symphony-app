
import { useEffect, useCallback, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth";
import { supabase } from "@/integrations/supabase/client";
import { createOrUpdateSession } from "@/utils/audio/auth-profile";
import { endUserSession } from "@/utils/audio/auth-session";
import { useJournalHandler } from "@/hooks/use-journal-handler";
import { toast } from "sonner";

const AuthStateListener = () => {
  const { user, refreshSession } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { processUnprocessedEntries } = useJournalHandler(user?.id);
  const [storageAccessFailed, setStorageAccessFailed] = useState(false);
  const [processAttempted, setProcessAttempted] = useState(false);
  const [isProcessingAuthEvent, setIsProcessingAuthEvent] = useState(false);
  const initializeAttemptedRef = useRef(false);
  const authListenerRef = useRef<{ subscription?: { unsubscribe: () => void } } | null>(null);
  
  // Create a function to process entries with retry logic
  const safelyProcessEntries = useCallback(async () => {
    if (!user?.id || processAttempted) return;
    
    setProcessAttempted(true);

    // Check if user profile exists before processing entries
    try {
      // Skip the profile check and just try to process
      console.log("Processing unprocessed journal entries");
      
      try {
        await processUnprocessedEntries();
        console.log("Successfully processed entries");
      } catch (err) {
        console.error("Error in processing entries but continuing:", err);
      }
    } catch (err) {
      console.error("Error in safelyProcessEntries but continuing:", err);
    }
  }, [user?.id, processUnprocessedEntries, processAttempted]);
  
  // Handle OAuth redirects that come with tokens in the URL
  useEffect(() => {
    // Prevent multiple initializations
    if (initializeAttemptedRef.current) {
      console.log("AuthStateListener already initialized, skipping duplicate setup");
      return;
    }
    
    initializeAttemptedRef.current = true;
    console.log("AuthStateListener: Setting up authentication listener");
    
    const handleAuthRedirection = () => {
      // Skip if already processing or on auth-related pages
      if (isProcessingAuthEvent || 
          location.pathname === '/callback' || 
          location.pathname === '/auth/callback' || 
          location.pathname === '/auth') {
        return;
      }
      
      // Check if we have an auth token at any path (not just root)
      if ((location.hash && 
          (location.hash.includes('access_token') || 
           location.hash.includes('id_token') ||
           location.hash.includes('type=recovery'))) ||
          (location.search && 
          (location.search.includes('code=') || 
           location.search.includes('state=')))) {
        console.log("AuthStateListener: Detected OAuth token or code in URL, redirecting to callback");
        
        setIsProcessingAuthEvent(true);
        
        // Redirect to the callback route with the hash and search params intact
        const callbackUrl = '/callback' + location.search + location.hash;
        navigate(callbackUrl, { replace: true });
        return;
      }
    };
    
    // Handle any auth redirects in the URL - with error catching
    try {
      handleAuthRedirection();
    } catch (error) {
      console.error("Error handling auth redirection:", error);
      setIsProcessingAuthEvent(false);
    }
    
    // Set up auth state change listener with error handling
    try {
      // Clean up previous subscription if it exists
      if (authListenerRef.current?.subscription) {
        authListenerRef.current.subscription.unsubscribe();
      }
      
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log("Auth event:", event, "User:", session?.user?.email);
        
        // Handle auth events - simplified to reduce complexity
        if (event === 'SIGNED_IN' && session?.user) {
          console.log("SIGNED_IN event detected for:", session.user.id);
          
          try {
            // Only update session silently - no toast notifications here
            await createOrUpdateSession(session.user.id, window.location.pathname);
            
            // Reset process attempted flag on new login
            setProcessAttempted(false);
            
            // Process unprocessed entries after sign in, with delay and only once
            if (user?.id !== session.user.id) {
              setTimeout(() => {
                safelyProcessEntries().catch(err => {
                  console.error("Error in delayed entry processing but continuing:", err);
                });
              }, 3000);
            }
          } catch (err) {
            console.error("Error creating session on sign in but continuing:", err);
          } finally {
            setIsProcessingAuthEvent(false);
          }
        } else if (event === 'SIGNED_OUT') {
          if (user) {
            console.log("SIGNED_OUT event detected for:", user.id);
            toast.info('Signed out successfully');
            
            try {
              await endUserSession(user.id);
            } catch (err) {
              console.error("Error ending session on sign out but continuing:", err);
            }
          }
          
          // Reset flags on sign out
          setProcessAttempted(false);
          setIsProcessingAuthEvent(false);
        }
      });
      
      authListenerRef.current = { subscription: data.subscription };
    } catch (error) {
      console.error("Error setting up auth state listener:", error);
      setStorageAccessFailed(true);
      setIsProcessingAuthEvent(false);
    }
    
    // Check initial session - simplified to reduce session refresh attempts
    const checkInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Initial session check error but continuing:", error);
          setIsProcessingAuthEvent(false);
          return;
        }
        
        if (data.session) {
          console.log("Initial session present:", {
            userId: data.session.user.id,
            email: data.session.user.email,
            expiresAt: new Date(data.session.expires_at * 1000).toISOString(),
          });
          
          // Only create/update session silently - no toast notifications
          try {
            await createOrUpdateSession(data.session.user.id, window.location.pathname);
          } catch (err) {
            console.error("Error tracking initial session but continuing:", err);
          }
          
          // Process unprocessed journal entries once on initial load
          if (!processAttempted) {
            setTimeout(() => {
              safelyProcessEntries().catch(err => {
                console.error("Error in delayed initial processing but continuing:", err);
              });
            }, 3000);
          }
        } else {
          console.log("No initial session found");
          
          // Only try to refresh session if at a protected route
          const isProtectedRoute = !['/auth', '/callback', '/auth/callback', '/'].includes(location.pathname);
          
          if (isProtectedRoute) {
            console.log("Protected route without session, attempting refresh");
            refreshSession().catch(err => {
              console.error("Error refreshing session on initial load but continuing:", err);
            });
          }
        }
        
        setIsProcessingAuthEvent(false);
      } catch (err) {
        console.error("Exception checking initial session but continuing:", err);
        setStorageAccessFailed(true);
        setIsProcessingAuthEvent(false);
      }
    };
    
    // Check initial session with a small delay
    setTimeout(checkInitialSession, 500);
    
    return () => {
      console.log("Cleaning up AuthStateListener");
      if (authListenerRef.current?.subscription) {
        authListenerRef.current.subscription.unsubscribe();
        authListenerRef.current = null;
      }
    };
  }, [
    location.pathname, 
    location.hash, 
    location.search, 
    navigate, 
    user, 
    safelyProcessEntries, 
    refreshSession, 
    processAttempted, 
    isProcessingAuthEvent
  ]);

  return null;
};

export default AuthStateListener;

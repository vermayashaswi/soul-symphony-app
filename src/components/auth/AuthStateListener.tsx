
import { useEffect, useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { createOrUpdateSession, endUserSession } from "@/utils/audio/auth-utils";
import { useJournalHandler } from "@/hooks/use-journal-handler";
import { toast } from "sonner";

const AuthStateListener = () => {
  const { user, refreshSession } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { processUnprocessedEntries } = useJournalHandler(user?.id);
  const [storageAccessFailed, setStorageAccessFailed] = useState(false);
  const [processAttempted, setProcessAttempted] = useState(false);
  
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
    console.log("AuthStateListener: Setting up authentication listener");
    
    const handleAuthRedirection = () => {
      // Skip handling token redirects if we're already on callback or auth routes
      if (location.pathname === '/callback' || 
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
    }
    
    // Set up auth state change listener with error handling
    let subscription;
    
    try {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log("Auth event:", event, "User:", session?.user?.email);
        
        // Only handle SIGNED_IN event when needed to avoid duplicate processing
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
        }
      });
      
      subscription = data.subscription;
    } catch (error) {
      console.error("Error setting up auth state listener:", error);
      setStorageAccessFailed(true);
    }
    
    // Check initial session - with error handling
    const checkInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Initial session check error but continuing:", error);
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
          
          // Process unprocessed journal entries on initial load with delay
          setTimeout(() => {
            if (!processAttempted) {
              safelyProcessEntries().catch(err => {
                console.error("Error in delayed initial processing but continuing:", err);
              });
            }
          }, 3000);
        } else {
          console.log("No initial session found");
          
          // Force a refresh of the session on initial load if no session is found
          refreshSession().catch(err => {
            console.error("Error refreshing session on initial load but continuing:", err);
          });
        }
      } catch (err) {
        console.error("Exception checking initial session but continuing:", err);
        setStorageAccessFailed(true);
      }
    };
    
    // Check initial session with a small delay to avoid rapid requests
    setTimeout(checkInitialSession, 500);
    
    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [location.pathname, location.hash, location.search, navigate, user, safelyProcessEntries, refreshSession, processAttempted]);

  return null;
};

export default AuthStateListener;

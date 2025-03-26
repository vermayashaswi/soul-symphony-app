
import { useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { createOrUpdateSession, endUserSession } from "@/utils/audio/auth-utils";
import { useJournalHandler } from "@/hooks/use-journal-handler";

const AuthStateListener = () => {
  const { user, refreshSession } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { processUnprocessedEntries } = useJournalHandler(user?.id);
  
  // Create a function to process entries with retry logic
  const safelyProcessEntries = useCallback(async () => {
    if (!user?.id) return;
    
    // Check if user profile exists before processing entries
    try {
      const { data: profileCheck } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
        
      if (profileCheck) {
        console.log("Processing unprocessed journal entries");
        
        // Add retry logic for network failures
        const maxRetries = 3;
        let currentRetry = 0;
        
        while (currentRetry < maxRetries) {
          try {
            await processUnprocessedEntries();
            console.log("Successfully processed entries");
            return; // Success!
          } catch (err) {
            currentRetry++;
            console.warn(`Entry processing attempt ${currentRetry} failed:`, err);
            
            if (currentRetry >= maxRetries) {
              console.error("Failed to process entries after all retries");
              break;
            }
            
            // Wait before retrying with exponential backoff
            await new Promise(resolve => 
              setTimeout(resolve, 1000 * Math.pow(2, currentRetry - 1))
            );
          }
        }
      } else {
        console.log("Skipping entry processing - user profile not fully set up yet");
      }
    } catch (err) {
      console.error("Error checking profile or processing entries:", err);
    }
  }, [user?.id, processUnprocessedEntries]);
  
  // Handle OAuth redirects that come with tokens in the URL
  useEffect(() => {
    console.log("AuthStateListener: Setting up authentication listener");
    
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
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth event:", event, "User:", session?.user?.email);
      
      // Only handle SIGNED_IN event when needed - prevent duplicate notifications
      if (event === 'SIGNED_IN' && session?.user) {
        console.log("SIGNED_IN event detected for:", session.user.id);
        
        try {
          // Only update session silently - no toast notifications here
          await createOrUpdateSession(session.user.id, window.location.pathname);
          
          // Process unprocessed entries after sign in, but with delay and only if user is fully set up
          if (user?.id !== session.user.id) {
            setTimeout(() => {
              safelyProcessEntries();
            }, 3000);
          }
        } catch (err) {
          console.error("Error creating session on sign in but continuing:", err);
        }
      } else if (event === 'SIGNED_OUT' && user) {
        console.log("SIGNED_OUT event detected for:", user.id);
        
        try {
          await endUserSession(user.id);
        } catch (err) {
          console.error("Error ending session on sign out but continuing:", err);
        }
      }
    });
    
    // Check initial session
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
            safelyProcessEntries();
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
      }
    };
    
    // Check initial session with a small delay
    setTimeout(checkInitialSession, 500);
    
    return () => {
      subscription.unsubscribe();
    };
  }, [location.pathname, location.hash, location.search, navigate, user, safelyProcessEntries, refreshSession]);

  return null;
};

export default AuthStateListener;

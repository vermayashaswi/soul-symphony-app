
import { useEffect } from "react";
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
            setTimeout(async () => {
              try {
                // Check if user profile exists before processing entries
                const { data: profileCheck } = await supabase
                  .from('profiles')
                  .select('id')
                  .eq('id', session.user.id)
                  .maybeSingle();
                  
                if (profileCheck) {
                  console.log("Processing unprocessed journal entries after sign in");
                  await processUnprocessedEntries();
                } else {
                  console.log("Skipping entry processing - user profile not fully set up yet");
                }
              } catch (err) {
                console.error("Error processing entries after sign in:", err);
              }
            }, 3000);
          }
        } catch (err) {
          console.error("Error creating session on sign in:", err);
        }
      } else if (event === 'SIGNED_OUT' && user) {
        console.log("SIGNED_OUT event detected for:", user.id);
        
        try {
          await endUserSession(user.id);
        } catch (err) {
          console.error("Error ending session on sign out:", err);
        }
      }
    });
    
    // Check initial session
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Initial session check error:", error);
      } else if (data.session) {
        console.log("Initial session present:", {
          userId: data.session.user.id,
          email: data.session.user.email,
          expiresAt: new Date(data.session.expires_at * 1000).toISOString(),
        });
        
        // Only create/update session silently - no toast notifications
        createOrUpdateSession(data.session.user.id, window.location.pathname)
          .catch(err => {
            console.error("Error tracking initial session:", err);
          });
          
        // Process unprocessed journal entries on initial load, but only if profile exists
        setTimeout(async () => {
          try {
            // Check if user profile exists before processing entries
            const { data: profileCheck } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', data.session.user.id)
              .maybeSingle();
              
            if (profileCheck) {
              console.log("Processing unprocessed journal entries on initial load");
              await processUnprocessedEntries();
            } else {
              console.log("Skipping entry processing - user profile not fully set up yet");
            }
          } catch (err) {
            console.error("Error processing entries on initial load:", err);
          }
        }, 3000);
      } else {
        console.log("No initial session found");
        // Force a refresh of the session on initial load if no session is found
        refreshSession().catch(err => {
          console.error("Error refreshing session on initial load:", err);
        });
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [location.pathname, location.hash, location.search, navigate, user, processUnprocessedEntries, refreshSession]);

  return null;
};

export default AuthStateListener;

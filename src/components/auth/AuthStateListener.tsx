
import { useEffect } from "react";
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
  
  useEffect(() => {
    console.log("Setting up Supabase auth debugging listener");
    console.log("Current route:", location.pathname);
    console.log("Current hash:", location.hash ? "Present (contains tokens)" : "None");
    
    // Improved OAuth redirect detection
    const isOAuthRedirect = 
      location.hash.includes('access_token') || 
      location.search.includes('error') ||
      location.hash.includes('type=recovery') ||
      location.pathname.includes('callback');
    
    // If we're at the root and have an auth token in the hash, redirect to the callback route
    if (location.pathname === '/' && location.hash.includes('access_token')) {
      console.log("Detected OAuth token in URL hash at root path, redirecting to callback");
      // Instead of processing here, redirect to the callback route with the hash intact
      navigate('/callback' + location.hash, { replace: true });
      return;
    }
    
    // Only process auth redirects if we're not on the dedicated callback page
    // Let the callback component handle its own logic
    if (isOAuthRedirect && location.pathname !== '/callback') {
      console.log("Detected OAuth redirect", {
        hash: location.hash ? "Present (contains tokens)" : "None",
        search: location.search,
        pathname: location.pathname
      });
      
      // Redirect to the callback route with the hash
      if (location.hash.includes('access_token')) {
        navigate('/callback' + location.hash, { replace: true });
        return;
      }
    }
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth event:", event, "User:", session?.user?.email);
      
      if (event === 'SIGNED_IN' && session?.user) {
        console.log("SIGNED_IN event detected - creating session for", session.user.id);
        
        try {
          const result = await createOrUpdateSession(session.user.id, window.location.pathname);
          console.log("Session creation result:", result);
          
          // Process unprocessed journal entries after sign in
          setTimeout(async () => {
            try {
              console.log("Processing unprocessed journal entries after sign in");
              const result = await processUnprocessedEntries();
              console.log("Processing result:", result);
            } catch (err) {
              console.error("Error processing entries after sign in:", err);
            }
          }, 3000); // Reduced wait time slightly
          
        } catch (err) {
          console.error("Error creating session on sign in:", err);
        }
      } else if (event === 'SIGNED_OUT' && user) {
        console.log("SIGNED_OUT event detected - ending session for", user.id);
        
        try {
          await endUserSession(user.id);
        } catch (err) {
          console.error("Error ending session on sign out:", err);
        }
      }
    });
    
    // Check initial session - especially important for hash callbacks
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Initial session check error:", error);
      } else if (data.session) {
        console.log("Initial session present:", {
          userId: data.session.user.id,
          email: data.session.user.email,
          expiresAt: new Date(data.session.expires_at * 1000).toISOString(),
        });
        
        createOrUpdateSession(data.session.user.id, window.location.pathname)
          .catch(err => {
            console.error("Error tracking initial session:", err);
          });
          
        // Process unprocessed journal entries on initial load
        setTimeout(async () => {
          try {
            console.log("Processing unprocessed journal entries on initial load");
            const result = await processUnprocessedEntries();
            console.log("Processing result:", result);
          } catch (err) {
            console.error("Error processing entries on initial load:", err);
          }
        }, 3000);
      } else {
        console.log("No initial session found");
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [user, location.pathname, processUnprocessedEntries, location.hash, location.search, navigate, refreshSession]);
  
  return null;
};

export default AuthStateListener;

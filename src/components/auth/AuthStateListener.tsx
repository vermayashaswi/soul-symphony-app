
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
    
    // Check if we're on a callback URL from OAuth
    const isOAuthRedirect = 
      location.hash.includes('access_token') || 
      location.search.includes('error') ||
      location.hash.includes('type=recovery');
    
    if (isOAuthRedirect) {
      console.log("Detected OAuth redirect URL", {
        hash: location.hash,
        search: location.search
      });
      
      // Let the auth system handle it, then redirect
      setTimeout(async () => {
        await refreshSession();
        if (location.pathname === '/404' || location.pathname.includes('callback')) {
          console.log("Redirecting from 404/callback to /journal");
          navigate('/journal', { replace: true });
        }
      }, 1000);
    }
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth event:", event, "User:", session?.user?.email);
      
      if (event === 'SIGNED_IN' && session?.user) {
        console.log("SIGNED_IN event detected - creating session for", session.user.id);
        
        try {
          const result = await createOrUpdateSession(session.user.id, window.location.pathname);
          console.log("Session creation result:", result);
          
          // Redirect if on 404 page or OAuth callback page
          if (location.pathname === '/404' || location.pathname.includes('callback')) {
            console.log("Redirecting from 404/callback to /journal after sign in");
            navigate('/journal', { replace: true });
          }
          
          // Process unprocessed journal entries after sign in
          setTimeout(async () => {
            try {
              console.log("Processing unprocessed journal entries after sign in");
              const result = await processUnprocessedEntries();
              console.log("Processing result:", result);
            } catch (err) {
              console.error("Error processing entries after sign in:", err);
            }
          }, 5000); // Wait 5 seconds to allow for auth state to fully settle
          
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
        
        // Check if we need to redirect from a 404 page or callback page
        if (location.pathname === '/404' || location.pathname.includes('callback')) {
          console.log("Redirecting from 404/callback to /journal with initial session");
          navigate('/journal', { replace: true });
        }
        
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
        }, 5000); // Wait 5 seconds to allow for component mounting
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

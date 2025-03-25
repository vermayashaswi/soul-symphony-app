
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { createOrUpdateSession, endUserSession } from "@/utils/audio/auth-utils";
import { useJournalHandler } from "@/hooks/use-journal-handler";

const AuthStateListener = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { processUnprocessedEntries } = useJournalHandler(user?.id);
  
  useEffect(() => {
    console.log("Setting up Supabase auth debugging listener");
    console.log("Current route:", location.pathname);
    
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
              await processUnprocessedEntries();
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
        
        createOrUpdateSession(data.session.user.id, window.location.pathname)
          .catch(err => {
            console.error("Error tracking initial session:", err);
          });
          
        // Process unprocessed journal entries on initial load
        setTimeout(async () => {
          try {
            console.log("Processing unprocessed journal entries on initial load");
            await processUnprocessedEntries();
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
  }, [user, location.pathname, processUnprocessedEntries]);
  
  return null;
};

export default AuthStateListener;

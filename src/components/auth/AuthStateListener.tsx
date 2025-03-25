
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { createOrUpdateSession, endUserSession } from "@/utils/audio/auth-utils";

const AuthStateListener = () => {
  const { user } = useAuth();
  const location = useLocation();
  
  // Log the current route for debugging
  console.log("Current route:", location.pathname);
  
  useEffect(() => {
    console.log("Setting up Supabase auth debugging listener");
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth event outside React context:", event, session?.user?.email);
      
      if (event === 'SIGNED_IN' && session?.user) {
        console.log("SIGNED_IN event detected - creating new session for user", session.user.id);
        
        createOrUpdateSession(session.user.id, window.location.pathname)
          .then(result => {
            console.log("Session creation result:", result);
          })
          .catch(err => {
            console.error("Error creating session on sign in:", err);
          });
      } else if (event === 'SIGNED_OUT' && user) {
        console.log("SIGNED_OUT event detected - ending session for user", user.id);
        
        endUserSession(user.id)
          .catch(err => {
            console.error("Error ending session on sign out:", err);
          });
      }
    });
    
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Initial session check error:", error);
      } else if (data.session) {
        console.log("Initial session present:", {
          userId: data.session.user.id,
          email: data.session.user.email,
          expiresAt: new Date(data.session.expires_at * 1000).toISOString(),
          expiresIn: Math.round((data.session.expires_at * 1000 - Date.now()) / 1000 / 60) + " minutes"
        });
        
        if (data.session.user.id) {
          console.log("Creating/updating session for initial session user", data.session.user.id);
          
          createOrUpdateSession(data.session.user.id, window.location.pathname)
            .then(result => {
              console.log("Initial session tracking result:", result);
            })
            .catch(err => {
              console.error("Error tracking session on initial load:", err);
            });
        }
      } else {
        console.log("No initial session found");
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [user]);
  
  return null;
};

export default AuthStateListener;

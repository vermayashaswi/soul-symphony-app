
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const AuthCallback = () => {
  const [isProcessing, setIsProcessing] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshSession } = useAuth();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log("Auth callback page: Processing authentication...");
        console.log("Hash present:", location.hash ? "Yes" : "No");
        
        // Get session from hash and handle the redirect internally
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Error getting session:", error);
          toast.error("Authentication error: " + error.message);
          navigate("/auth", { replace: true });
          return;
        }
        
        if (data.session) {
          console.log("Successfully retrieved session");
          
          // Force refresh our auth context
          await refreshSession();
          
          toast.success("Successfully signed in!");
          navigate("/journal", { replace: true });
        } else {
          console.log("No session found after processing hash");
          
          // If we have a hash but no session, we need to process the hash
          if (location.hash && location.hash.includes('access_token')) {
            console.log("Attempting to exchange hash for session...");
            
            // Using the correct method to process the URL hash
            // Replaced getSessionFromUrl with setSession to process the hash
            const { data: hashData, error: hashError } = await supabase.auth.setSession(location.hash);
            
            if (hashError) {
              console.error("Error processing hash:", hashError);
              toast.error("Authentication error: " + hashError.message);
              navigate("/auth", { replace: true });
              return;
            }
            
            if (hashData.session) {
              console.log("Successfully processed hash and created session");
              
              // Force refresh our auth context
              await refreshSession();
              
              toast.success("Successfully signed in!");
              navigate("/journal", { replace: true });
              return;
            }
          }
          
          // If we still don't have a session, redirect to auth
          navigate("/auth", { replace: true });
        }
      } catch (error) {
        console.error("Error processing auth callback:", error);
        toast.error("An error occurred during authentication");
        navigate("/auth", { replace: true });
      } finally {
        setIsProcessing(false);
      }
    };

    handleAuthCallback();
  }, [navigate, refreshSession, location.hash]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      {isProcessing ? (
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Processing your login...</p>
        </div>
      ) : null}
    </div>
  );
};

export default AuthCallback;

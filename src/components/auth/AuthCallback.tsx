
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
        console.log("Current path:", location.pathname);
        console.log("Hash present:", location.hash ? "Yes (length: " + location.hash.length + ")" : "No");
        console.log("Hash content:", location.hash ? location.hash.substring(0, 20) + "..." : "None");
        
        // First check if we already have a session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Error getting session:", error);
          toast.error("Authentication error: " + error.message);
          navigate("/auth", { replace: true });
          return;
        }
        
        if (data.session) {
          console.log("Successfully retrieved existing session");
          
          // Force refresh our auth context
          await refreshSession();
          
          toast.success("Successfully signed in!");
          navigate("/journal", { replace: true });
          return;
        }
        
        // If we don't have a session but have a hash, process it
        if (location.hash) {
          console.log("No existing session found, processing hash...");
          
          try {
            // Different ways to handle the hash based on its content
            if (location.hash.includes('access_token')) {
              console.log("Hash contains access_token, using exchangeCodeForSession");
              const { data: hashData, error: hashError } = await supabase.auth.exchangeCodeForSession(location.hash);
              
              if (hashError) {
                console.error("Error with exchangeCodeForSession:", hashError);
                toast.error("Authentication error: " + hashError.message);
                navigate("/auth", { replace: true });
                return;
              }
              
              if (hashData?.session) {
                console.log("Successfully created session from hash");
                await refreshSession();
                toast.success("Successfully signed in!");
                navigate("/journal", { replace: true });
                return;
              }
            } 
            // Handle other types of authentication as needed
            else if (location.hash.includes('type=recovery')) {
              console.log("Recovery flow detected");
              // Handle recovery flow if needed
            }
            else {
              console.log("Unknown hash format:", location.hash.substring(0, 20) + "...");
            }
          } catch (hashProcessingError) {
            console.error("Error processing hash:", hashProcessingError);
            toast.error("Error processing authentication");
            navigate("/auth", { replace: true });
            return;
          }
        }
        
        // If we still don't have a session, redirect to auth
        console.log("No session could be established, redirecting to auth page");
        navigate("/auth", { replace: true });
      } catch (error) {
        console.error("Unexpected error in auth callback:", error);
        toast.error("An unexpected error occurred during authentication");
        navigate("/auth", { replace: true });
      } finally {
        setIsProcessing(false);
      }
    };

    handleAuthCallback();
  }, [navigate, refreshSession, location]);

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


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
        console.log("Search params:", location.search || "None");
        
        // Handle various authentication callback scenarios
        if (location.hash && (location.hash.includes('access_token') || location.hash.includes('id_token'))) {
          console.log("Processing hash-based auth callback");
          
          try {
            // Handle the OAuth callback with the correct method
            // For access_token in hash (implicit flow)
            const { data, error } = await supabase.auth.getSession();
            
            if (error) {
              console.error("Error getting session:", error);
              toast.error("Authentication error: " + error.message);
              navigate("/auth", { replace: true });
              return;
            }
            
            if (data?.session) {
              console.log("Successfully created session from hash");
              await refreshSession();
              toast.success("Successfully signed in!");
              navigate("/journal", { replace: true });
              return;
            } else {
              console.log("No session data returned from hash processing");
            }
          } catch (hashProcessingError) {
            console.error("Error processing auth callback:", hashProcessingError);
            toast.error("Error processing authentication");
            navigate("/auth", { replace: true });
            return;
          }
        } else if (location.search && (location.search.includes('code=') || location.search.includes('error='))) {
          console.log("Processing query parameter-based auth callback");
          
          if (location.search.includes('error')) {
            const errorDescription = new URLSearchParams(location.search).get('error_description');
            console.error("Auth error in query params:", errorDescription);
            toast.error(errorDescription || "Authentication failed");
            navigate("/auth", { replace: true });
            return;
          }
          
          try {
            // Handle the authorization code (code=) flow
            const code = new URLSearchParams(location.search).get('code');
            if (code) {
              const { data, error } = await supabase.auth.exchangeCodeForSession(code);
              
              if (error) {
                console.error("Error exchanging code for session:", error);
                toast.error("Authentication error: " + error.message);
                navigate("/auth", { replace: true });
                return;
              }
              
              if (data?.session) {
                console.log("Successfully created session from code");
                await refreshSession();
                toast.success("Successfully signed in!");
                navigate("/journal", { replace: true });
                return;
              }
            }
          } catch (queryProcessingError) {
            console.error("Error processing query params:", queryProcessingError);
            toast.error("Error processing authentication");
            navigate("/auth", { replace: true });
            return;
          }
        }
        
        // Check if we already have a session (fallback)
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Error getting existing session:", error);
          toast.error("Authentication error: " + error.message);
          navigate("/auth", { replace: true });
          return;
        }
        
        if (data.session) {
          console.log("Successfully retrieved existing session");
          await refreshSession();
          toast.success("Successfully signed in!");
          navigate("/journal", { replace: true });
          return;
        }
        
        // If we reach here, we couldn't establish a session
        console.log("No session could be established in the callback handler");
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

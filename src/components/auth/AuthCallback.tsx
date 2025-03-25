
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const AuthCallback = () => {
  const [isProcessing, setIsProcessing] = useState(true);
  const navigate = useNavigate();
  const { refreshSession } = useAuth();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log("Auth callback page: Processing authentication...");
        
        // If we have a hash in the URL, we need to process it
        if (window.location.hash) {
          console.log("Hash detected in URL, processing auth data");
          
          // Get session from hash and handle the redirect internally
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error("Error getting session from hash:", error);
            toast.error("Authentication error: " + error.message);
            navigate("/auth", { replace: true });
            return;
          }
          
          if (data.session) {
            console.log("Successfully retrieved session from hash");
            
            // Force refresh our auth context
            await refreshSession();
            
            toast.success("Successfully signed in!");
            navigate("/journal", { replace: true });
          } else {
            console.log("No session found after processing hash");
            navigate("/auth", { replace: true });
          }
        } else {
          // If there's no hash but we're on the callback page, redirect to auth
          console.log("No hash found in callback URL");
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
  }, [navigate, refreshSession]);

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

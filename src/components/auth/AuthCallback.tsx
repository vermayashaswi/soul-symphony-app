
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth";
import { hasAuthParams } from "@/utils/auth-utils";

const AuthCallback = () => {
  const [isProcessing, setIsProcessing] = useState(true);
  const [processingTimeout, setProcessingTimeout] = useState<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshSession } = useAuth();

  // Set a timeout to prevent indefinite processing state
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isProcessing) {
        console.log("Auth callback processing timed out");
        setIsProcessing(false);
        navigate("/auth", { replace: true });
        toast.error("Authentication timed out. Please try again.");
      }
    }, 10000); // 10 seconds timeout
    
    setProcessingTimeout(timeout);
    
    return () => {
      if (processingTimeout) {
        clearTimeout(processingTimeout);
      }
    };
  }, []);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log("Auth callback page: Processing authentication...");
        console.log("Hash present:", location.hash ? "Yes (length: " + location.hash.length + ")" : "No");
        console.log("Search params:", location.search || "None");
        
        // Validate we have auth parameters
        if (!hasAuthParams()) {
          console.log("No auth parameters found in URL, redirecting to auth page");
          navigate("/auth", { replace: true });
          return;
        }
        
        // Handle hash-based authentication (implicit flow)
        if (location.hash && (location.hash.includes('access_token') || location.hash.includes('id_token'))) {
          console.log("Processing hash-based auth callback");
          
          try {
            // Exchange hash values for a session
            const { data, error } = await supabase.auth.getSession();
            
            if (error) {
              console.error("Error getting session:", error);
              toast.error("Authentication error: " + error.message);
              navigate("/auth", { replace: true });
              return;
            }
            
            if (data?.session) {
              console.log("Successfully authenticated with hash");
              
              // Force storage sync after successful authentication
              try {
                localStorage.setItem('sb-last-auth-time', Date.now().toString());
                localStorage.setItem('auth_success', 'true');
              } catch (e) {
                console.warn('LocalStorage access error, but continuing:', e);
              }
              
              await refreshSession();
              toast.success("Successfully signed in!");
              navigate("/journal", { replace: true });
              return;
            } else {
              // If no session is found but we have hash tokens, try to use them
              console.log("No session found, but hash tokens present - attempting to redirect");
              navigate("/?hash_auth=true", { 
                replace: true,
                state: { fromCallback: true }
              });
              return;
            }
          } catch (hashProcessingError) {
            console.error("Error processing auth callback:", hashProcessingError);
            toast.error("Error processing authentication");
            navigate("/auth", { replace: true });
            return;
          }
        } 
        // Handle code-based authentication
        else if (location.search && location.search.includes('code=')) {
          console.log("Processing code-based auth callback");
          
          if (location.search.includes('error')) {
            const errorDescription = new URLSearchParams(location.search).get('error_description');
            console.error("Auth error in query params:", errorDescription);
            toast.error(errorDescription || "Authentication failed");
            navigate("/auth", { replace: true });
            return;
          }
          
          try {
            const code = new URLSearchParams(location.search).get('code');
            if (code) {
              // Code flow - exchange the code for a session
              console.log("Exchanging code for session...");
              const { data, error } = await supabase.auth.exchangeCodeForSession(code);
              
              if (error) {
                console.error("Error exchanging code for session:", error);
                toast.error("Authentication error: " + error.message);
                navigate("/auth", { replace: true });
                return;
              }
              
              if (data?.session) {
                console.log("Successfully created session from code");
                
                // Force storage sync after successful authentication
                try {
                  localStorage.setItem('auth_success', 'true');
                  localStorage.setItem('last_auth_time', Date.now().toString());
                } catch (e) {
                  console.warn('LocalStorage access error, but continuing:', e);
                }
                
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
        
        // Fallback check for existing session
        try {
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
        } catch (sessionError) {
          console.error("Error retrieving session:", sessionError);
          toast.error("Authentication error occurred");
          navigate("/auth", { replace: true });
          return;
        }
      } catch (error) {
        console.error("Unexpected error in auth callback:", error);
        toast.error("An unexpected error occurred during authentication");
        navigate("/auth", { replace: true });
      } finally {
        if (processingTimeout) {
          clearTimeout(processingTimeout);
        }
        setIsProcessing(false);
      }
    };

    handleAuthCallback();
  }, [navigate, refreshSession, location, processingTimeout]);

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

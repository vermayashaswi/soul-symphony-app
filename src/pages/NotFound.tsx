
import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading, refreshSession } = useAuth();

  useEffect(() => {
    console.log("NotFound: Current path:", location.pathname);
    console.log("NotFound: Current hash:", location.hash);
    console.log("NotFound: Current search:", location.search);
    console.log("NotFound: Auth state:", { user: !!user, isLoading });
    
    // Check for OAuth redirect signatures
    const isFromRedirect = 
      location.pathname.includes('callback') || 
      location.search.includes('error') || 
      location.hash.includes('access_token') ||
      location.hash.includes('type=recovery');
                          
    if (isFromRedirect) {
      console.log("Detected redirect to 404 page, attempting recovery");
      
      // Process any auth hash parameters if present
      if (location.hash.includes('access_token')) {
        supabase.auth.getSession().then(({ data, error }) => {
          if (error) {
            console.error('Error getting session from hash:', error);
            toast.error('Authentication error. Please try again.');
          } else if (data.session) {
            console.log('Successfully retrieved session from hash');
            toast.success('Authentication successful!');
            
            // Wait briefly for auth state to update
            setTimeout(() => {
              navigate('/journal', { replace: true });
            }, 1000);
          }
        });
      } else {
        // Add slight delay to ensure auth state is processed
        const timer = setTimeout(async () => {
          // Try to refresh session in case we missed it
          await refreshSession();
          
          if (user) {
            console.log("User is authenticated, redirecting to journal");
            toast.success("Successfully logged in!");
            navigate("/journal", { replace: true });
          } else if (!isLoading) {
            console.log("User is not authenticated, redirecting to auth");
            navigate("/auth", { replace: true });
          }
        }, 1500);
        
        return () => clearTimeout(timer);
      }
    }
  }, [location.pathname, location.search, location.hash, user, isLoading, navigate, refreshSession]);

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md px-4">
          <div className="mb-6 flex justify-center">
            <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <span className="text-5xl font-light">404</span>
            </div>
          </div>
          
          <h1 className="text-3xl font-bold mb-2">Page not found</h1>
          <p className="text-muted-foreground mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>
          
          <Button asChild size="lg" className="rounded-full">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

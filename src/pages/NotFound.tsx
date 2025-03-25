import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    console.log("NotFound: Current path:", location.pathname);
    console.log("NotFound: Auth state:", { user: !!user, isLoading });
    
    // Check for OAuth redirect signatures
    const isFromRedirect = 
      location.pathname.includes('callback') || 
      location.search.includes('error') || 
      location.hash.includes('access_token') ||
      location.hash.includes('type=recovery');
                          
    if (isFromRedirect && !isLoading) {
      console.log("Detected redirect to 404 page, attempting recovery");
      
      // Add slight delay to ensure auth state is processed
      const timer = setTimeout(() => {
        if (user) {
          console.log("User is authenticated, redirecting to journal");
          toast.success("Successfully logged in!");
          navigate("/journal", { replace: true });
        } else {
          console.log("User is not authenticated, redirecting to auth");
          navigate("/auth", { replace: true });
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [location.pathname, location.search, location.hash, user, isLoading, navigate]);

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

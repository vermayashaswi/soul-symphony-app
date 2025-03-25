
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
    console.log("NotFound: Current hash:", location.hash ? "Present (contains auth tokens)" : "None");
    
    // Improved OAuth redirect detection
    const isFromRedirect = 
      location.search.includes('error') || 
      location.hash.includes('access_token') ||
      location.hash.includes('type=recovery');
                          
    if (isFromRedirect) {
      console.log("Detected redirect to 404 page from OAuth callback, redirecting to callback route");
      
      // Redirect to the callback route which will handle the auth flow
      if (location.hash.includes('access_token')) {
        navigate('/callback' + location.hash, { replace: true });
        return;
      }
      
      // Handle error cases
      if (location.search.includes('error')) {
        toast.error("Authentication error. Please try again.");
        navigate('/auth', { replace: true });
        return;
      }
    }
  }, [location.pathname, location.search, location.hash, navigate]);

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


import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import { isAppSubdomain } from "@/routes/RouteHelpers";

interface NotFoundProps {
  isAppSubdomain?: boolean;
}

const NotFound = ({ isAppSubdomain: isAppDomain }: NotFoundProps) => {
  const location = useLocation();
  // If isAppDomain was not passed directly, check again here
  const isAppMode = isAppDomain !== undefined ? isAppDomain : isAppSubdomain();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
      { isAppMode }
    );
  }, [location.pathname, isAppMode]);

  // Determine the correct "back to home" path based on domain
  const homePath = isAppMode ? "/home" : "/";

  return (
    <div className="min-h-screen">
      <Navbar />
      
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
            <Link to={homePath}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to {isAppMode ? "App Home" : "Home"}
            </Link>
          </Button>
          
          {isAppMode && (
            <div className="mt-4 text-sm text-muted-foreground">
              <p>Looking for the main website? Go to <a href="https://soulo.online" className="text-primary hover:underline">soulo.online</a></p>
            </div>
          )}
          
          {!isAppMode && (
            <div className="mt-4 text-sm text-muted-foreground">
              <p>Looking for the app? Go to <a href="https://app.soulo.online" className="text-primary hover:underline">app.soulo.online</a></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotFound;

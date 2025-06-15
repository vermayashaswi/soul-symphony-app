
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
// Remove RouteHelpers import as function is defined locally
// import { isAppRoute } from "@/routes/RouteHelpers";

interface NotFoundProps {
  isAppSubdomain?: boolean;
}

const isAppRoute = (pathname: string) => pathname.startsWith('/app');

const NotFound = ({ isAppSubdomain }: NotFoundProps = {}) => {
  const location = useLocation();
  // Check if it's an app route
  const isAppPath = isAppRoute(location.pathname);

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
      { isAppPath }
    );
  }, [location.pathname, isAppPath]);

  // Determine the correct "back to home" path based on path
  const homePath = isAppPath ? "/app/home" : "/";
  const homeText = isAppPath ? "App Home" : "Home";

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
              Back to {homeText}
            </Link>
          </Button>

          {isAppPath && (
            <div className="mt-4 text-sm text-muted-foreground">
              <p>Looking for the main website? Visit <Link to="/" className="text-primary hover:underline">soulo.online</Link></p>
            </div>
          )}

          {!isAppPath && (
            <div className="mt-4 text-sm text-muted-foreground">
              <p>Looking for the app? Visit <Link to="/app" className="text-primary hover:underline">soulo.online/app</Link></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotFound;


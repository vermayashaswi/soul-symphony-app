
import React, { useEffect } from 'react';
import AppRoutes from './routes/AppRoutes';
import { isAppSubdomain } from './routes/RouteHelpers';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";

const App: React.FC = () => {
  useEffect(() => {
    console.log('App mounted, current path:', window.location.pathname);
    
    // Detect current domain and path
    const currentHostname = window.location.hostname;
    const currentPath = window.location.pathname;
    
    // Logic for main domain (soulo.online)
    if (!isAppSubdomain()) {
      // Special case for /app route
      if (currentPath === '/app') {
        const newUrl = `https://app.soulo.online${window.location.search}${window.location.hash}`;
        console.log('Redirecting /app to app subdomain root:', newUrl);
        window.location.replace(newUrl);
        return;
      }
      
      // If path starts with /app/, redirect to app subdomain
      if (currentPath.startsWith('/app/')) {
        const newPath = currentPath.replace('/app/', '/');
        const newUrl = `https://app.soulo.online${newPath}${window.location.search}${window.location.hash}`;
        console.log('Redirecting from main domain to app subdomain:', newUrl);
        window.location.replace(newUrl);
        return;
      }
      
      // Redirect specific app routes to app subdomain
      const appRoutes = ['/home', '/journal', '/insights', '/chat', '/smart-chat', '/settings', '/auth', '/onboarding'];
      if (appRoutes.some(route => currentPath === route)) {
        const newUrl = `https://app.soulo.online${currentPath}${window.location.search}${window.location.hash}`;
        console.log('Redirecting app route to app subdomain:', newUrl);
        window.location.replace(newUrl);
        return;
      }
    }
    
    // Logic for app subdomain (app.soulo.online)
    if (isAppSubdomain()) {
      // Remove /app/ prefix if present
      if (currentPath.startsWith('/app/')) {
        const newPath = currentPath.replace('/app/', '/');
        console.log('Correcting path on app subdomain:', newPath);
        window.history.replaceState(null, '', newPath);
      }
      
      // Fix incorrectly formatted URLs that have domains or https in the path
      if (currentPath.includes('https://') || currentPath.includes('soulo.online')) {
        console.log('Fixing malformed URL path:', currentPath);
        window.history.replaceState(null, '', '/');
      }
    }
  }, []);

  return (
    <>
      <AppRoutes />
      <Toaster />
      <SonnerToaster position="top-right" />
    </>
  );
};

export default App;

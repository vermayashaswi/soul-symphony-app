import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./hooks/use-theme";
import { TouchAnimation } from "./components/ui/touch-animation";
import { supabase } from "./integrations/supabase/client";
import AppRoutes from "./routes/AppRoutes";
import "./styles/mobile.css";
import { useEffect } from 'react';
import { handleAuthCallback } from "./services/authService";
import { debugLogger } from "@/components/debug/DebugPanel.tsx";
import { isAppSubdomain } from "./routes/RouteHelpers";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      meta: {
        onError: (error: unknown) => {
          console.error('Query error:', error);
        }
      }
    },
  },
});

const App = () => {
  useEffect(() => {
    console.log('App mounted, path:', window.location.pathname, 'hostname:', window.location.hostname);
    debugLogger.log('info', '🔍 Audio debugging initialized');
    debugLogger.log('info', `[${new Date().toISOString()}] App initialized`);
    
    // Log detection info
    debugLogger.log('info', `[${new Date().toISOString()}] Mobile detection:`, {
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      hostname: window.location.hostname
    });
    
    // Domain-specific handling
    const isOnAppSubdomain = isAppSubdomain();
    
    // Handle main domain navigation to /app/* paths
    if (!isOnAppSubdomain && window.location.pathname.startsWith('/app/')) {
      // Extract the path without the /app prefix
      const pathWithoutAppPrefix = window.location.pathname.replace('/app/', '/');
      // Create the new URL with the app subdomain
      const newUrl = `https://app.soulo.online${pathWithoutAppPrefix}${window.location.search}${window.location.hash}`;
      console.log('Redirecting main domain /app path to app subdomain:', newUrl);
      // Use replace instead of assigning to href to avoid adding to browser history
      window.location.replace(newUrl);
      return;
    }
    
    // Handle app subdomain path corrections
    if (isOnAppSubdomain && window.location.pathname.startsWith('/app/')) {
      // If we're on app.soulo.online/app/*, redirect to app.soulo.online/*
      const newPath = window.location.pathname.replace('/app/', '/');
      console.log('Redirecting from app subdomain path with /app/ prefix to:', newPath);
      window.history.replaceState(null, '', newPath);
    }
    
    // Add a global error listener to catch runtime errors
    const handleGlobalError = (event: ErrorEvent) => {
      console.error('Global error:', event.message);
    };
    
    // Add a global unhandled rejection listener
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
    };
    
    // Set up Supabase auth basic listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      
      if (event === 'SIGNED_IN' && session?.user) {
        // Create user session when signed in
        const userId = session.user.id;
        const deviceType = /mobile|android|iphone|ipad|ipod/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
        
        // Create session entry
        supabase.from('user_sessions')
          .insert({
            user_id: userId,
            device_type: deviceType,
            user_agent: navigator.userAgent,
            entry_page: window.location.pathname,
            last_active_page: window.location.pathname,
            is_active: true
          })
          .then(({ error }) => {
            if (error) console.error('Error creating user session:', error);
          });
      }
    });
    
    // Check for auth callback hash/query parameters on page load
    const hasAuthParams = window.location.hash.includes('access_token') || 
                         window.location.search.includes('error') || 
                         window.location.hash.includes('error');
    
    if (hasAuthParams) {
      console.log('Detected auth callback parameters, handling...');
      // Process auth callback using the correct method
      handleAuthCallback().catch(err => {
        console.error('Error handling auth callback at app startup:', err);
      });
    }
    
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    // Remove Lovable badge if present
    const removeLovableBadge = () => {
      // Look for the badge in the DOM (it has several possible class names)
      const badgeSelectors = [
        '.lovable-badge',
        '[data-lovable-badge]', 
        '.powered-by-lovable'
      ];
      
      badgeSelectors.forEach(selector => {
        const badges = document.querySelectorAll(selector);
        badges.forEach(badge => {
          badge.remove();
        });
      });
    };
    
    // Run once on mount
    removeLovableBadge();
    
    // Also run after a small delay to catch any badges that might be added dynamically
    setTimeout(removeLovableBadge, 1000);
    
    // Create a MutationObserver to detect if the badge gets added dynamically
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          removeLovableBadge();
        }
      }
    });
    
    // Start observing the body for changes
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Clean up observer on component unmount
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      subscription.unsubscribe();
      observer.disconnect();
    };
  }, []);
  
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider>
              <div className="relative min-h-screen">
                <div className="relative z-10">
                  <AnimatePresence mode="wait">
                    <AppRoutes />
                  </AnimatePresence>
                </div>
                <TouchAnimation />
              </div>
              <Sonner richColors closeButton position="top-center" />
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;

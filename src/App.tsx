
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
    // Add a global error listener to catch runtime errors
    const handleGlobalError = (event: ErrorEvent) => {
      console.error('Global error:', event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    };
    
    // Add a global unhandled rejection listener
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason, {
        reason: event.reason,
        stack: event.reason?.stack
      });
    };
    
    // Set up Supabase auth debugging
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed in App.tsx:', event, {
        user: session?.user?.email || 'No user',
        expires_at: session?.expires_at
      });
    });
    
    // Debug the current session on app load
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial auth session in App.tsx:', {
        user: session?.user?.email || 'No user',
        expires_at: session?.expires_at
      });
    });
    
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
      <TooltipProvider>
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <div className="relative min-h-screen">
                <div className="relative z-10">
                  {/* Add the TouchAnimation component here */}
                  <div className="fixed inset-0 overflow-hidden pointer-events-none z-50">
                    <TouchAnimation />
                  </div>
                  <Toaster />
                  <Sonner position="top-center" closeButton={false} />
                  <AnimatePresence mode="wait">
                    <AppRoutes />
                  </AnimatePresence>
                </div>
              </div>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

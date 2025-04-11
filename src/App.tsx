
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
import { DebugLogProvider } from "./utils/debug/DebugContext";
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n/i18n';
import LanguageDebugPanel from "./components/debug/LanguageDebugPanel";
import DebugLogPanel from "./components/debug/DebugLogPanel";

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
      console.error('Global error:', event.message);
    };
    
    // Add a global unhandled rejection listener
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
    };
    
    // Set up Supabase auth basic listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <ThemeProvider>
              <AuthProvider>
                <DebugLogProvider>
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
                      
                      {/* Debug panels */}
                      <LanguageDebugPanel />
                      <DebugLogPanel />
                    </div>
                  </div>
                </DebugLogProvider>
              </AuthProvider>
            </ThemeProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
};

export default App;

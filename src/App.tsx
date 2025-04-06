
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./hooks/use-theme";
import AppRoutes from "./routes/AppRoutes";
import "./styles/mobile.css";
import { debugLogger, logInfo, logError } from './components/debug/DebugPanel';
import { useEffect } from 'react';

// Enable debugger globally
debugLogger.setEnabled(true);

// Configurable options for debug panel
debugLogger.log('info', 'Initializing application with debug mode enabled', 'App');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Using meta for error handling in v5
      meta: {
        onError: (error: unknown) => {
          console.error('Query error:', error);
          // Log query errors to the debugger
          if (debugLogger.isEnabled()) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            debugLogger.log('error', `Query error: ${errorMessage}`, 'QueryClient', error);
          }
        }
      }
    },
  },
});

const App = () => {
  // Log application startup
  logInfo('Application initialized', 'App');
  
  useEffect(() => {
    // Add a global error listener to catch runtime errors
    const handleGlobalError = (event: ErrorEvent) => {
      logError(`Global error: ${event.message}`, 'Window', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    };
    
    // Add a global unhandled rejection listener
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logError(`Unhandled promise rejection: ${event.reason}`, 'Window', {
        reason: event.reason,
        stack: event.reason?.stack
      });
    };
    
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    // Detect browser-specific features and limitations
    logInfo(`Browser details: ${navigator.userAgent}`, 'App', {
      localStorage: typeof localStorage !== 'undefined',
      sessionStorage: typeof sessionStorage !== 'undefined',
      cookiesEnabled: navigator.cookieEnabled,
      language: navigator.language
    });
    
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
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

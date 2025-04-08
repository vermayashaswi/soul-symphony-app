
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./hooks/use-theme";
import AppRoutes from "./routes/AppRoutes";
import MaintenanceBanner from "./components/MaintenanceBanner";
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
    
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
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
                <MaintenanceBanner />
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

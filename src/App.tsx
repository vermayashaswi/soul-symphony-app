
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
import { debugLogger, logInfo } from './components/debug/DebugPanel';

// Enable debugger globally
debugLogger.setEnabled(true);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      onError: (error) => {
        console.error('Query error:', error);
        // Log query errors to the debugger
        if (debugLogger.isEnabled()) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          debugLogger.log('error', `Query error: ${errorMessage}`, 'QueryClient', error);
        }
      }
    },
  },
});

const App = () => {
  // Log application startup
  logInfo('Application initialized', 'App');
  
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

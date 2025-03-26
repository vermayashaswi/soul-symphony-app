
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import ParticleBackground from "./components/ParticleBackground";
import { AuthProvider } from "./contexts/auth";
import AppRoutes from "./components/routes/AppRoutes";
import { DebugProvider } from "./contexts/debug/DebugContext";
import { DebugPanel } from "./components/debug/DebugPanel";

const App = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000, // 5 minutes
      },
    },
  });

  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <BrowserRouter>
              <DebugProvider>
                <Toaster />
                <Sonner position="top-center" closeButton />
                <ParticleBackground />
                <AnimatePresence mode="wait">
                  <AppRoutes />
                </AnimatePresence>
                <DebugPanel />
              </DebugProvider>
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
};

export default App;

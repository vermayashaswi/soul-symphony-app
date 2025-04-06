
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <ThemeProvider>
              <div className="relative min-h-screen">
                <div className="relative z-10">
                  <Toaster />
                  <Sonner position="top-center" closeButton={false} />
                  <AnimatePresence mode="wait">
                    <AppRoutes />
                  </AnimatePresence>
                </div>
              </div>
            </ThemeProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

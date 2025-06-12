
import { Suspense } from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { TranslationProvider } from "@/contexts/TranslationContext";
import { TutorialProvider } from "@/contexts/TutorialContext";
import { ThemeProvider } from "next-themes";
import { JournalProcessingInitializer } from '@/app/journal-processing-init';
import AppRoutes from "./routes/AppRoutes";
import "./App.css";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TooltipProvider>
          <AuthProvider>
            <SubscriptionProvider>
              <LocationProvider>
                <TranslationProvider>
                  <TutorialProvider>
                    <Router>
                      <JournalProcessingInitializer />
                      
                      <Suspense fallback={
                        <div className="min-h-screen flex items-center justify-center">
                          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
                        </div>
                      }>
                        <AppRoutes />
                      </Suspense>
                      
                      <Toaster />
                    </Router>
                  </TutorialProvider>
                </TranslationProvider>
              </LocationProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

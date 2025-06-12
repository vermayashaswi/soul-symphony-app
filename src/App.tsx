
import { Suspense } from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider as NextThemeProvider } from "next-themes";
import { ThemeProvider as CustomThemeProvider } from "@/hooks/use-theme";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import SafeAppRoutes from "./routes/SafeAppRoutes";
import EmergencyFallback from "./routes/EmergencyFallback";
import "./App.css";

// Simplified context providers - only include essential ones
import { AuthProvider } from "@/contexts/SimplifiedAuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { TranslationProvider } from "@/contexts/TranslationContext";
import { TutorialProvider } from "@/contexts/TutorialContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Loading fallback component
const AppLoading = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
  </div>
);

function App() {
  console.log('[App] Rendering application');
  
  return (
    <ErrorBoundary fallback={<EmergencyFallback />}>
      <QueryClientProvider client={queryClient}>
        <NextThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <CustomThemeProvider>
            <TooltipProvider>
              <Router>
                <ErrorBoundary fallback={<EmergencyFallback />}>
                  <AuthProvider>
                    <SubscriptionProvider>
                      <TranslationProvider>
                        <TutorialProvider>
                          <Suspense fallback={<AppLoading />}>
                            <SafeAppRoutes />
                          </Suspense>
                          
                          <Toaster />
                        </TutorialProvider>
                      </TranslationProvider>
                    </SubscriptionProvider>
                  </AuthProvider>
                </ErrorBoundary>
              </Router>
            </TooltipProvider>
          </CustomThemeProvider>
        </NextThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

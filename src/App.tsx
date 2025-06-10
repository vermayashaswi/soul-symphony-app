
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthErrorBoundary } from "@/components/auth/AuthErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { TranslationProvider } from "@/contexts/TranslationContext";
import { TutorialProvider } from "@/contexts/TutorialContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import DebugPanel from "@/components/debug/DebugPanel";
import LoadingSpinner from "@/components/LoadingSpinner";
import AppRoutes from "@/routes/AppRoutes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry auth errors
        if (error?.message?.includes('auth') || error?.message?.includes('profile')) {
          return false;
        }
        return failureCount < 3;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ThemeProvider>
            <Toaster position="top-center" />
            <BrowserRouter>
              <TranslationProvider>
                <AuthErrorBoundary>
                  <AuthProvider>
                    <OnboardingProvider>
                      <TutorialProvider>
                        <Suspense fallback={<LoadingSpinner />}>
                          <AppRoutes />
                        </Suspense>
                        <DebugPanel />
                      </TutorialProvider>
                    </OnboardingProvider>
                  </AuthProvider>
                </AuthErrorBoundary>
              </TranslationProvider>
            </BrowserRouter>
          </ThemeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;


import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthErrorBoundary } from "@/components/auth/AuthErrorBoundary";
import Index from "./pages/Index";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { TranslationProvider } from "@/contexts/TranslationContext";
import { TutorialProvider } from "@/contexts/TutorialContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import ProtectedRoute from "@/routes/ProtectedRoute";
import DebugPanel from "@/components/debug/DebugPanel";
import LoadingSpinner from "@/components/LoadingSpinner";

// Lazy load components for better performance
const Auth = lazy(() => import("./pages/Auth"));
const Home = lazy(() => import("./pages/Home"));
const AudioRecorder = lazy(() => import("./pages/AudioRecorder"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Insights = lazy(() => import("./pages/Insights"));
const Profile = lazy(() => import("./pages/Profile"));
const Feedback = lazy(() => import("./pages/Feedback"));
const Settings = lazy(() => import("./pages/Settings"));

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
                          <Routes>
                            <Route path="/" element={<Index />} />
                            <Route path="/app/auth" element={<Auth />} />
                            <Route path="/app/onboarding" element={<Onboarding />} />
                            
                            {/* Protected Routes */}
                            <Route element={<ProtectedRoute />}>
                              <Route path="/app/home" element={<Home />} />
                              <Route path="/app/record" element={<AudioRecorder />} />
                              <Route path="/app/insights" element={<Insights />} />
                              <Route path="/app/profile" element={<Profile />} />
                              <Route path="/app/feedback" element={<Feedback />} />
                              <Route path="/app/settings" element={<Settings />} />
                            </Route>
                          </Routes>
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

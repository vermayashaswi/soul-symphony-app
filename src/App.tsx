
import { Suspense, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
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
import { SplashScreenWrapper } from '@/components/splash/SplashScreenWrapper';
import { routes } from "./routes/routeConfig";
import { isAppRoute } from "./routes/RouteHelpers";
import ProtectedRoute from "./routes/ProtectedRoute";
import OnboardingCheck from "./routes/OnboardingCheck";
import ViewportManager from "./routes/ViewportManager";
import { useLocation } from "react-router-dom";
import "./App.css";

const queryClient = new QueryClient();

function AppContent() {
  const location = useLocation();
  const isApp = isAppRoute(location.pathname);

  return (
    <Routes>
      {routes.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={
            route.protected ? (
              <ProtectedRoute>
                <OnboardingCheck>
                  <ViewportManager>
                    {route.element}
                  </ViewportManager>
                </OnboardingCheck>
              </ProtectedRoute>
            ) : (
              <ViewportManager>
                {route.element}
              </ViewportManager>
            )
          }
        />
      ))}
    </Routes>
  );
}

function App() {
  // Check if app should show splash screen based on environment and route
  const shouldShowSplash = () => {
    // Always show splash for production builds
    if (process.env.NODE_ENV === 'production') return true;
    
    // For development, check if we're on an app route
    const currentPath = window.location.pathname;
    return isAppRoute(currentPath);
  };

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
                      
                      <SplashScreenWrapper 
                        enabledInDev={shouldShowSplash()}
                        minDisplayTime={2500}
                      >
                        <Suspense fallback={
                          <div className="min-h-screen flex items-center justify-center">
                            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
                          </div>
                        }>
                          <AppContent />
                        </Suspense>
                      </SplashScreenWrapper>
                      
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

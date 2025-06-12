
import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { TranslationProvider } from "@/contexts/TranslationContext";
import { TutorialProvider } from "@/contexts/TutorialContext";
import { ThemeProvider } from "@/hooks/use-theme";
import { JournalProcessingInitializer } from '@/app/journal-processing-init';
import { SplashScreenWrapper } from '@/components/splash/SplashScreenWrapper';
import { EmergencyFallback } from '@/components/EmergencyFallback';
import AppRoutes from "./routes/AppRoutes";
import "./App.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Error Boundary Component
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('[AppErrorBoundary] Error caught:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AppErrorBoundary] Error details:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <EmergencyFallback error={this.state.error} resetError={() => this.setState({ hasError: false, error: undefined })} />;
    }

    return this.props.children;
  }
}

function App() {
  console.log('[App] Rendering App component');
  
  // Simple loading fallback
  const LoadingFallback = () => (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <LocationProvider>
                  <TranslationProvider>
                    <TutorialProvider>
                      <JournalProcessingInitializer />
                      
                      <SplashScreenWrapper 
                        enabledInDev={false}
                        minDisplayTime={1000}
                      >
                        <Suspense fallback={<LoadingFallback />}>
                          <AppRoutes />
                        </Suspense>
                      </SplashScreenWrapper>
                      
                      <Toaster />
                    </TutorialProvider>
                  </TranslationProvider>
                </LocationProvider>
              </SubscriptionProvider>
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;


import { Suspense, useEffect } from "react";
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
import AppRoutes from "./routes/AppRoutes";
import { isAppRoute } from "./routes/RouteHelpers";
import "./App.css";

const queryClient = new QueryClient();

// Error Boundary Component
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('[AppErrorBoundary] Error caught:', error);
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AppErrorBoundary] Error details:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-muted-foreground mb-4">
              The application encountered an error. Please refresh the page.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  // Simple loading fallback
  const LoadingFallback = () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  // Check if we should show splash - only for app routes in production
  const shouldShowSplash = () => {
    const currentPath = window.location.pathname;
    
    // Never show splash for marketing routes
    if (currentPath === '/' || 
        currentPath.startsWith('/blog') ||
        currentPath.startsWith('/faq') ||
        currentPath.startsWith('/privacy') ||
        currentPath.startsWith('/download')) {
      return false;
    }
    
    // For production app routes, show splash
    if (process.env.NODE_ENV === 'production' && isAppRoute(currentPath)) {
      return true;
    }
    
    return false;
  };

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <TooltipProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <LocationProvider>
                  <TranslationProvider>
                    <TutorialProvider>
                      <JournalProcessingInitializer />
                      
                      <SplashScreenWrapper 
                        enabledInDev={shouldShowSplash()}
                        minDisplayTime={1500}
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

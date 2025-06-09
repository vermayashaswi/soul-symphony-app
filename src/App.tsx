
import React, { useEffect, useState } from 'react';
import AppRoutes from './routes/AppRoutes';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TranslationProvider } from '@/contexts/TranslationContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { TranslationLoadingOverlay } from '@/components/translation/TranslationLoadingOverlay';
import { JournalProcessingInitializer } from './app/journal-processing-init';
import { TutorialProvider } from './contexts/TutorialContext';
import TutorialOverlay from './components/tutorial/TutorialOverlay';
import ErrorBoundary from './components/insights/ErrorBoundary';
import { preloadCriticalImages } from './utils/imagePreloader';
import { toast } from 'sonner';
import './styles/emoji.css';
import './styles/tutorial.css';

const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [initializationAttempts, setInitializationAttempts] = useState(0);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('[App] Starting app initialization, attempt:', initializationAttempts + 1);
        
        // Clean up any malformed paths
        const currentPath = window.location.pathname;
        
        // Fix incorrectly formatted URLs that have domains or https in the path
        if (currentPath.includes('https://') || currentPath.includes('soulo.online')) {
          console.log('[App] Fixing malformed URL path:', currentPath);
          window.history.replaceState(null, '', '/');
        }
        
        // Apply a CSS class to the document body for theme-specific overrides
        document.body.classList.add('app-initialized');
        
        // Preload critical images with error handling
        try {
          await preloadCriticalImages();
          console.log('[App] Critical images preloaded successfully');
        } catch (error) {
          console.warn('[App] Failed to preload some images:', error);
          // Non-critical error, continue app initialization
        }

        // Mark app as initialized
        setIsInitialized(true);
        setHasError(false);
        console.log('[App] App initialization completed successfully');

      } catch (error) {
        console.error('[App] App initialization failed:', error);
        setInitializationAttempts(prev => prev + 1);
        
        // Prevent infinite retry loops
        if (initializationAttempts < 3) {
          console.log('[App] Retrying initialization in 1 second...');
          setTimeout(() => {
            initializeApp();
          }, 1000);
        } else {
          console.error('[App] Maximum initialization attempts reached, setting error state');
          setHasError(true);
          setIsInitialized(true); // Allow app to render with error state
        }
      }
    };

    console.log('[App] App mounted, current path:', window.location.pathname);
    initializeApp();
  }, []); // Remove initializationAttempts from dependencies to prevent infinite loops

  const handleAppError = (error: Error, errorInfo: any) => {
    console.error('[App] Application-level error:', error, errorInfo);
    
    // Log critical app errors for debugging
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    console.error('[App] Detailed error info:', errorData);

    // Show user-friendly error notification only for critical errors
    if (error.message.includes('ChunkLoadError') || error.message.includes('Loading chunk')) {
      toast.error('Loading issue detected. Please refresh the page.');
    } else {
      toast.error('Something went wrong. The app will try to recover automatically.');
    }

    // Don't set error state for minor errors - let the app continue
    setHasError(false);
  };

  // Show loading state during initialization
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading SOULo...</p>
        </div>
      </div>
    );
  }

  // Show error state if initialization failed completely
  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
          <p className="text-muted-foreground mb-6">
            We're having trouble loading the application. Please try refreshing the page.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary onError={handleAppError}>
      <LocationProvider>
        <TranslationProvider>
          <SubscriptionProvider>
            <TutorialProvider>
              <TranslationLoadingOverlay />
              <JournalProcessingInitializer />
              <AppRoutes key={isInitialized ? 'initialized' : 'initializing'} />
              <TutorialOverlay />
              <Toaster />
              <SonnerToaster position="top-right" />
            </TutorialProvider>
          </SubscriptionProvider>
        </TranslationProvider>
      </LocationProvider>
    </ErrorBoundary>
  );
};

export default App;

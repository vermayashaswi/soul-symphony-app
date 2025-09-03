import React, { useEffect, useState } from 'react';
import AppRoutes from './routes/AppRoutes';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { TranslationLoadingOverlay } from '@/components/translation/TranslationLoadingOverlay';
import { JournalProcessingInitializer } from './app/journal-processing-init';
import { TutorialProvider } from './contexts/TutorialContext';
import { MusicPlayerProvider } from '@/contexts/MusicPlayerContext';
import TutorialOverlay from './components/tutorial/TutorialOverlay';
import ErrorBoundary from './components/insights/ErrorBoundary';
import { AuthErrorBoundary } from './components/error-boundaries/AuthErrorBoundary';
import { preloadCriticalImages } from './utils/imagePreloader';
import { toast } from 'sonner';
import './styles/emoji.css';
import './styles/tutorial.css';
import { FeatureFlagsProvider } from "./contexts/FeatureFlagsContext";
import { SessionTrackingProvider } from './contexts/SessionTrackingContext';
import { nativeAppInitService } from './services/nativeAppInitService';
import { mobileErrorHandler } from './services/mobileErrorHandler';
import PullToRefresh from './components/system/PullToRefresh';

const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('[App] Starting app initialization...');
        
        // Clean up any malformed paths
        const currentPath = window.location.pathname;
        if (currentPath.includes('https://') || currentPath.includes('soulo.online')) {
          window.history.replaceState(null, '', '/');
        }
        
        // Wait for main.tsx initialization to complete
        await new Promise(resolve => {
          if ((window as any).__SOULO_APP_INITIALIZED__) {
            resolve(true);
          } else {
            const checkReady = () => {
              if ((window as any).__SOULO_APP_INITIALIZED__) {
                resolve(true);
              } else {
                setTimeout(checkReady, 10);
              }
            };
            checkReady();
          }
        });
        
        // Initialize native app service only if not already done
        if (!nativeAppInitService.isNativeAppInitialized()) {
          try {
            console.log('[App] Initializing native app service');
            const nativeInitSuccess = await nativeAppInitService.initialize();
            
            if (nativeInitSuccess) {
              console.log('[App] Native app initialization completed successfully');
            } else {
              console.warn('[App] Native app initialization failed, continuing with web fallback');
            }
          } catch (error) {
            console.warn('[App] Native app initialization error', error);
            mobileErrorHandler.handleError({
              type: 'capacitor',
              message: `Native app init failed: ${error}`
            });
          }
        }
        
        // Preload critical images (non-blocking)
        preloadCriticalImages().catch(error => {
          console.warn('[App] Failed to preload some images', error);
        });

        console.log('[App] App initialization completed');
        setIsInitialized(true);

      } catch (error) {
        console.error('[App] Critical initialization error', error);
        setInitializationError(error instanceof Error ? error.message : 'Initialization failed');
        mobileErrorHandler.handleError({
          type: 'crash',
          message: `App initialization failed: ${error}`
        });
      }
    };

    initializeApp();
  }, []);

  const handleAppError = (error: Error, errorInfo: any) => {
    console.error('[App] Application-level error', error, errorInfo);
    
    // Use mobile error handler for consistent error tracking
    mobileErrorHandler.handleError({
      type: 'crash',
      message: error.message,
      stack: error.stack,
      timestamp: Date.now()
    });

    // Show user-friendly error notification
    toast.error('Something went wrong. The app will try to recover automatically.');
  };

  // Show initialization error screen
  if (initializationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center space-y-4 text-center max-w-md">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-semibold text-red-600">Initialization Failed</h2>
          <p className="text-muted-foreground">
            The app failed to initialize properly. This usually happens due to network issues or device compatibility.
          </p>
          <details className="w-full">
            <summary className="cursor-pointer text-sm text-muted-foreground mb-2">
              Technical Details
            </summary>
            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto max-h-32">
              {initializationError}
            </pre>
          </details>
          <div className="flex flex-col space-y-2 w-full">
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading screen while initializing
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary onError={handleAppError}>
      <AuthErrorBoundary>
        <FeatureFlagsProvider>
          <SubscriptionProvider>
            <TutorialProvider>
              <MusicPlayerProvider>
                <JournalProcessingInitializer />
              <PullToRefresh>
                <AppRoutes />
                <TutorialOverlay />
                <Toaster />
                <SonnerToaster position="top-right" />
              </PullToRefresh>
              </MusicPlayerProvider>
            </TutorialProvider>
          </SubscriptionProvider>
        </FeatureFlagsProvider>
      </AuthErrorBoundary>
    </ErrorBoundary>
  );
};

export default App;
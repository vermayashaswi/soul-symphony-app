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
import { mobileOptimizationService } from './services/mobileOptimizationService';
import { nativeIntegrationService } from './services/nativeIntegrationService';
import PullToRefresh from './components/system/PullToRefresh';

import { useAppInitialization } from './hooks/useAppInitialization';
import { logger } from './utils/logger';

const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const appInitialization = useAppInitialization();

  useEffect(() => {
    const appLogger = logger.createLogger('App');
    
    const initializeApp = async () => {
      try {
        appLogger.info('Starting streamlined app initialization');
        
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
            appLogger.debug('Initializing native app service');
            const nativeInitSuccess = await nativeAppInitService.initialize();
            
            if (nativeInitSuccess) {
              appLogger.info('Native app initialization completed successfully');
            } else {
              appLogger.warn('Native app initialization failed, continuing with web fallback');
            }
          } catch (error) {
            appLogger.warn('Native app initialization error', error);
            mobileErrorHandler.handleError({
              type: 'capacitor',
              message: `Native app init failed: ${error}`
            });
          }
        }
        
        // Preload critical images (non-blocking)
        preloadCriticalImages().catch(error => {
          appLogger.warn('Failed to preload some images', error);
        });

        // Set initialized immediately since main initialization is done
        appLogger.info('App initialization completed');
        setIsInitialized(true);

      } catch (error) {
        appLogger.error('Critical initialization error', error);
        setInitializationError(error.toString());
        mobileErrorHandler.handleError({
          type: 'crash',
          message: `App initialization failed: ${error}`
        });
      }
    };

    // Wait for app initialization hook to complete first
    if (appInitialization.isInitialized) {
      initializeApp();
    }
  }, [appInitialization.isInitialized]);

  const handleAppError = (error: Error, errorInfo: any) => {
    const appLogger = logger.createLogger('App');
    appLogger.error('Application-level error', error, { errorInfo });
    
    // Use mobile error handler for consistent error tracking
    mobileErrorHandler.handleError({
      type: 'crash',
      message: error.message,
      stack: error.stack,
      timestamp: Date.now()
    });

    // Log critical app errors for debugging
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      isNative: nativeAppInitService.isNativeAppInitialized()
    };
    
    appLogger.error('Detailed error context', undefined, errorData);

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
              onClick={() => {
                setInitializationError(null);
                setIsInitialized(false);
                window.location.reload();
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
            >
              Retry Initialization
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-600 text-white rounded-md"
            >
              Force Refresh
            </button>
          </div>
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
                <AppRoutes key={isInitialized ? 'initialized' : 'initializing'} />
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
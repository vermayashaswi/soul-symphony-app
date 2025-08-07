import React, { useEffect, useState } from 'react';
import AppRoutes from './routes/AppRoutes';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { NonBlockingSubscriptionProvider } from '@/contexts/NonBlockingSubscriptionContext';
import { TranslationLoadingOverlay } from '@/components/translation/TranslationLoadingOverlay';
import { JournalProcessingInitializer } from './app/journal-processing-init';
import { TutorialProvider } from './contexts/TutorialContext';
import TutorialOverlay from './components/tutorial/TutorialOverlay';
import ErrorBoundary from './components/insights/ErrorBoundary';
import { preloadCriticalImages } from './utils/imagePreloader';
import { toast } from 'sonner';
import './styles/emoji.css';
import './styles/tutorial.css';
import { FeatureFlagsProvider } from "./contexts/FeatureFlagsContext";
import { SessionTrackingProvider } from './contexts/SessionTrackingContext';
import { mobileErrorHandler } from './services/mobileErrorHandler';
import { useStreamlinedInitialization } from './hooks/useStreamlinedInitialization';
import { EmergencySplashManager } from './components/splash/EmergencySplashManager';
import { BackgroundSubscriptionInitializer } from '@/components/subscription/BackgroundSubscriptionInitializer';
import { logger } from './utils/logger';

const App: React.FC = () => {
  const appLogger = logger.createLogger('App');
  
  // Use streamlined initialization instead of complex multi-service initialization
  const { 
    isInitialized, 
    isInitializing, 
    error: initializationError, 
    timeout,
    stage 
  } = useStreamlinedInitialization();

  // Preload critical images in background (non-blocking)
  useEffect(() => {
    // Don't block initialization for image preloading
    setTimeout(() => {
      preloadCriticalImages().catch((error) => {
        appLogger.warn('Failed to preload some images (non-critical)', error);
      });
    }, 1000);
  }, [appLogger]);

  const handleAppError = (error: Error, errorInfo: any) => {
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
      stage,
      timeout
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
              Stage: {stage} | Error: {initializationError} | Timeout: {timeout ? 'Yes' : 'No'}
            </pre>
          </details>
          <div className="flex flex-col space-y-2 w-full">
            <button 
              onClick={() => window.location.reload()}
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
      <EmergencySplashManager isAppInitialized={isInitialized} maxEmergencyTimeout={2500}>
        <FeatureFlagsProvider>
          <NonBlockingSubscriptionProvider>
            <TutorialProvider>
              <TranslationLoadingOverlay />
              <JournalProcessingInitializer />
              <AppRoutes key={isInitialized ? 'initialized' : 'initializing'} />
              <TutorialOverlay />
              <BackgroundSubscriptionInitializer />
              <Toaster />
              <SonnerToaster position="top-right" />
            </TutorialProvider>
          </NonBlockingSubscriptionProvider>
        </FeatureFlagsProvider>
      </EmergencySplashManager>
    </ErrorBoundary>
  );
};

export default App;
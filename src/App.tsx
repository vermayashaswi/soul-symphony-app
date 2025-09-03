import React from 'react';
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
import { toast } from 'sonner';
import './styles/emoji.css';
import './styles/tutorial.css';
import { FeatureFlagsProvider } from "./contexts/FeatureFlagsContext";
import { SessionTrackingProvider } from './contexts/SessionTrackingContext';
import { mobileErrorHandler } from './services/mobileErrorHandler';
import { nativeAppInitService } from './services/nativeAppInitService';
import PullToRefresh from './components/system/PullToRefresh';
import { logger } from './utils/logger';

const App: React.FC = () => {

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
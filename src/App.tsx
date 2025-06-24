
import React, { useEffect, useState } from 'react';
import AppRoutes from './routes/AppRoutes';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TranslationProvider } from '@/contexts/TranslationContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
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
import TWAWrapper from './components/twa/TWAWrapper';
import TWAInitializationWrapper from './components/twa/TWAInitializationWrapper';
import { detectTWAEnvironment } from './utils/twaDetection';
import { useTWAAutoRefresh } from './hooks/useTWAAutoRefresh';
import { twaUpdateService } from './services/twaUpdateService';
import { nativeIntegrationService } from './services/nativeIntegrationService';
import { mobileErrorHandler } from './services/mobileErrorHandler';
import { mobileOptimizationService } from './services/mobileOptimizationService';

const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [emergencyRecovery, setEmergencyRecovery] = useState(false);
  const twaEnv = detectTWAEnvironment();
  const { refreshCount, isStuckDetected } = useTWAAutoRefresh();

  useEffect(() => {
    const initializeApp = async () => {
      // Clean up any malformed paths
      const currentPath = window.location.pathname;
      
      // Fix incorrectly formatted URLs that have domains or https in the path
      if (currentPath.includes('https://') || currentPath.includes('soulo.online')) {
        window.history.replaceState(null, '', '/');
      }
      
      // Apply a CSS class to the document body for theme-specific overrides
      document.body.classList.add('app-initialized');
      
      // Initialize mobile optimization service first
      try {
        await mobileOptimizationService.initialize();
        console.log('[App] Mobile optimization service initialized');
      } catch (error) {
        console.warn('[App] Mobile optimization failed:', error);
        mobileErrorHandler.handleError({
          type: 'unknown',
          message: `Mobile optimization failed: ${error}`
        });
      }
      
      // Initialize native platform features
      try {
        await nativeIntegrationService.initialize();
        console.log('[App] Native integration initialized');
      } catch (error) {
        console.warn('[App] Native integration failed:', error);
        mobileErrorHandler.handleError({
          type: 'crash',
          message: `Native integration failed: ${error}`
        });
      }
      
      // Initialize TWA update service
      if (twaEnv.isTWA || twaEnv.isStandalone) {
        console.log('[App] Initializing TWA update service');
        try {
          twaUpdateService.init();
        } catch (error) {
          console.warn('[App] TWA update service failed:', error);
          mobileErrorHandler.handleError({
            type: 'unknown',
            message: `TWA update service failed: ${error}`
          });
        }
      }
      
      // Preload critical images including the chat avatar
      try {
        preloadCriticalImages();
      } catch (error) {
        console.warn('Failed to preload some images:', error);
        // Non-critical error, continue app initialization
      }

      // Mark app as initialized after a brief delay to ensure smooth startup
      const initDelay = (twaEnv.isTWA || twaEnv.isStandalone) ? 1000 : 500;
      setTimeout(() => {
        setIsInitialized(true);
      }, initDelay);
    };

    initializeApp();

    // Emergency recovery mechanism for TWA apps that get stuck
    if (twaEnv.isTWA || twaEnv.isStandalone) {
      const recoveryTimeout = setTimeout(() => {
        // Only trigger emergency recovery if auto-refresh hasn't already handled it
        if (!isStuckDetected && refreshCount === 0) {
          console.warn('[App] Emergency recovery triggered - forcing app initialization');
          mobileErrorHandler.handleError({
            type: 'crash',
            message: 'App initialization timeout - emergency recovery triggered'
          });
          setEmergencyRecovery(true);
          setIsInitialized(true);
        }
      }, 20000); // 20 second emergency timeout for mobile

      return () => {
        clearTimeout(recoveryTimeout);
        twaUpdateService.destroy();
      };
    }

    return () => {
      twaUpdateService.destroy();
    };
  }, [twaEnv.isTWA, twaEnv.isStandalone, isStuckDetected, refreshCount]);

  const handleAppError = (error: Error, errorInfo: any) => {
    console.error('Application-level error:', error, errorInfo);
    
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
      isTWA: twaEnv.isTWA || twaEnv.isStandalone,
      isNative: nativeIntegrationService.isRunningNatively(),
      platform: nativeIntegrationService.getPlatform(),
      emergencyRecovery,
      autoRefreshCount: refreshCount
    };
    
    console.error('Detailed error info:', errorData);

    // Show user-friendly error notification
    toast.error('Something went wrong. The app will try to recover automatically.');

    // Trigger emergency recovery for TWA if needed and auto-refresh hasn't been tried
    if ((twaEnv.isTWA || twaEnv.isStandalone) && !emergencyRecovery && refreshCount === 0) {
      console.log('[App] Triggering emergency recovery due to error');
      setEmergencyRecovery(true);
    }
  };

  // Emergency recovery UI for TWA apps
  if (emergencyRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4 p-6 text-center max-w-md">
          <div className="text-2xl">🔄</div>
          <h2 className="text-xl font-semibold">App Recovery</h2>
          <p className="text-muted-foreground">
            The app encountered an issue and is recovering. Please wait a moment...
          </p>
          {refreshCount > 0 && (
            <p className="text-sm text-muted-foreground">
              Auto-refresh attempts: {refreshCount}
            </p>
          )}
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Refresh App
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary onError={handleAppError}>
      <FeatureFlagsProvider>
        <TranslationProvider>
          <SubscriptionProvider>
            <TutorialProvider>
              <TWAWrapper>
                <TWAInitializationWrapper>
                  <TranslationLoadingOverlay />
                  <JournalProcessingInitializer />
                  <AppRoutes key={isInitialized ? 'initialized' : 'initializing'} />
                  <TutorialOverlay />
                  <Toaster />
                  <SonnerToaster position="top-right" />
                </TWAInitializationWrapper>
              </TWAWrapper>
            </TutorialProvider>
          </SubscriptionProvider>
        </TranslationProvider>
      </FeatureFlagsProvider>
    </ErrorBoundary>
  );
};

export default App;

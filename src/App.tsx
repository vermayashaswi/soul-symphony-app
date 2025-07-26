import React, { useEffect, useState } from 'react';
import AppRoutes from './routes/AppRoutes';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
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
import { SessionProvider } from "./providers/SessionProvider";
import CapacitorWrapper from './components/capacitor/CapacitorWrapper';
import CapacitorInitializationWrapper from './components/capacitor/CapacitorInitializationWrapper';
import { nativeAppInitService } from './services/nativeAppInitService';
import { mobileErrorHandler } from './services/mobileErrorHandler';
import { mobileOptimizationService } from './services/mobileOptimizationService';
import { nativeIntegrationService } from './services/nativeIntegrationService';
import { nativeAuthService } from './services/nativeAuthService';
import { useAppInitialization } from './hooks/useAppInitialization';

const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [emergencyRecovery, setEmergencyRecovery] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const appInitialization = useAppInitialization();

  useEffect(() => {
      if (nativeIntegrationService.isRunningNatively()) {
          console.log('[App] Initializing native services');
          nativeAuthService.initialize();
        }
    const initializeApp = async () => {
      try {
        console.log('[App] Starting app initialization...');
        
        // Clean up any malformed paths
        const currentPath = window.location.pathname;
        
        // Fix incorrectly formatted URLs that have domains or external references in the path
        if (currentPath.includes('https://') || currentPath.includes('soulo.online')) {
          window.history.replaceState(null, '', '/');
        }
        
        // Apply a CSS class to the document body for theme-specific overrides
        document.body.classList.add('app-initialized');
        
        // Initialize mobile optimization service first
        try {
          console.log('[App] Initializing mobile optimization service...');
          await mobileOptimizationService.initialize();
          console.log('[App] Mobile optimization service initialized');
        } catch (error) {
          console.warn('[App] Mobile optimization failed:', error);
          mobileErrorHandler.handleError({
            type: 'unknown',
            message: `Mobile optimization failed: ${error}`
          });
        }
        
        // Initialize native app using the new service
        try {
          console.log('[App] Initializing native app service...');
          const nativeInitSuccess = await nativeAppInitService.initialize();
          
          if (nativeInitSuccess) {
            console.log('[App] Native app initialization completed successfully');
            
            // Get initialization status for debugging
            const initStatus = await nativeAppInitService.getInitializationStatus();
            console.log('[App] Native app initialization status:', initStatus);
            
            // If we're in a native environment, ensure proper routing
            if (initStatus.nativeEnvironment) {
              console.log('[App] Native environment confirmed - app will route to app interface');
            }
            
          } else {
            console.warn('[App] Native app initialization failed, continuing with web fallback');
          }
        } catch (error) {
          console.warn('[App] Native app initialization error:', error);
          mobileErrorHandler.handleError({
            type: 'capacitor',
            message: `Native app init failed: ${error}`
          });
        }
        
        // Native app services are already initialized above
        
        // Preload critical images including the chat avatar
        try {
          console.log('[App] Preloading critical images...');
          preloadCriticalImages();
        } catch (error) {
          console.warn('Failed to preload some images:', error);
          // Non-critical error, continue app initialization
        }

        // Mark app as initialized after a brief delay to ensure smooth startup
        // Shorter delay for native apps to hide splash screen faster
        const isNativeApp = nativeAppInitService.isNativeAppInitialized();
        const initDelay = isNativeApp ? 200 : 500;
        
        console.log('[App] Setting initialization delay:', initDelay, 'ms (native:', isNativeApp, ')');
        
        setTimeout(() => {
          console.log('[App] App initialization completed - setting isInitialized to true');
          setIsInitialized(true);
        }, initDelay);

      } catch (error) {
        console.error('[App] Critical initialization error:', error);
        setInitializationError(error.toString());
        mobileErrorHandler.handleError({
          type: 'crash',
          message: `App initialization failed: ${error}`
        });
      }
    };

    initializeApp();

    // Emergency recovery mechanism for native apps that get stuck
    if (nativeIntegrationService.isRunningNatively()) {
      const recoveryTimeout = setTimeout(() => {
        if (!isInitialized) {
          console.warn('[App] Emergency recovery triggered - forcing app initialization');
          mobileErrorHandler.handleError({
            type: 'crash',
            message: 'App initialization timeout - emergency recovery triggered'
          });
          setEmergencyRecovery(true);
          setIsInitialized(true);
        }
      }, 25000); // 25 second emergency timeout for mobile

      return () => {
        clearTimeout(recoveryTimeout);
      };
    }
  }, [isInitialized]);

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
      isNative: nativeAppInitService.isNativeAppInitialized(),
      emergencyRecovery
    };
    
    console.error('Detailed error info:', errorData);

    // Show user-friendly error notification
    toast.error('Something went wrong. The app will try to recover automatically.');

    // Trigger emergency recovery for native apps if needed
    if (nativeIntegrationService.isRunningNatively() && !emergencyRecovery) {
      console.log('[App] Triggering emergency recovery due to error');
      setEmergencyRecovery(true);
    }
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

  // Emergency recovery UI for native apps
  if (emergencyRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4 p-6 text-center max-w-md">
          <div className="text-2xl animate-spin">🔄</div>
          <h2 className="text-xl font-semibold">App Recovery</h2>
          <p className="text-muted-foreground">
            The app encountered an issue and is recovering. Please wait a moment...
          </p>
          <div className="flex flex-col space-y-2 w-full">
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
            >
              Refresh App
            </button>
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm"
            >
              Reset App Data
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary onError={handleAppError}>
      <FeatureFlagsProvider>
        <SubscriptionProvider>
          <TutorialProvider>
            <SessionProvider>
              <CapacitorWrapper>
                <CapacitorInitializationWrapper>
                  <TranslationLoadingOverlay />
                  <JournalProcessingInitializer />
                  <AppRoutes key={isInitialized ? 'initialized' : 'initializing'} />
                  <TutorialOverlay />
                  <Toaster />
                  <SonnerToaster position="top-right" />
                </CapacitorInitializationWrapper>
              </CapacitorWrapper>
            </SessionProvider>
          </TutorialProvider>
        </SubscriptionProvider>
      </FeatureFlagsProvider>
    </ErrorBoundary>
  );
};

export default App;

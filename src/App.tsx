import React from 'react';
import AppRoutes from './routes/AppRoutes';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { TranslationLoadingOverlay } from '@/components/translation/TranslationLoadingOverlay';
import { JournalProcessingInitializer } from './app/journal-processing-init';
import { TutorialProvider } from './contexts/TutorialContext';
import TutorialOverlay from './components/tutorial/TutorialOverlay';
import ErrorBoundary from './components/insights/ErrorBoundary';
import { toast } from 'sonner';
import './styles/emoji.css';
import './styles/tutorial.css';
import { FeatureFlagsProvider } from "./contexts/FeatureFlagsContext";
import TWAWrapper from './components/twa/TWAWrapper';
import TWAInitializationWrapper from './components/twa/TWAInitializationWrapper';
import { useSimpleNativeInit } from './hooks/useSimpleNativeInit';
import { useAppInitialization } from './hooks/useAppInitialization';
import { NativeDebugPanel } from './components/debug/NativeDebugPanel';

const App: React.FC = () => {
  const nativeInit = useSimpleNativeInit();
  const appInitialization = useAppInitialization();

  // Simplified initialization check
  const isInitialized = nativeInit.isInitialized && appInitialization.isInitialized;

  const handleAppError = (error: Error, errorInfo: any) => {
    console.error('[App] Application-level error:', error, errorInfo);
    
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      isNative: nativeInit.nativeEnvironment,
      initState: nativeInit
    };
    
    console.error('[App] Detailed error info:', errorData);
    toast.error('Something went wrong. Please try refreshing the app.');
  };

  // Show initialization error screen
  if (nativeInit.error || appInitialization.error) {
    const error = nativeInit.error || appInitialization.error;
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
              {error}
            </pre>
          </details>
          <div className="flex flex-col space-y-2 w-full">
            <button 
              onClick={() => {
                nativeInit.reset();
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

  // Loading screen during initialization
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4 p-6 text-center max-w-md">
          <div className="text-2xl animate-spin">🔄</div>
          <h2 className="text-xl font-semibold">Loading Soulo</h2>
          <p className="text-muted-foreground">
            Initializing your voice journaling experience...
          </p>
          {nativeInit.nativeEnvironment && (
            <p className="text-sm text-muted-foreground">
              Native app mode detected
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary onError={handleAppError}>
      <FeatureFlagsProvider>
        <SubscriptionProvider>
          <TutorialProvider>
            <TWAWrapper>
              <TWAInitializationWrapper>
                <TranslationLoadingOverlay />
                <JournalProcessingInitializer />
                <AppRoutes />
                <TutorialOverlay />
                <Toaster />
                <SonnerToaster position="top-right" />
                <NativeDebugPanel />
              </TWAInitializationWrapper>
            </TWAWrapper>
          </TutorialProvider>
        </SubscriptionProvider>
      </FeatureFlagsProvider>
    </ErrorBoundary>
  );
};

export default App;

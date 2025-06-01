
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

const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationStage, setInitializationStage] = useState('starting');

  useEffect(() => {
    console.log('[App] App mounted, current path:', window.location.pathname);
    
    const initializeApp = async () => {
      try {
        setInitializationStage('cleaning-paths');
        
        // Clean up any malformed paths
        const currentPath = window.location.pathname;
        
        // Fix incorrectly formatted URLs that have domains or https in the path
        if (currentPath.includes('https://') || currentPath.includes('soulo.online')) {
          console.log('[App] Fixing malformed URL path:', currentPath);
          window.history.replaceState(null, '', '/');
        }
        
        setInitializationStage('setting-theme');
        
        // Apply a CSS class to the document body for theme-specific overrides
        document.body.classList.add('app-initialized');
        
        setInitializationStage('preloading-images');
        
        // Preload critical images including the chat avatar
        try {
          await preloadCriticalImages();
          console.log('[App] Critical images preloaded successfully');
        } catch (error) {
          console.warn('[App] Failed to preload some images:', error);
          // Non-critical error, continue app initialization
        }

        setInitializationStage('finalizing');
        
        // Mark app as initialized after ensuring all systems are ready
        setTimeout(() => {
          setIsInitialized(true);
          setInitializationStage('complete');
          console.log('[App] App marked as fully initialized');
        }, 100);
        
      } catch (error) {
        console.error('[App] Initialization error:', error);
        // Still mark as initialized to prevent hanging
        setIsInitialized(true);
        setInitializationStage('complete');
      }
    };

    initializeApp();
  }, []);

  const handleAppError = (error: Error, errorInfo: any) => {
    console.error('[App] Application-level error:', error, errorInfo);
    
    // Log critical app errors for debugging
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      initializationStage
    };
    
    console.error('[App] Detailed error info:', errorData);

    // Show user-friendly error notification
    toast.error('Something went wrong. The app will try to recover automatically.');

    // Allow the app to continue functioning despite errors
  };

  // Show loading state during critical initialization phases
  if (!isInitialized && (initializationStage === 'starting' || initializationStage === 'cleaning-paths')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Initializing app...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary onError={handleAppError}>
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
    </ErrorBoundary>
  );
};

export default App;

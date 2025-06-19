
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
import SplashScreen from './components/pwa/SplashScreen';
import './styles/emoji.css';
import './styles/tutorial.css';
import { FeatureFlagsProvider } from "./contexts/FeatureFlagsContext";

const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSplashScreen, setShowSplashScreen] = useState(true);
  const [appReady, setAppReady] = useState(false);

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
      
      try {
        // Preload critical images including the chat avatar
        await preloadCriticalImages();
      } catch (error) {
        console.warn('Failed to preload some images:', error);
        // Non-critical error, continue app initialization
      }

      // Simulate app initialization process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIsInitialized(true);
      
      // Additional delay to ensure smooth transition
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setAppReady(true);
    };

    initializeApp();
  }, []);

  const handleSplashComplete = () => {
    setShowSplashScreen(false);
  };

  const handleAppError = (error: Error, errorInfo: any) => {
    console.error('Application-level error:', error, errorInfo);
    
    // Log critical app errors for debugging
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    console.error('Detailed error info:', errorData);

    // Show user-friendly error notification
    toast.error('Something went wrong. The app will try to recover automatically.');

    // Allow the app to continue functioning despite errors
  };

  // Show splash screen during initialization
  if (showSplashScreen) {
    return (
      <SplashScreen 
        isLoading={!appReady} 
        onComplete={handleSplashComplete}
        minDisplayTime={2500}
      />
    );
  }

  return (
    <ErrorBoundary onError={handleAppError}>
      <FeatureFlagsProvider>
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
      </FeatureFlagsProvider>
    </ErrorBoundary>
  );
};

export default App;

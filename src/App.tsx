
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
  const [showSplashScreen, setShowSplashScreen] = useState(true);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Clean up any malformed paths
        const currentPath = window.location.pathname;
        
        if (currentPath.includes('https://') || currentPath.includes('soulo.online')) {
          window.history.replaceState(null, '', '/');
        }
        
        // Apply CSS class for theme-specific overrides
        document.body.classList.add('app-initialized');
        
        // Preload critical images (non-blocking)
        preloadCriticalImages().catch(error => {
          console.warn('Failed to preload some images:', error);
        });

        // Simulate brief initialization
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        setAppReady(true);
        
        // Additional delay for smooth transition
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error('App initialization error:', error);
        // Continue even if initialization fails
        setAppReady(true);
      }
    };

    initializeApp();
  }, []);

  const handleSplashComplete = () => {
    setShowSplashScreen(false);
  };

  const handleAppError = (error: Error, errorInfo: any) => {
    console.error('Application-level error:', error, errorInfo);
    
    // Show user-friendly error notification
    toast.error('Something went wrong. The app will try to recover automatically.');
  };

  // Show splash screen during initialization
  if (showSplashScreen) {
    return (
      <SplashScreen 
        isLoading={!appReady} 
        onComplete={handleSplashComplete}
        minDisplayTime={2000}
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
              <AppRoutes />
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

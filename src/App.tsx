
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

const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Clean up any malformed paths
    const currentPath = window.location.pathname;
    
    if (currentPath.includes('https://') || currentPath.includes('soulo.online')) {
      window.history.replaceState(null, '', '/');
    }
    
    document.body.classList.add('app-initialized');
    
    // Preload critical images
    try {
      preloadCriticalImages();
    } catch (error) {
      console.warn('Failed to preload some images:', error);
    }

    // Simple cache busting for updates
    const cacheVersion = Date.now().toString();
    sessionStorage.setItem('cache-version', cacheVersion);

    setTimeout(() => {
      setIsInitialized(true);
    }, 500);
  }, []);

  const handleAppError = (error: Error, errorInfo: any) => {
    console.error('Application-level error:', error, errorInfo);
    
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    console.error('Detailed error info:', errorData);
    toast.error('Something went wrong. The app will try to recover automatically.');
  };

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

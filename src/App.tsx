
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
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    console.log('[App] App mounted, current path:', window.location.pathname);
    
    // Clean up any malformed paths
    const currentPath = window.location.pathname;
    
    // Fix incorrectly formatted URLs that have domains or https in the path
    if (currentPath.includes('https://') || currentPath.includes('soulo.online')) {
      console.log('[App] Fixing malformed URL path:', currentPath);
      window.history.replaceState(null, '', '/');
    }
    
    // Apply a CSS class to the document body for theme-specific overrides
    document.body.classList.add('app-initialized');
    
    // Preload critical images with error handling
    try {
      preloadCriticalImages();
      console.log('[App] Critical images preloaded successfully');
    } catch (error) {
      console.warn('[App] Failed to preload some images:', error);
      // Non-critical error, continue app initialization
    }

    // Mark app as initialized immediately to prevent hanging
    setIsInitialized(true);
    console.log('[App] App marked as fully initialized');
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
      url: window.location.href
    };
    
    console.error('[App] Detailed error info:', errorData);

    // Show user-friendly error notification
    toast.error('Something went wrong. The app will try to recover automatically.');

    // Set error state but don't crash the app
    setHasError(true);

    // Allow the app to continue functioning despite errors
  };

  // If there's a critical error, show fallback UI
  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
          <p className="text-gray-600 mb-4">The app encountered an error. Please try refreshing the page.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh Page
          </button>
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

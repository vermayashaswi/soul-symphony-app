
import React, { useEffect } from 'react';
import AppRoutes from './routes/AppRoutes';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TranslationProvider } from '@/contexts/TranslationContext';
import { TranslationLoadingOverlay } from '@/components/translation/TranslationLoadingOverlay';
import { JournalProcessingInitializer } from './app/journal-processing-init';
import { TutorialProvider } from './contexts/TutorialContext';
import TutorialOverlay from './components/tutorial/TutorialOverlay';
import ErrorBoundary from './components/insights/ErrorBoundary';
import { preloadCriticalImages } from './utils/imagePreloader';
import './styles/emoji.css';
import './styles/tutorial.css';

const App: React.FC = () => {
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
    
    // Preload critical images including the chat avatar
    preloadCriticalImages();
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
  };

  return (
    <ErrorBoundary onError={handleAppError}>
      <TranslationProvider>
        <TutorialProvider>
          <TranslationLoadingOverlay />
          <JournalProcessingInitializer />
          <AppRoutes />
          <TutorialOverlay />
          <Toaster />
          <SonnerToaster position="top-right" />
        </TutorialProvider>
      </TranslationProvider>
    </ErrorBoundary>
  );
};

export default App;

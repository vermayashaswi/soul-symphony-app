
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
import AppErrorBoundary from './components/AppErrorBoundary';
import { preloadCriticalImages } from './utils/imagePreloader';
import { toast } from 'sonner';
import './styles/emoji.css';
import './styles/tutorial.css';

const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    console.log('[App] App mounted, current path:', window.location.pathname);
    
    // Clean up any malformed paths
    const currentPath = window.location.pathname;
    
    if (currentPath.includes('https://') || currentPath.includes('soulo.online')) {
      console.log('[App] Fixing malformed URL path:', currentPath);
      window.history.replaceState(null, '', '/');
    }
    
    document.body.classList.add('app-initialized');
    
    // Preload critical images
    try {
      preloadCriticalImages();
      console.log('[App] Critical images preloaded successfully');
    } catch (error) {
      console.warn('[App] Failed to preload some images:', error);
    }

    setTimeout(() => {
      setIsInitialized(true);
      console.log('[App] App marked as fully initialized');
    }, 200);
  }, []);

  const handleAppError = (error: Error, errorInfo: any) => {
    console.error('[App] Application-level error:', error, errorInfo);
    toast.error('Something went wrong. The app will try to recover automatically.');
  };

  return (
    <AppErrorBoundary>
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
    </AppErrorBoundary>
  );
};

export default App;

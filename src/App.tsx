
import React, { useEffect } from 'react';
import AppRoutes from './routes/AppRoutes';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TranslationProvider } from '@/contexts/TranslationContext';
import { TranslationLoadingOverlay } from '@/components/translation/TranslationLoadingOverlay';
import { JournalProcessingInitializer } from './app/journal-processing-init';
import { TutorialProvider } from './contexts/TutorialContext';
import TutorialOverlay from './components/tutorial/TutorialOverlay';
import './styles/emoji.css';
import './styles/tutorial.css'; // Ensure tutorial styles are imported

const App: React.FC = () => {
  useEffect(() => {
    console.log('App mounted, current path:', window.location.pathname);
    
    // Clean up any malformed paths
    const currentPath = window.location.pathname;
    
    // Fix incorrectly formatted URLs that have domains or https in the path
    if (currentPath.includes('https://') || currentPath.includes('soulo.online')) {
      console.log('Fixing malformed URL path:', currentPath);
      window.history.replaceState(null, '', '/');
    }
    
    // Apply a CSS class to the document body for theme-specific overrides
    document.body.classList.add('app-initialized');
  }, []);

  return (
    <TranslationProvider>
      <TutorialProvider>
        <TranslationLoadingOverlay />
        <JournalProcessingInitializer />
        <AppRoutes />
        {/* Add the TutorialOverlay at the root level so it's available on all pages */}
        <TutorialOverlay />
        <Toaster />
        <SonnerToaster position="top-right" />
      </TutorialProvider>
    </TranslationProvider>
  );
};

export default App;

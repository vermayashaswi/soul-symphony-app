
import React, { useEffect } from 'react';
import AppRoutes from './routes/AppRoutes';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TranslationProvider } from '@/contexts/TranslationContext';
import { TranslationLoadingOverlay } from '@/components/translation/TranslationLoadingOverlay';
import { JournalProcessingInitializer } from './app/journal-processing-init';
import { TutorialProvider } from '@/contexts/TutorialContext';
import './styles/emoji.css';
import { TooltipProvider } from '@/components/ui/tooltip';

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
  }, []);

  return (
    <TranslationProvider>
      <TutorialProvider>
        <TooltipProvider delayDuration={0}>
          <TranslationLoadingOverlay />
          <JournalProcessingInitializer />
          <AppRoutes />
          <Toaster />
          <SonnerToaster position="top-right" />
        </TooltipProvider>
      </TutorialProvider>
    </TranslationProvider>
  );
};

export default App;

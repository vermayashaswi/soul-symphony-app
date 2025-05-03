
import React, { useEffect } from 'react';
import AppRoutes from './routes/AppRoutes';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TranslationProvider } from '@/contexts/TranslationContext';
import { TranslationLoadingOverlay } from '@/components/translation/TranslationLoadingOverlay';
import { JournalProcessingInitializer } from './app/journal-processing-init';
import './styles/emoji.css';

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
    
    // CRITICAL FIX: If the user is at the root path and this is the Insights component,
    // redirect them to the proper /app/insights path
    if ((currentPath === '/' || currentPath === '') && 
        (document.title.includes('Insights') || document.location.href.includes('insights'))) {
      console.log('Detected Insights at root path, redirecting to /app/insights');
      window.history.replaceState(null, '', '/app/insights');
    }

    // Redirect from index to /app/insights when needed
    if ((currentPath === '/index.html' || currentPath === '/index') && 
        (document.title.includes('Insights') || document.location.href.includes('insights'))) {
      console.log('Detected Insights at index path, redirecting to /app/insights');
      window.history.replaceState(null, '', '/app/insights');
    }

    // Debug logging to help identify route issues in deployment
    console.log('Current document title:', document.title);
    console.log('Current URL:', document.location.href);
  }, []);

  return (
    <TranslationProvider>
      <TranslationLoadingOverlay />
      <JournalProcessingInitializer />
      <AppRoutes />
      <Toaster />
      <SonnerToaster position="top-right" />
    </TranslationProvider>
  );
};

export default App;


import React, { useEffect } from 'react';
import AppRoutes from './routes/AppRoutes';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TranslationProvider } from '@/contexts/TranslationContext';
import { TranslationLoadingOverlay } from '@/components/translation/TranslationLoadingOverlay';
import { JournalProcessingInitializer } from './app/journal-processing-init';
import './styles/emoji.css';

// Add a global error boundary for toast operations
if (typeof window !== 'undefined') {
  // Override toast dismiss method with error handling
  const originalToastDismiss = window.toast?.dismiss;
  if (originalToastDismiss) {
    window.toast.dismiss = function(...args: any[]) {
      try {
        return originalToastDismiss.apply(this, args);
      } catch (e) {
        console.warn('Error in toast.dismiss:', e);
        return undefined;
      }
    };
  }
}

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
      <TranslationLoadingOverlay />
      <JournalProcessingInitializer />
      <AppRoutes />
      <Toaster />
      <SonnerToaster 
        position="top-right" 
        closeButton
        richColors
        toastOptions={{
          duration: 3000, // Shorter duration to minimize conflicts
          style: { 
            zIndex: 1000,
            position: 'relative'
          }
        }}
      />
    </TranslationProvider>
  );
};

export default App;

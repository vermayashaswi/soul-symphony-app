
import React, { useEffect } from 'react';
import AppRoutes from './routes/AppRoutes';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TranslationProvider } from '@/contexts/TranslationContext';
import { TranslationLoadingOverlay } from '@/components/translation/TranslationLoadingOverlay';
import { JournalProcessingInitializer } from './app/journal-processing-init';
import './styles/emoji.css';

// Add type declaration for the toast property on Window
declare global {
  interface Window {
    toast?: {
      dismiss: (...args: any[]) => any;
      [key: string]: any;
    };
  }
}

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

    // TEMPORARY SOLUTION: Reset all tutorial flags in localStorage
    // This will ensure the tutorial shows up again for all users
    // Remove this block once all users have seen the tutorial again
    const resetAllTutorialFlags = () => {
      console.log('Resetting all tutorial flags in localStorage');
      localStorage.removeItem('soulo_tutorial_completed');
      localStorage.removeItem('soulo_tutorial_current_step');
      localStorage.removeItem('onboardingComplete');
      localStorage.removeItem('soulo_visited_app_before');
      
      // Set a flag to indicate we've already reset the flags for this user's session
      // This prevents resetting on every app reload
      if (!localStorage.getItem('tutorial_reset_20250506')) {
        localStorage.setItem('tutorial_reset_20250506', 'true');
        console.log('Tutorial flags reset complete');
      }
    };

    // Execute the reset
    resetAllTutorialFlags();
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

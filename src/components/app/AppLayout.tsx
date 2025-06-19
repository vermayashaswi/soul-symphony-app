
import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { TranslationLoadingOverlay } from '@/components/translation/TranslationLoadingOverlay';
import { JournalProcessingInitializer } from '@/app/journal-processing-init';
import TutorialOverlay from '@/components/tutorial/TutorialOverlay';
import SplashScreen from '@/components/pwa/SplashScreen';
import { preloadCriticalImages } from '@/utils/imagePreloader';

const AppLayout: React.FC = () => {
  const [showSplashScreen, setShowSplashScreen] = useState(true);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Clean up any malformed paths
        const currentPath = window.location.pathname;
        
        if (currentPath.includes('https://') || currentPath.includes('soulo.online')) {
          window.history.replaceState(null, '', '/app');
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
    <>
      <TranslationLoadingOverlay />
      <JournalProcessingInitializer />
      <TutorialOverlay />
      <Outlet />
    </>
  );
};

export default AppLayout;

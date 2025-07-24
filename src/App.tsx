import React, { useEffect, useState } from 'react';
import AppRoutes from './routes/AppRoutes';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
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
import { SessionProvider } from "./providers/SessionProvider";
import TWAWrapper from './components/twa/TWAWrapper';
import { nativeAppInitService } from './services/nativeAppInitService';
import { mobileErrorHandler } from './services/mobileErrorHandler';
import { mobileOptimizationService } from './services/mobileOptimizationService';
import { nativeIntegrationService } from './services/nativeIntegrationService';
import { nativeAuthService } from './services/nativeAuthService';
import { useAppInitialization } from './hooks/useAppInitialization';

const App: React.FC = () => {
  const appInitialization = useAppInitialization();

  useEffect(() => {
    if (nativeIntegrationService.isRunningNatively()) {
      console.log('[App] Initializing native services');
      nativeAuthService.initialize();
    }

    const initializeApp = async () => {
      try {
        console.log('[App] Starting app initialization...');
        
        // Clean up any malformed paths
        const currentPath = window.location.pathname;
        
        // Fix incorrectly formatted URLs that have domains or external references in the path
        if (currentPath.includes('https://') || currentPath.includes('soulo.online')) {
          window.history.replaceState(null, '', '/');
        }
        
        // Apply a CSS class to the document body for theme-specific overrides
        document.body.classList.add('app-initialized');
        
        // Initialize mobile optimization service
        try {
          console.log('[App] Initializing mobile optimization service...');
          await mobileOptimizationService.initialize();
          console.log('[App] Mobile optimization service initialized');
        } catch (error) {
          console.warn('[App] Mobile optimization failed:', error);
          mobileErrorHandler.handleError({
            type: 'unknown',
            message: `Mobile optimization failed: ${error}`
          });
        }
        
        // Initialize native app service
        try {
          console.log('[App] Initializing native app service...');
          const nativeInitSuccess = await nativeAppInitService.initialize();
          
          if (nativeInitSuccess) {
            console.log('[App] Native app initialization completed successfully');
            
            // Get initialization status for debugging
            const initStatus = await nativeAppInitService.getInitializationStatus();
            console.log('[App] Native app initialization status:', initStatus);
            
            // If we're in a native environment, ensure proper routing
            if (initStatus.nativeEnvironment) {
              console.log('[App] Native environment confirmed - app will route to app interface');
            }
          } else {
            console.warn('[App] Native app initialization failed, continuing with web fallback');
          }
        } catch (error) {
          console.warn('[App] Native app initialization error:', error);
          mobileErrorHandler.handleError({
            type: 'capacitor',
            message: `Native app init failed: ${error}`
          });
        }
        
        // Preload critical images
        try {
          console.log('[App] Preloading critical images...');
          preloadCriticalImages();
        } catch (error) {
          console.warn('Failed to preload some images:', error);
          // Non-critical error, continue app initialization
        }

        console.log('[App] App initialization completed');
      } catch (error) {
        console.error('[App] Critical initialization error:', error);
        mobileErrorHandler.handleError({
          type: 'crash',
          message: `App initialization failed: ${error}`
        });
      }
    };

    initializeApp();
  }, []);

  const handleAppError = (error: Error, errorInfo: any) => {
    console.error('Application-level error:', error, errorInfo);
    
    // Use mobile error handler for consistent error tracking
    mobileErrorHandler.handleError({
      type: 'crash',
      message: error.message,
      stack: error.stack,
      timestamp: Date.now()
    });

    // Log critical app errors for debugging
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      isNative: nativeAppInitService.isNativeAppInitialized()
    };
    
    console.error('Detailed error info:', errorData);

    // Show user-friendly error notification
    toast.error('Something went wrong. Please try refreshing the app.');
  };

  return (
    <ErrorBoundary onError={handleAppError}>
      <FeatureFlagsProvider>
        <SubscriptionProvider>
          <TutorialProvider>
            <TWAWrapper>
              <TranslationLoadingOverlay />
              <JournalProcessingInitializer />
              <AppRoutes />
              <TutorialOverlay />
              <Toaster />
              <SonnerToaster position="top-right" />
            </TWAWrapper>
          </TutorialProvider>
        </SubscriptionProvider>
      </FeatureFlagsProvider>
    </ErrorBoundary>
  );
};

export default App;

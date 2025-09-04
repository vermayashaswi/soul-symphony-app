import React from 'react';
import AppRoutes from './routes/AppRoutes';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { JournalProcessingInitializer } from './app/journal-processing-init';
import { TutorialProvider } from './contexts/TutorialContext';
import { MusicPlayerProvider } from '@/contexts/MusicPlayerContext';
import TutorialOverlay from './components/tutorial/TutorialOverlay';
import ErrorBoundary from './components/insights/ErrorBoundary';
import { AuthErrorBoundary } from './components/error-boundaries/AuthErrorBoundary';
import './styles/emoji.css';
import './styles/tutorial.css';
import { FeatureFlagsProvider } from "./contexts/FeatureFlagsContext";
import PullToRefresh from './components/system/PullToRefresh';
import { AppLoadingScreen } from './components/app/AppLoadingScreen';
import { useAppInitializationContext } from './contexts/AppInitializationContext';

const App: React.FC = () => {
  const { isAppReady } = useAppInitializationContext();

  // Show loading screen until all initialization is complete
  if (!isAppReady) {
    return <AppLoadingScreen />;
  }

  const handleAppError = (error: Error, errorInfo: any) => {
    console.error('Application-level error', error, errorInfo);
    // Show user-friendly error notification but don't crash the app
  };

  return (
    <ErrorBoundary onError={handleAppError}>
      <AuthErrorBoundary>
        <FeatureFlagsProvider>
          <SubscriptionProvider>
            <TutorialProvider>
              <MusicPlayerProvider>
                <JournalProcessingInitializer />
                <PullToRefresh>
                  <AppRoutes />
                  <TutorialOverlay />
                  <Toaster />
                  <SonnerToaster position="top-right" />
                </PullToRefresh>
              </MusicPlayerProvider>
            </TutorialProvider>
          </SubscriptionProvider>
        </FeatureFlagsProvider>
      </AuthErrorBoundary>
    </ErrorBoundary>
  );
};

export default App;
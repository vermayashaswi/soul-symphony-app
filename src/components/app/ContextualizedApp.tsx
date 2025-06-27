
import React from 'react';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { TutorialProvider } from '@/contexts/TutorialContext';
import { FeatureFlagsProvider } from '@/contexts/FeatureFlagsContext';
import { TranslationLoadingOverlay } from '@/components/translation/TranslationLoadingOverlay';
import { JournalProcessingInitializer } from '@/app/journal-processing-init';
import TutorialOverlay from '@/components/tutorial/TutorialOverlay';
import TWAWrapper from '@/components/twa/TWAWrapper';
import TWAInitializationWrapper from '@/components/twa/TWAInitializationWrapper';
import AppRoutes from '@/routes/AppRoutes';
import AuthGuard from '@/components/auth/AuthGuard';

const ContextualizedApp: React.FC = () => {
  return (
    <FeatureFlagsProvider>
      <AuthGuard
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center p-6 max-w-md">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <h2 className="text-xl font-semibold mb-2">Starting App</h2>
              <p className="text-muted-foreground">
                Initializing authentication system...
              </p>
            </div>
          </div>
        }
      >
        <SubscriptionProvider>
          <TutorialProvider>
            <TWAWrapper>
              <TWAInitializationWrapper>
                <TranslationLoadingOverlay />
                <JournalProcessingInitializer />
                <AppRoutes />
                <TutorialOverlay />
              </TWAInitializationWrapper>
            </TWAWrapper>
          </TutorialProvider>
        </SubscriptionProvider>
      </AuthGuard>
    </FeatureFlagsProvider>
  );
};

export default ContextualizedApp;

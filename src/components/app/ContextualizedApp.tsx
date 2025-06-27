
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

const ContextualizedApp: React.FC = () => {
  return (
    <FeatureFlagsProvider>
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
    </FeatureFlagsProvider>
  );
};

export default ContextualizedApp;

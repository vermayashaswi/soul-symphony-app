import React, { ReactNode } from 'react';
import { FeatureFlagsProvider } from './FeatureFlagsContext';
import { SubscriptionProvider } from './SubscriptionContext';
import { TutorialProvider } from './TutorialContext';

/**
 * App Context Provider - Includes all contexts needed for app pages
 * This includes authentication-dependent contexts
 */
export const AppContextProvider = ({ children }: { children: ReactNode }) => {
  return (
    <FeatureFlagsProvider>
      <SubscriptionProvider>
        <TutorialProvider>
          {children}
        </TutorialProvider>
      </SubscriptionProvider>
    </FeatureFlagsProvider>
  );
};
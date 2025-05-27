
import React from 'react';
import { usePremiumAccess } from '@/hooks/use-premium-access';
import { SubscriptionPromptModal } from './SubscriptionPromptModal';

interface PremiumGuardProps {
  children: React.ReactNode;
  feature: string;
  description?: string;
  fallback?: React.ReactNode;
  blockInteraction?: boolean;
}

export function PremiumGuard({
  children,
  feature,
  description,
  fallback,
  blockInteraction = true
}: PremiumGuardProps) {
  const { 
    canAccessFeature, 
    showUpgradePrompt, 
    upgradePromptState, 
    closeUpgradePrompt 
  } = usePremiumAccess();

  const hasAccess = canAccessFeature(feature);

  const handleInteraction = (e: React.MouseEvent) => {
    if (!hasAccess && blockInteraction) {
      e.preventDefault();
      e.stopPropagation();
      showUpgradePrompt(feature, description);
    }
  };

  if (!hasAccess && fallback) {
    return (
      <>
        {fallback}
        <SubscriptionPromptModal
          isOpen={upgradePromptState.isOpen}
          onClose={closeUpgradePrompt}
          feature={upgradePromptState.feature}
          description={upgradePromptState.description}
        />
      </>
    );
  }

  return (
    <>
      <div 
        onClick={handleInteraction}
        className={!hasAccess && blockInteraction ? 'cursor-not-allowed' : ''}
      >
        {children}
      </div>
      
      <SubscriptionPromptModal
        isOpen={upgradePromptState.isOpen}
        onClose={closeUpgradePrompt}
        feature={upgradePromptState.feature}
        description={upgradePromptState.description}
      />
    </>
  );
}

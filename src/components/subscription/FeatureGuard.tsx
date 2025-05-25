
import React from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SubscriptionPrompt } from './SubscriptionPrompt';

interface FeatureGuardProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const FeatureGuard: React.FC<FeatureGuardProps> = ({ 
  feature, 
  children, 
  fallback 
}) => {
  const { hasFeatureAccess, isLoading } = useSubscription();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasFeatureAccess(feature)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return <SubscriptionPrompt feature={feature} />;
  }

  return <>{children}</>;
};

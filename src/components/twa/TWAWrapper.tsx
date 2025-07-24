
import React from 'react';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

interface TWAWrapperProps {
  children: React.ReactNode;
}

const TWAWrapper: React.FC<TWAWrapperProps> = ({ children }) => {
  // For native apps, we simply render children without any TWA-specific logic
  const isNative = nativeIntegrationService.isRunningNatively();
  
  if (isNative) {
    console.log('[TWAWrapper] Running in native environment, no TWA handling needed');
  }

  return <>{children}</>;
};

export default TWAWrapper;

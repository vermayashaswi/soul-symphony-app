
import React, { useEffect } from 'react';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

interface CapacitorInitProps {
  children: React.ReactNode;
}

export const CapacitorInit: React.FC<CapacitorInitProps> = ({ children }) => {
  useEffect(() => {
    console.log('[CapacitorInit] Initializing native integration service');
    
    // Initialize native services when the app starts
    nativeIntegrationService.initialize().then(() => {
      console.log('[CapacitorInit] Native integration initialized successfully');
    }).catch((error) => {
      console.error('[CapacitorInit] Failed to initialize native integration:', error);
    });
  }, []);

  return <>{children}</>;
};

export default CapacitorInit;

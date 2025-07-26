
import { useState, useEffect } from 'react';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

interface PlatformInfo {
  platform: 'android' | 'ios' | 'web';
  isNative: boolean;
  isCapacitor: boolean;
  isReady: boolean;
}

export const usePlatformDetection = (): PlatformInfo => {
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo>({
    platform: 'web',
    isNative: false,
    isCapacitor: false,
    isReady: false
  });

  useEffect(() => {
    const initializePlatformDetection = async () => {
      await nativeIntegrationService.initialize();
      
      const userAgent = navigator.userAgent.toLowerCase();
      const isAndroid = userAgent.includes('android');
      const isIOS = /iphone|ipad|ipod/.test(userAgent);
      const isNative = nativeIntegrationService.isRunningNatively();
      const isCapacitor = (window as any).Capacitor?.isNative || false;

      const platform = isAndroid ? 'android' : isIOS ? 'ios' : 'web';
      
      // Set platform classes immediately
      document.body.classList.toggle('platform-android', isAndroid);
      document.body.classList.toggle('platform-ios', isIOS);
      document.body.classList.toggle('platform-native', isNative);
      document.body.classList.toggle('platform-capacitor', isCapacitor);
      
      setPlatformInfo({
        platform,
        isNative,
        isCapacitor,
        isReady: true
      });
      
      console.log('[PlatformDetection] Platform detected:', { 
        platform, 
        isNative, 
        isCapacitor,
        capacitorAvailable: !!(window as any).Capacitor
      });
    };

    initializePlatformDetection();
  }, []);

  return platformInfo;
};

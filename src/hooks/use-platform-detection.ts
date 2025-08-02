
import { useState, useEffect } from 'react';

interface PlatformInfo {
  platform: 'android' | 'ios' | 'web';
  isNative: boolean;
  isReady: boolean;
}

export const usePlatformDetection = (): PlatformInfo => {
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo>({
    platform: 'web',
    isNative: false,
    isReady: false
  });

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isAndroid = userAgent.includes('android');
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const nativeApp = window.location.href.includes('capacitor://') || 
                     window.location.href.includes('ionic://') ||
                     (window as any).Capacitor?.isNative;

    const platform = isAndroid ? 'android' : isIOS ? 'ios' : 'web';
    
    // Set platform classes immediately
    document.body.classList.toggle('platform-android', isAndroid);
    document.body.classList.toggle('platform-ios', isIOS);
    document.body.classList.toggle('platform-native', nativeApp);
    
    setPlatformInfo({
      platform,
      isNative: nativeApp,
      isReady: true
    });
    
    console.log('[PlatformDetection] Platform detected:', { platform, isNative: nativeApp });
  }, []);

  return platformInfo;
};

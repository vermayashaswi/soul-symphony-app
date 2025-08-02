
import { useState, useEffect } from 'react';

interface PlatformInfo {
  platform: 'android' | 'ios' | 'web';
  isNative: boolean;
  isReady: boolean;
  isPhone: boolean;
  isTablet: boolean;
  isChromebook: boolean;
}

export const usePlatformDetection = (): PlatformInfo => {
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo>({
    platform: 'web',
    isNative: false,
    isReady: false,
    isPhone: false,
    isTablet: false,
    isChromebook: false
  });

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = navigator.platform?.toLowerCase() || '';
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const minDimension = Math.min(screenWidth, screenHeight);
    
    const isAndroid = userAgent.includes('android');
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const nativeApp = window.location.href.includes('capacitor://') || 
                     window.location.href.includes('ionic://') ||
                     (window as any).Capacitor?.isNative;

    const platformType = isAndroid ? 'android' : isIOS ? 'ios' : 'web';
    
    // Enhanced device detection
    const isChromebook = userAgent.includes('cros') || 
                        platform.includes('cros') ||
                        userAgent.includes('chromebook');
    
    // Tablet detection
    const isTabletUA = /ipad|android(?!.*mobile)|tablet|kindle|silk|playbook|bb10/i.test(userAgent);
    const isIpad = /ipad/i.test(userAgent) || 
                   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroidTablet = /android/i.test(userAgent) && !/mobile/i.test(userAgent);
    const isLargeScreen = minDimension >= 768;
    const isTablet = isTabletUA || isIpad || isAndroidTablet || 
                     (isLargeScreen && !isChromebook && Math.max(screenWidth, screenHeight) / minDimension < 2.1);
    
    // Phone detection - must be mobile and NOT tablet
    const isMobile = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isPhone = isMobile && !isTablet && !isChromebook && minDimension < 768;
    
    // Set platform classes immediately
    document.body.classList.toggle('platform-android', isAndroid);
    document.body.classList.toggle('platform-ios', isIOS);
    document.body.classList.toggle('platform-native', nativeApp);
    document.body.classList.toggle('platform-phone', isPhone);
    document.body.classList.toggle('platform-tablet', isTablet);
    document.body.classList.toggle('platform-chromebook', isChromebook);
    
    setPlatformInfo({
      platform: platformType,
      isNative: nativeApp,
      isReady: true,
      isPhone,
      isTablet,
      isChromebook
    });
    
    console.log('[PlatformDetection] Enhanced platform detected:', { 
      platform: platformType, 
      isNative: nativeApp, 
      isPhone, 
      isTablet, 
      isChromebook,
      screenSize: `${screenWidth}x${screenHeight}`
    });
  }, []);

  return platformInfo;
};

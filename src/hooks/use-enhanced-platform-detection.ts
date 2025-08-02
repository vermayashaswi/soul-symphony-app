import { useState, useEffect } from 'react';

interface EnhancedPlatformInfo {
  platform: 'android' | 'ios' | 'web';
  isNative: boolean;
  isReady: boolean;
  webViewVersion?: string;
  keyboardType?: 'swype' | 'gboard' | 'samsung' | 'swift' | 'default';
  androidVersion?: string;
  iosVersion?: string;
  hasCompositionSupport: boolean;
  supportsVisualViewport: boolean;
}

export const useEnhancedPlatformDetection = (): EnhancedPlatformInfo => {
  const [platformInfo, setPlatformInfo] = useState<EnhancedPlatformInfo>({
    platform: 'web',
    isNative: false,
    isReady: false,
    hasCompositionSupport: false,
    supportsVisualViewport: false
  });

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isAndroid = userAgent.includes('android');
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const nativeApp = window.location.href.includes('capacitor://') || 
                     window.location.href.includes('ionic://') ||
                     (window as any).Capacitor?.isNative;

    const platform = isAndroid ? 'android' : isIOS ? 'ios' : 'web';
    
    // Enhanced Android detection
    let keyboardType: 'swype' | 'gboard' | 'samsung' | 'swift' | 'default' = 'default';
    let androidVersion: string | undefined;
    let webViewVersion: string | undefined;
    
    if (isAndroid) {
      // Detect Android version
      const androidMatch = userAgent.match(/android\s([0-9\.]*)/);
      androidVersion = androidMatch ? androidMatch[1] : undefined;
      
      // Detect WebView version
      const webViewMatch = userAgent.match(/chrome\/([0-9\.]*)/);
      webViewVersion = webViewMatch ? webViewMatch[1] : undefined;
      
      // Detect keyboard type (best effort based on common patterns)
      if (userAgent.includes('gboard') || userAgent.includes('google')) {
        keyboardType = 'gboard';
      } else if (userAgent.includes('samsung') || userAgent.includes('sec-')) {
        keyboardType = 'samsung';
      } else if (userAgent.includes('swype')) {
        keyboardType = 'swype';
      } else if (userAgent.includes('swift')) {
        keyboardType = 'swift';
      }
    }
    
    // iOS version detection
    let iosVersion: string | undefined;
    if (isIOS) {
      const iosMatch = userAgent.match(/os\s([0-9_]*)/);
      iosVersion = iosMatch ? iosMatch[1].replace(/_/g, '.') : undefined;
    }
    
    // Feature detection
    const hasCompositionSupport = 'compositionstart' in window && 
                                  'compositionupdate' in window && 
                                  'compositionend' in window;
    const supportsVisualViewport = 'visualViewport' in window;
    
    // Set platform classes
    document.body.classList.toggle('platform-android', isAndroid);
    document.body.classList.toggle('platform-ios', isIOS);
    document.body.classList.toggle('platform-native', nativeApp);
    document.body.classList.toggle('has-composition-support', hasCompositionSupport);
    document.body.classList.toggle('supports-visual-viewport', supportsVisualViewport);
    
    if (isAndroid) {
      document.body.classList.add(`keyboard-${keyboardType}`);
      if (androidVersion) {
        document.body.classList.add(`android-${androidVersion.split('.')[0]}`);
      }
    }
    
    setPlatformInfo({
      platform,
      isNative: nativeApp,
      isReady: true,
      webViewVersion,
      keyboardType,
      androidVersion,
      iosVersion,
      hasCompositionSupport,
      supportsVisualViewport
    });
    
    console.log('[EnhancedPlatformDetection] Platform detected:', {
      platform,
      isNative: nativeApp,
      keyboardType,
      androidVersion,
      iosVersion,
      webViewVersion,
      hasCompositionSupport,
      supportsVisualViewport
    });
  }, []);

  return platformInfo;
};
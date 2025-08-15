import { useState, useEffect, useMemo } from 'react';

export interface EnvironmentInfo {
  isMobileBrowser: boolean;
  isCapacitorWebView: boolean;
  isDesktop: boolean;
  platform: 'ios' | 'android' | 'web';
  isNative: boolean;
  userAgent: string;
}

/**
 * Reliable environment detection for mobile browser vs Capacitor WebView
 */
export const useEnvironmentDetection = (): EnvironmentInfo => {
  const [environmentInfo, setEnvironmentInfo] = useState<EnvironmentInfo>({
    isMobileBrowser: false,
    isCapacitorWebView: false,
    isDesktop: true,
    platform: 'web',
    isNative: false,
    userAgent: ''
  });

  const detectedInfo = useMemo(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return {
        isMobileBrowser: false,
        isCapacitorWebView: false,
        isDesktop: true,
        platform: 'web' as const,
        isNative: false,
        userAgent: ''
      };
    }

    const userAgent = navigator.userAgent.toLowerCase();
    
    // Detect Capacitor native environment
    const isCapacitorWebView = !!(
      (window as any).Capacitor?.isNative ||
      window.location.href.includes('capacitor://') ||
      window.location.href.includes('ionic://')
    );

    // Detect mobile platform
    const isIOS = /iphone|ipad|ipod/.test(userAgent) || 
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /android/.test(userAgent);
    
    // Determine platform
    const platform: 'ios' | 'android' | 'web' = isAndroid ? 'android' : isIOS ? 'ios' : 'web';
    
    // Detect mobile browser (mobile but not Capacitor) - enhanced detection
    const isMobileBrowser = (isIOS || isAndroid) && 
                            !isCapacitorWebView && 
                            typeof window.visualViewport !== 'undefined';
    
    // Desktop detection
    const isDesktop = !isIOS && !isAndroid;

    return {
      isMobileBrowser,
      isCapacitorWebView,
      isDesktop,
      platform,
      isNative: isCapacitorWebView,
      userAgent
    };
  }, []);

  useEffect(() => {
    setEnvironmentInfo(detectedInfo);
    
    console.log('[EnvironmentDetection] Environment detected:', {
      ...detectedInfo,
      windowCapacitor: !!(window as any).Capacitor,
      windowCapacitorIsNative: !!(window as any).Capacitor?.isNative,
      href: window.location.href
    });
  }, [detectedInfo]);

  return environmentInfo;
};
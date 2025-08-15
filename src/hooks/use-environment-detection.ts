
import { useState, useEffect, useMemo } from 'react';

export interface EnvironmentInfo {
  isMobileBrowser: boolean;
  isCapacitorWebView: boolean;
  isDesktop: boolean;
  platform: 'ios' | 'android' | 'web';
  isNative: boolean;
  userAgent: string;
  hasVisualViewport: boolean;
}

/**
 * Enhanced environment detection for mobile browser vs Capacitor WebView
 */
export const useEnvironmentDetection = (): EnvironmentInfo => {
  const [environmentInfo, setEnvironmentInfo] = useState<EnvironmentInfo>({
    isMobileBrowser: false,
    isCapacitorWebView: false,
    isDesktop: true,
    platform: 'web',
    isNative: false,
    userAgent: '',
    hasVisualViewport: false
  });

  const detectedInfo = useMemo(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return {
        isMobileBrowser: false,
        isCapacitorWebView: false,
        isDesktop: true,
        platform: 'web' as const,
        isNative: false,
        userAgent: '',
        hasVisualViewport: false
      };
    }

    const userAgent = navigator.userAgent.toLowerCase();
    
    // Enhanced Capacitor detection
    const isCapacitorWebView = !!(
      (window as any).Capacitor?.isNative ||
      window.location.href.includes('capacitor://') ||
      window.location.href.includes('ionic://') ||
      (window as any).Capacitor?.isPluginAvailable
    );

    // Enhanced mobile platform detection
    const isIOS = /iphone|ipad|ipod/.test(userAgent) || 
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /android/.test(userAgent);
    
    // Determine platform
    const platform: 'ios' | 'android' | 'web' = isAndroid ? 'android' : isIOS ? 'ios' : 'web';
    
    // Check for Visual Viewport API support
    const hasVisualViewport = typeof window.visualViewport !== 'undefined';
    
    // Enhanced mobile browser detection - must be mobile AND not Capacitor AND have Visual Viewport
    const isMobileBrowser = (isIOS || isAndroid) && 
                            !isCapacitorWebView && 
                            hasVisualViewport &&
                            'ontouchstart' in window;
    
    // Desktop detection
    const isDesktop = !isIOS && !isAndroid;

    return {
      isMobileBrowser,
      isCapacitorWebView,
      isDesktop,
      platform,
      isNative: isCapacitorWebView,
      userAgent,
      hasVisualViewport
    };
  }, []);

  useEffect(() => {
    setEnvironmentInfo(detectedInfo);
    
    console.log('[EnvironmentDetection] Enhanced environment detected:', {
      ...detectedInfo,
      windowCapacitor: !!(window as any).Capacitor,
      windowCapacitorIsNative: !!(window as any).Capacitor?.isNative,
      visualViewport: !!window.visualViewport,
      href: window.location.href,
      touchSupport: 'ontouchstart' in window
    });
  }, [detectedInfo]);

  return environmentInfo;
};

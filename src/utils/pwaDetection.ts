
/**
 * Utility functions to detect PWABuilder and native app contexts
 */

export const isPWABuilder = (): boolean => {
  // Check for PWABuilder specific user agent patterns
  const userAgent = navigator.userAgent;
  
  // PWABuilder apps typically have specific patterns in user agent
  const pwaBuilderPatterns = [
    /PWABuilder/i,
    /webtonative/i,
    /Microsoft Edge WebView/i,
    // Add more patterns as needed for PWABuilder detection
  ];
  
  return pwaBuilderPatterns.some(pattern => pattern.test(userAgent));
};

export const isNativeApp = (): boolean => {
  // Check for native app indicators
  return isPWABuilder() || 
         /native/i.test(navigator.userAgent) ||
         window.matchMedia('(display-mode: standalone)').matches ||
         (window as any).navigator?.standalone === true;
};

export const isMobileNativeApp = (): boolean => {
  return isNativeApp() && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
};

console.log('[PWA Detection] PWABuilder detected:', isPWABuilder());
console.log('[PWA Detection] Native app detected:', isNativeApp());
console.log('[PWA Detection] Mobile native app detected:', isMobileNativeApp());

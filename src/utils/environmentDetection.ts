// Unified environment detection utilities for Capacitor-Web parity

export const isCapacitorEnvironment = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).Capacitor;
};

export const isMobileWebEnvironment = (): boolean => {
  return typeof window !== 'undefined' && 
         /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) &&
         !isCapacitorEnvironment();
};

export const shouldUseFallbackUI = (): boolean => {
  // For Capacitor, always use fallback to match mobile web behavior
  return isCapacitorEnvironment();
};

export const shouldPersistStreamingState = (): boolean => {
  // Only persist streaming state for web, not Capacitor
  return !isCapacitorEnvironment();
};

export const getEnvironmentInfo = () => ({
  isCapacitor: isCapacitorEnvironment(),
  isMobileWeb: isMobileWebEnvironment(),
  shouldUseFallback: shouldUseFallbackUI(),
  shouldPersistState: shouldPersistStreamingState(),
  userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'unknown'
});

// Force unified behavior across platforms
export const enforceWebParity = (config: any) => {
  if (isCapacitorEnvironment()) {
    return {
      ...config,
      useThreeDotFallback: true,
      disableBackgroundPersistence: true,
      simplifyAnimations: true,
      forceSimpleLoading: true
    };
  }
  return config;
};
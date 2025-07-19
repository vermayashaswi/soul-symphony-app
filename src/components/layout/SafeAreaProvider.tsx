import React, { createContext, useContext, useEffect, useState } from 'react';

interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface SafeAreaContextType {
  insets: SafeAreaInsets;
  isNative: boolean;
  isReady: boolean;
}

const SafeAreaContext = createContext<SafeAreaContextType>({
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  isNative: false,
  isReady: false
});

export const useSafeArea = () => useContext(SafeAreaContext);

interface SafeAreaProviderProps {
  children: React.ReactNode;
}

export const SafeAreaProvider: React.FC<SafeAreaProviderProps> = ({ children }) => {
  const [insets, setInsets] = useState<SafeAreaInsets>({ top: 0, bottom: 0, left: 0, right: 0 });
  const [isNative, setIsNative] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const detectEnvironmentAndInsets = async () => {
      let nativeContext = false;
      let detectedInsets: SafeAreaInsets = { top: 0, bottom: 0, left: 0, right: 0 };

      try {
        // Check if we're in a Capacitor native context
        const { Capacitor } = await import('@capacitor/core');
        nativeContext = Capacitor.isNativePlatform();
        
        if (nativeContext) {
          console.log('[SafeAreaProvider] Native context detected, checking for status bar plugin');
          
          try {
            const { StatusBar } = await import('@capacitor/status-bar');
            const info = await StatusBar.getInfo();
            
            // Calculate safe area insets based on status bar info
            if (info.visible) {
              detectedInsets.top = info.height || 24; // Default to 24px if height not available
              console.log(`[SafeAreaProvider] Status bar height: ${detectedInsets.top}px`);
            }
          } catch (statusBarError) {
            console.log('[SafeAreaProvider] Status bar plugin not available, using fallback');
            // Fallback for native apps without status bar plugin
            detectedInsets.top = 24; // Standard status bar height
          }

          // Check for safe area support
          if (CSS.supports('padding', 'env(safe-area-inset-top)')) {
            console.log('[SafeAreaProvider] CSS safe-area-inset supported');
            // Let CSS handle the safe area, but keep native detection
          } else {
            console.log('[SafeAreaProvider] CSS safe-area-inset not supported, using calculated values');
          }
        } else {
          console.log('[SafeAreaProvider] Web context detected');
        }
      } catch (error) {
        console.log('[SafeAreaProvider] Capacitor not available, assuming web context');
        nativeContext = false;
      }

      setIsNative(nativeContext);
      setInsets(detectedInsets);
      setIsReady(true);
      
      console.log(`[SafeAreaProvider] Environment setup complete: native=${nativeContext}, insets=`, detectedInsets);
    };

    detectEnvironmentAndInsets();
  }, []);

  return (
    <SafeAreaContext.Provider value={{ insets, isNative, isReady }}>
      {children}
    </SafeAreaContext.Provider>
  );
};

// Simplified native initialization aligned with web patterns
import { useEffect, useState } from 'react';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

interface SimpleNativeInitState {
  isInitialized: boolean;
  isNativeApp: boolean;
  error: string | null;
}

export const useSimpleNativeInit = () => {
  const [state, setState] = useState<SimpleNativeInitState>({
    isInitialized: false,
    isNativeApp: false,
    error: null
  });

  useEffect(() => {
    const initializeNative = async () => {
      try {
        console.log('[SimpleNativeInit] Starting initialization...');
        console.log('[SimpleNativeInit] Environment check:', {
          userAgent: navigator.userAgent,
          capacitor: typeof window !== 'undefined' && !!(window as any).Capacitor,
          androidWebView: navigator.userAgent.includes('wv'),
          standalone: (navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches
        });
        
        // Enhanced native detection with multiple fallbacks
        let isNative = nativeIntegrationService.isRunningNatively();
        
        // Fallback detection methods
        if (!isNative) {
          // Check for webtonative specific indicators
          const isWebToNative = navigator.userAgent.includes('wv') || 
                               navigator.userAgent.includes('WebView') ||
                               (window as any).ReactNativeWebView !== undefined;
          
          // Check for Capacitor in global scope
          const hasCapacitor = typeof window !== 'undefined' && !!(window as any).Capacitor;
          
          console.log('[SimpleNativeInit] Fallback detection:', { isWebToNative, hasCapacitor });
          
          if (isWebToNative || hasCapacitor) {
            isNative = true;
            console.log('[SimpleNativeInit] Native environment detected via fallback');
          }
        }
        
        if (isNative) {
          console.log('[SimpleNativeInit] Native environment confirmed, initializing...');
          try {
            await nativeIntegrationService.initialize();
            console.log('[SimpleNativeInit] Native integration initialized successfully');
          } catch (initError) {
            console.warn('[SimpleNativeInit] Native initialization failed, but continuing:', initError);
            // Don't fail completely if native init fails
          }
        }
        
        setState({
          isInitialized: true,
          isNativeApp: isNative,
          error: null
        });
        
        console.log('[SimpleNativeInit] Initialization complete:', { 
          isNative, 
          userAgent: navigator.userAgent.substring(0, 100)
        });
      } catch (error) {
        console.error('[SimpleNativeInit] Initialization failed:', error);
        setState({
          isInitialized: true, // Still mark as initialized to not block the app
          isNativeApp: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };

    initializeNative();
  }, []);

  return state;
};
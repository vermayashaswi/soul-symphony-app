import { useState, useEffect, useCallback, useMemo } from 'react';
import { useReliableKeyboard } from './use-reliable-keyboard';

interface EnhancedKeyboardState {
  isVisible: boolean;
  height: number;
  accuracy: 'high' | 'medium' | 'low' | 'estimated';
  detectionMethod: string;
  viewport: {
    width: number;
    height: number;
    scale: number;
  };
}

/**
 * Enhanced mobile keyboard hook that provides additional debugging
 * and accuracy information on top of the reliable keyboard hook
 */
export const useEnhancedMobileKeyboard = () => {
  const { isKeyboardVisible, keyboardHeight, platform, isNative } = useReliableKeyboard();
  const [enhancedState, setEnhancedState] = useState<EnhancedKeyboardState>({
    isVisible: false,
    height: 0,
    accuracy: 'estimated',
    detectionMethod: 'none',
    viewport: { width: 0, height: 0, scale: 1 }
  });
  const [debugInfo, setDebugInfo] = useState<any[]>([]);

  // Enhanced mobile browser detection
  const mobileInfo = useMemo(() => {
    if (typeof navigator === 'undefined') return { isMobile: false, browser: 'unknown' };
    
    const ua = navigator.userAgent.toLowerCase();
    const isMobile = /android|iphone|ipad|ipod|mobile|webos|blackberry|iemobile|opera mini/i.test(ua);
    
    let browser = 'unknown';
    if (ua.includes('chrome') && !ua.includes('edg')) browser = 'chrome';
    else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'safari';
    else if (ua.includes('firefox')) browser = 'firefox';
    else if (ua.includes('edg')) browser = 'edge';
    else if (ua.includes('samsung')) browser = 'samsung';
    
    return { isMobile, browser, userAgent: ua };
  }, []);

  // Log keyboard state changes with enhanced debugging
  useEffect(() => {
    const newViewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      scale: window.visualViewport?.scale || 1
    };

    let accuracy: 'high' | 'medium' | 'low' | 'estimated' = 'estimated';
    let detectionMethod = 'none';

    if (isNative) {
      accuracy = 'high';
      detectionMethod = 'capacitor-native';
    } else if (window.visualViewport) {
      accuracy = 'high';
      detectionMethod = 'visual-viewport-api';
    } else if (mobileInfo.isMobile) {
      accuracy = 'medium';
      detectionMethod = 'mobile-fallback';
    } else {
      accuracy = 'low';
      detectionMethod = 'resize-detection';
    }

    const newState: EnhancedKeyboardState = {
      isVisible: isKeyboardVisible,
      height: keyboardHeight,
      accuracy,
      detectionMethod,
      viewport: newViewport
    };

    setEnhancedState(newState);

    // Add debug info
    const debugEntry = {
      timestamp: new Date().toISOString(),
      state: newState,
      platform,
      mobileInfo,
      isNative,
      visualViewportSupported: !!window.visualViewport,
      documentHeight: document.documentElement.scrollHeight,
      bodyHeight: document.body.scrollHeight
    };

    setDebugInfo(prev => [...prev.slice(-9), debugEntry]); // Keep last 10 entries

    console.log('[EnhancedMobileKeyboard] State update:', debugEntry);
  }, [isKeyboardVisible, keyboardHeight, platform, isNative, mobileInfo]);

  // Function to export debug info for troubleshooting
  const exportDebugInfo = useCallback(() => {
    const debugData = {
      currentState: enhancedState,
      platform,
      mobileInfo,
      isNative,
      history: debugInfo,
      timestamp: new Date().toISOString(),
      windowInfo: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        devicePixelRatio: window.devicePixelRatio
      },
      visualViewport: window.visualViewport ? {
        width: window.visualViewport.width,
        height: window.visualViewport.height,
        offsetTop: window.visualViewport.offsetTop,
        offsetLeft: window.visualViewport.offsetLeft,
        scale: window.visualViewport.scale
      } : null
    };

    console.log('[EnhancedMobileKeyboard] Debug Export:', debugData);
    return debugData;
  }, [enhancedState, platform, mobileInfo, isNative, debugInfo]);

  // Function to force recalibration
  const forceRecalibration = useCallback(() => {
    console.log('[EnhancedMobileKeyboard] Forcing recalibration...');
    
    // Trigger a viewport measurement update
    if (window.visualViewport) {
      window.visualViewport.dispatchEvent(new Event('resize'));
    } else {
      window.dispatchEvent(new Event('resize'));
    }
    
    // Clear debug history
    setDebugInfo([]);
  }, []);

  return {
    // Basic keyboard state
    isKeyboardVisible: enhancedState.isVisible,
    keyboardHeight: enhancedState.height,
    platform,
    isNative,
    
    // Enhanced information
    accuracy: enhancedState.accuracy,
    detectionMethod: enhancedState.detectionMethod,
    viewport: enhancedState.viewport,
    mobileInfo,
    
    // Debug utilities
    debugInfo,
    exportDebugInfo,
    forceRecalibration,
    
    // Quality indicators
    isHighAccuracy: enhancedState.accuracy === 'high',
    isReliable: enhancedState.accuracy === 'high' || enhancedState.accuracy === 'medium',
    
    // State summary for easy debugging
    summary: {
      visible: enhancedState.isVisible,
      height: enhancedState.height,
      method: enhancedState.detectionMethod,
      accurate: enhancedState.accuracy === 'high'
    }
  };
};
import { useEffect, useRef, useCallback } from 'react';
import { useMobileKeyboardErrorRecovery } from './use-mobile-keyboard-error-recovery';
import { useCrossPlatformCompositionManager } from './use-cross-platform-composition-manager';
import { useEnhancedDebuggingAnalytics } from './use-enhanced-debugging-analytics';

interface EnhancedMobileInputOptions {
  preventZoom?: boolean;
  optimizeScroll?: boolean;
  enablePredictiveText?: boolean;
  enableSwipeProtection?: boolean;
  debugMode?: boolean;
}

export const useEnhancedMobileInput = (
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>,
  options: EnhancedMobileInputOptions = {}
) => {
  const { handleError } = useMobileKeyboardErrorRecovery({ 
    enableDebugMode: options.debugMode 
  });
  
  // Use the new cross-platform composition manager
  const compositionManager = useCrossPlatformCompositionManager(inputRef, {
    enableConflictResolution: true,
    prioritizeComposition: true,
    enableSmartFallback: true,
    debugMode: options.debugMode
  });
  
  // Enhanced debugging and analytics
  const analytics = useEnhancedDebuggingAnalytics(inputRef, {
    enablePerformanceMonitoring: true,
    enableInputTracking: true,
    enableGestureTracking: options.enableSwipeProtection,
    enableErrorTracking: true,
    debugMode: options.debugMode
  });
  
  const {
    preventZoom = true,
    optimizeScroll = true,
    enablePredictiveText = true,
    enableSwipeProtection = true,
    debugMode = false
  } = options;

  // Extract platform info from composition manager
  const { platform, isNative, isReady } = compositionManager;

  const isInputActive = useRef(false);
  const lastInputValue = useRef('');
  const inputEventCount = useRef(0);

  // Enhanced focus handling
  const handleFocus = useCallback((e: FocusEvent) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (target !== inputRef.current) return;

    isInputActive.current = true;
    lastInputValue.current = target.value;
    inputEventCount.current = 0;

    if (debugMode) {
      console.log('[EnhancedMobileInput] Focus event:', {
        platform,
        value: target.value,
        type: target.type || target.tagName
      });
    }

    // Apply mobile optimizations
    if (preventZoom) {
      // Ensure font size prevents zoom
      target.style.fontSize = 'max(16px, 1rem)';
      target.style.transform = 'scale(1)';
    }

    if (enablePredictiveText) {
      // Ensure proper input attributes for predictive text
      target.setAttribute('autocomplete', target.getAttribute('autocomplete') || 'on');
      target.setAttribute('autocorrect', 'on');
      target.setAttribute('spellcheck', 'true');
      
      // Platform-specific optimizations
      if (platform === 'ios') {
        target.style.webkitAppearance = 'none';
        target.style.borderRadius = '0';
      }
    }

    if (enableSwipeProtection) {
      // Apply protective styles
      target.style.touchAction = 'manipulation';
      target.style.userSelect = 'text';
      target.style.webkitUserSelect = 'text';
      (target.style as any).webkitTouchCallout = 'default';
      
      // Add protective classes
      target.classList.add('swipe-protected', 'input-active');
    }

    if (optimizeScroll) {
      // Scroll into view with better mobile handling
      setTimeout(() => {
        const rect = target.getBoundingClientRect();
        const viewportHeight = window.visualViewport?.height || window.innerHeight;
        const keyboardHeight = window.innerHeight - viewportHeight;
        
        if (rect.bottom > viewportHeight - 20) {
          target.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest'
          });
        }
      }, 300);
    }

    // Dispatch enhanced focus event
    window.dispatchEvent(new CustomEvent('enhancedInputFocus', {
      detail: {
        element: target,
        platform,
        isNative,
        options
      }
    }));

  }, [inputRef, platform, isNative, preventZoom, enablePredictiveText, enableSwipeProtection, optimizeScroll, debugMode, options]);

  // Enhanced blur handling
  const handleBlur = useCallback((e: FocusEvent) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (target !== inputRef.current) return;

    isInputActive.current = false;

    if (enableSwipeProtection) {
      target.classList.remove('swipe-protected', 'input-active');
    }

    // Check for potential issues
    if (inputEventCount.current === 0 && target.value !== lastInputValue.current) {
      handleError({
        type: 'input_freeze',
        element: target,
        timestamp: Date.now(),
        context: 'Value changed but no input events detected'
      });
    }

    if (debugMode) {
      console.log('[EnhancedMobileInput] Blur event:', {
        platform,
        finalValue: target.value,
        inputEvents: inputEventCount.current,
        valueChanged: target.value !== lastInputValue.current
      });
    }

    // Dispatch enhanced blur event
    window.dispatchEvent(new CustomEvent('enhancedInputBlur', {
      detail: {
        element: target,
        platform,
        isNative,
        inputEventCount: inputEventCount.current,
        valueChanged: target.value !== lastInputValue.current
      }
    }));

  }, [inputRef, enableSwipeProtection, handleError, debugMode, platform, isNative]);

  // Enhanced input handling
  const handleInput = useCallback((e: Event) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (target !== inputRef.current) return;

    inputEventCount.current++;

    if (debugMode && inputEventCount.current === 1) {
      console.log('[EnhancedMobileInput] First input event detected');
    }

    // Ensure predictive text continues working
    if (enablePredictiveText && platform === 'ios') {
      // iOS-specific fix for predictive text
      setTimeout(() => {
        if (target.value.endsWith(' ')) {
          target.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 10);
    }

  }, [inputRef, enablePredictiveText, platform, debugMode]);

  // Touch event protection
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enableSwipeProtection || !isInputActive.current) return;
    
    const target = e.target as HTMLElement;
    if (target === inputRef.current) {
      e.stopPropagation();
      if (debugMode) {
        console.log('[EnhancedMobileInput] Touch start protected');
      }
    }
  }, [inputRef, enableSwipeProtection, debugMode]);

  // Set up event listeners
  useEffect(() => {
    if (!isReady || !inputRef.current) return;

    const element = inputRef.current;

    // Core input events
    element.addEventListener('focus', handleFocus);
    element.addEventListener('blur', handleBlur);
    element.addEventListener('input', handleInput);

    if (enableSwipeProtection) {
      element.addEventListener('touchstart', handleTouchStart);
    }

    // Monitor for issues
    let valueMonitorInterval: NodeJS.Timeout;
    if (debugMode) {
      valueMonitorInterval = setInterval(() => {
        if (isInputActive.current && element.value !== lastInputValue.current) {
          if (inputEventCount.current === 0) {
            console.warn('[EnhancedMobileInput] Value changed without input events');
          }
          lastInputValue.current = element.value;
        }
      }, 1000);
    }

    return () => {
      element.removeEventListener('focus', handleFocus);
      element.removeEventListener('blur', handleBlur);
      element.removeEventListener('input', handleInput);
      
      if (enableSwipeProtection) {
        element.removeEventListener('touchstart', handleTouchStart);
      }
      
      if (valueMonitorInterval) {
        clearInterval(valueMonitorInterval);
      }
    };
  }, [
    isReady, 
    inputRef, 
    handleFocus, 
    handleBlur, 
    handleInput, 
    handleTouchStart, 
    enableSwipeProtection,
    debugMode
  ]);

  return {
    isInputActive: isInputActive.current,
    platform: compositionManager.platform,
    isNative: compositionManager.isNative,
    isReady: compositionManager.isReady,
    // Composition data
    isComposing: compositionManager.isComposing,
    compositionText: compositionManager.compositionText,
    keyboardType: compositionManager.keyboardType,
    hasCompositionSupport: compositionManager.hasCompositionSupport,
    // Conflict management
    hasActiveConflict: compositionManager.hasActiveConflict,
    conflictType: compositionManager.conflictType,
    resolutionStrategy: compositionManager.resolutionStrategy,
    // Analytics
    generateAnalyticsReport: analytics.generateReport
  };
};
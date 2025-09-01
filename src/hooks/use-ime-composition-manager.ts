import { useRef, useCallback, useEffect } from 'react';
import { useEnhancedPlatformDetection } from './use-enhanced-platform-detection';

interface IMECompositionOptions {
  enableVisualFeedback?: boolean;
  enableKeyboardTypeDetection?: boolean;
  debugMode?: boolean;
  contentEditableFallback?: boolean;
}

interface IMEState {
  isComposing: boolean;
  compositionText: string;
  keyboardType: string | null;
  supportsFallback: boolean;
  hasNativeSupport: boolean;
}

export const useIMECompositionManager = (
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>,
  options: IMECompositionOptions = {}
) => {
  const { platform, keyboardType, hasCompositionSupport } = useEnhancedPlatformDetection();
  const { 
    enableVisualFeedback = true, 
    enableKeyboardTypeDetection = true,
    debugMode = false,
    contentEditableFallback = false
  } = options;
  
  const imeState = useRef<IMEState>({
    isComposing: false,
    compositionText: '',
    keyboardType: null,
    supportsFallback: false,
    hasNativeSupport: hasCompositionSupport
  });
  
  const visualFeedbackRef = useRef<HTMLDivElement | null>(null);
  const contentEditableRef = useRef<HTMLDivElement | null>(null);
  
  // Detect specific keyboard types for Android
  const detectKeyboardType = useCallback(() => {
    if (platform !== 'android') return 'unknown';
    
    const userAgent = navigator.userAgent.toLowerCase();
    const vendor = navigator.vendor.toLowerCase();
    
    if (keyboardType) return keyboardType;
    
    // Heuristic detection based on user agent
    if (userAgent.includes('gboard') || userAgent.includes('google')) {
      return 'gboard';
    } else if (userAgent.includes('samsung')) {
      return 'samsung';
    } else if (userAgent.includes('swiftkey')) {
      return 'swiftkey';
    }
    
    return 'unknown';
  }, [platform, keyboardType]);
  
  // Create visual feedback element
  const createVisualFeedback = useCallback(() => {
    if (!enableVisualFeedback || visualFeedbackRef.current) return;
    
    const feedback = document.createElement('div');
    feedback.className = 'ime-composition-feedback';
    feedback.style.cssText = `
      position: absolute;
      top: -30px;
      left: 0;
      right: 0;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 14px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
      z-index: 1000;
    `;
    
    if (inputRef.current?.parentElement) {
      inputRef.current.parentElement.style.position = 'relative';
      inputRef.current.parentElement.appendChild(feedback);
      visualFeedbackRef.current = feedback;
    }
  }, [inputRef, enableVisualFeedback]);
  
  // Update visual feedback
  const updateVisualFeedback = useCallback((text: string, show: boolean) => {
    if (!visualFeedbackRef.current) return;
    
    visualFeedbackRef.current.textContent = text;
    visualFeedbackRef.current.style.opacity = show ? '1' : '0';
  }, []);
  
  // Handle composition start
  const handleCompositionStart = useCallback((e: CompositionEvent) => {
    if (!inputRef.current || e.target !== inputRef.current) return;
    
    imeState.current.isComposing = true;
    imeState.current.keyboardType = detectKeyboardType();
    
    if (debugMode) {
      console.log('[IMECompositionManager] Composition started:', {
        platform,
        keyboardType: imeState.current.keyboardType,
        data: e.data
      });
    }
    
    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('imeCompositionStart', {
      detail: { 
        element: inputRef.current, 
        keyboardType: imeState.current.keyboardType,
        platform 
      }
    }));
  }, [inputRef, platform, detectKeyboardType, debugMode]);
  
  // Handle composition update with immediate visual feedback
  const handleCompositionUpdate = useCallback((e: CompositionEvent) => {
    if (!inputRef.current || e.target !== inputRef.current) return;
    
    const composingText = e.data || '';
    imeState.current.compositionText = composingText;
    
    // Show visual feedback for swipe keyboards
    if (enableVisualFeedback && composingText) {
      updateVisualFeedback(`Composing: ${composingText}`, true);
    }
    
    // For Android swipe keyboards, update the input value immediately
    if (platform === 'android' && imeState.current.keyboardType !== 'unknown') {
      const currentValue = inputRef.current.value;
      const baseValue = currentValue.replace(imeState.current.compositionText, '');
      const newValue = baseValue + composingText;
      
      if (inputRef.current.value !== newValue) {
        inputRef.current.value = newValue;
        
        // Set cursor to end
        try {
          const end = newValue.length;
          (inputRef.current as HTMLInputElement).setSelectionRange?.(end, end);
        } catch (error) {
          if (debugMode) console.warn('[IMECompositionManager] Selection range error:', error);
        }
        
        // Trigger synthetic input event for React
        inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    
    if (debugMode) {
      console.log('[IMECompositionManager] Composition update:', {
        data: composingText,
        inputValue: inputRef.current.value,
        keyboardType: imeState.current.keyboardType
      });
    }
  }, [inputRef, platform, enableVisualFeedback, updateVisualFeedback, debugMode]);
  
  // Handle composition end
  const handleCompositionEnd = useCallback((e: CompositionEvent) => {
    if (!inputRef.current || e.target !== inputRef.current) return;
    
    const finalText = e.data || '';
    imeState.current.isComposing = false;
    imeState.current.compositionText = '';
    
    // Hide visual feedback
    if (enableVisualFeedback) {
      updateVisualFeedback('', false);
    }
    
    if (debugMode) {
      console.log('[IMECompositionManager] Composition ended:', {
        finalText,
        inputValue: inputRef.current.value,
        keyboardType: imeState.current.keyboardType
      });
    }
    
    // Ensure final input event is fired
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 50);
    
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('imeCompositionEnd', {
      detail: { 
        element: inputRef.current, 
        finalText, 
        keyboardType: imeState.current.keyboardType,
        platform 
      }
    }));
  }, [inputRef, enableVisualFeedback, updateVisualFeedback, debugMode, platform]);
  
  // Set up event listeners
  useEffect(() => {
    if (!inputRef.current) return;
    
    const element = inputRef.current;
    
    // Create visual feedback element
    createVisualFeedback();
    
    // Set up composition event listeners
    element.addEventListener('compositionstart', handleCompositionStart);
    element.addEventListener('compositionupdate', handleCompositionUpdate);
    element.addEventListener('compositionend', handleCompositionEnd);
    
    return () => {
      element.removeEventListener('compositionstart', handleCompositionStart);
      element.removeEventListener('compositionupdate', handleCompositionUpdate);
      element.removeEventListener('compositionend', handleCompositionEnd);
      
      // Clean up visual feedback
      if (visualFeedbackRef.current) {
        visualFeedbackRef.current.remove();
        visualFeedbackRef.current = null;
      }
    };
  }, [
    inputRef,
    handleCompositionStart,
    handleCompositionUpdate,
    handleCompositionEnd,
    createVisualFeedback
  ]);
  
  return {
    isComposing: imeState.current.isComposing,
    compositionText: imeState.current.compositionText,
    keyboardType: imeState.current.keyboardType,
    platform,
    hasNativeSupport: imeState.current.hasNativeSupport,
    debugInfo: debugMode ? {
      userAgent: navigator.userAgent,
      vendor: navigator.vendor,
      detectedKeyboard: detectKeyboardType()
    } : null
  };
};
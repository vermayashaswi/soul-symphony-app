import { useEffect, useRef, useCallback } from 'react';
import { useEnhancedPlatformDetection } from './use-enhanced-platform-detection';

interface CompositionEventOptions {
  enableDebugMode?: boolean;
  preventConflicts?: boolean;
  androidOptimized?: boolean;
}

interface CompositionState {
  isComposing: boolean;
  compositionText: string;
  lastCompositionEvent: string | null;
}

export const useCompositionEvents = (
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>,
  options: CompositionEventOptions = {}
) => {
  const { platform, hasCompositionSupport, keyboardType } = useEnhancedPlatformDetection();
  const { enableDebugMode = false, preventConflicts = true, androidOptimized = true } = options;
  
  const compositionState = useRef<CompositionState>({
    isComposing: false,
    compositionText: '',
    lastCompositionEvent: null
  });
  
  const inputValueBeforeComposition = useRef<string>('');
  const isAndroidSwipeKeyboard = platform === 'android' && 
    (keyboardType === 'swype' || keyboardType === 'gboard' || keyboardType === 'samsung');

  const handleCompositionStart = useCallback((e: CompositionEvent) => {
    if (!inputRef.current || e.target !== inputRef.current) return;
    
    compositionState.current.isComposing = true;
    compositionState.current.lastCompositionEvent = 'start';
    inputValueBeforeComposition.current = inputRef.current.value;
    
    if (enableDebugMode) {
      console.log('[CompositionEvents] Composition start:', {
        platform,
        keyboardType,
        data: e.data,
        inputValue: inputRef.current.value
      });
    }
    
    // Android-specific optimizations
    if (androidOptimized && isAndroidSwipeKeyboard) {
      // Prevent touch events from interfering
      inputRef.current.style.touchAction = 'none';
      
      // Ensure composition text is visible
      if ((inputRef.current.style as any).imeMode !== 'active') {
        (inputRef.current.style as any).imeMode = 'active';
      }
    }
    
    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('compositionStarted', {
      detail: { element: inputRef.current, platform, keyboardType }
    }));
  }, [inputRef, platform, keyboardType, enableDebugMode, androidOptimized, isAndroidSwipeKeyboard]);

  const handleCompositionUpdate = useCallback((e: CompositionEvent) => {
    if (!inputRef.current || e.target !== inputRef.current) return;
    
    compositionState.current.compositionText = e.data || '';
    compositionState.current.lastCompositionEvent = 'update';
    
    if (enableDebugMode) {
      console.log('[CompositionEvents] Composition update:', {
        data: e.data,
        inputValue: inputRef.current.value
      });
    }
    
    // Android swipe keyboard optimization
    if (androidOptimized && isAndroidSwipeKeyboard) {
      // Some Android keyboards need a slight delay to process composition
      setTimeout(() => {
        if (inputRef.current && compositionState.current.isComposing) {
          // Trigger visual update without interfering with composition
          inputRef.current.dispatchEvent(new Event('input', { bubbles: false }));
        }
      }, 10);
    }
  }, [inputRef, enableDebugMode, androidOptimized, isAndroidSwipeKeyboard]);

  const handleCompositionEnd = useCallback((e: CompositionEvent) => {
    if (!inputRef.current || e.target !== inputRef.current) return;
    
    const finalText = e.data || '';
    compositionState.current.isComposing = false;
    compositionState.current.compositionText = '';
    compositionState.current.lastCompositionEvent = 'end';
    
    if (enableDebugMode) {
      console.log('[CompositionEvents] Composition end:', {
        data: finalText,
        inputValue: inputRef.current.value,
        platform,
        keyboardType
      });
    }
    
    // Android-specific cleanup
    if (androidOptimized && isAndroidSwipeKeyboard) {
      // Restore normal touch behavior
      inputRef.current.style.touchAction = 'manipulation';
      (inputRef.current.style as any).imeMode = 'auto';
      
      // Ensure final input event is fired for Android
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 50);
    }
    
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('compositionEnded', {
      detail: { 
        element: inputRef.current, 
        finalText, 
        platform, 
        keyboardType,
        valueChanged: inputRef.current.value !== inputValueBeforeComposition.current
      }
    }));
  }, [inputRef, platform, keyboardType, enableDebugMode, androidOptimized, isAndroidSwipeKeyboard]);

  // Set up event listeners
  useEffect(() => {
    if (!hasCompositionSupport || !inputRef.current) return;
    
    const element = inputRef.current;
    
    element.addEventListener('compositionstart', handleCompositionStart);
    element.addEventListener('compositionupdate', handleCompositionUpdate);
    element.addEventListener('compositionend', handleCompositionEnd);
    
    // Conflict prevention
    if (preventConflicts) {
      const preventInputDuringComposition = (e: Event) => {
        if (compositionState.current.isComposing && 
            compositionState.current.lastCompositionEvent !== 'end') {
          e.stopImmediatePropagation();
          if (enableDebugMode) {
            console.log('[CompositionEvents] Input event blocked during composition');
          }
        }
      };
      
      element.addEventListener('input', preventInputDuringComposition, { capture: true });
      
      return () => {
        element.removeEventListener('compositionstart', handleCompositionStart);
        element.removeEventListener('compositionupdate', handleCompositionUpdate);
        element.removeEventListener('compositionend', handleCompositionEnd);
        element.removeEventListener('input', preventInputDuringComposition, { capture: true });
      };
    }
    
    return () => {
      element.removeEventListener('compositionstart', handleCompositionStart);
      element.removeEventListener('compositionupdate', handleCompositionUpdate);
      element.removeEventListener('compositionend', handleCompositionEnd);
    };
  }, [
    hasCompositionSupport,
    inputRef,
    handleCompositionStart,
    handleCompositionUpdate,
    handleCompositionEnd,
    preventConflicts,
    enableDebugMode
  ]);

  return {
    isComposing: compositionState.current.isComposing,
    compositionText: compositionState.current.compositionText,
    platform,
    keyboardType,
    hasCompositionSupport
  };
};
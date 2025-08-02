/**
 * Phase 1: Unified Touch Action Management
 * Centralizes touch action control with priority for keyboard input
 */

import { useCallback, useRef, useEffect } from 'react';
import { usePlatformDetection } from './use-platform-detection';

interface TouchActionPriority {
  source: 'keyboard' | 'composition' | 'swipe' | 'navigation' | 'general';
  priority: number; // Higher = more important
  touchAction: string;
  element?: HTMLElement;
}

interface TouchActionManagerOptions {
  debugMode?: boolean;
  respectCapacitorNative?: boolean;
}

export const useUnifiedTouchActionManager = (options: TouchActionManagerOptions = {}) => {
  const { platform, isNative } = usePlatformDetection();
  const { debugMode = false, respectCapacitorNative = true } = options;
  
  const activePriorities = useRef<Map<string, TouchActionPriority>>(new Map());
  const elementStates = useRef<Map<HTMLElement, string>>(new Map());
  
  // Priority levels (higher = more important)
  const PRIORITY_LEVELS = {
    keyboard: 100,
    composition: 90,
    swipe: 30,
    navigation: 20,
    general: 10
  };

  const setTouchAction = useCallback((
    element: HTMLElement,
    source: TouchActionPriority['source'],
    touchAction: string,
    id?: string
  ) => {
    const priorityId = id || `${source}-${Date.now()}`;
    const priority = PRIORITY_LEVELS[source];
    
    const priorityEntry: TouchActionPriority = {
      source,
      priority,
      touchAction,
      element
    };
    
    activePriorities.current.set(priorityId, priorityEntry);
    
    // Apply the highest priority touch action for this element
    const elementPriorities = Array.from(activePriorities.current.values())
      .filter(p => p.element === element)
      .sort((a, b) => b.priority - a.priority);
    
    if (elementPriorities.length > 0) {
      const highestPriority = elementPriorities[0];
      const currentAction = element.style.touchAction;
      
      // Store original state if not already stored
      if (!elementStates.current.has(element)) {
        elementStates.current.set(element, currentAction || 'auto');
      }
      
      // Apply new touch action if different
      if (currentAction !== highestPriority.touchAction) {
        element.style.touchAction = highestPriority.touchAction;
        
        // Add Capacitor-specific optimizations
        if (isNative && respectCapacitorNative) {
          if (highestPriority.source === 'keyboard') {
            (element.style as any).webkitTouchCallout = 'none';
            element.style.webkitUserSelect = 'text';
          }
        }
        
        if (debugMode) {
          console.log('[TouchActionManager] Applied touch action:', {
            element: element.tagName,
            action: highestPriority.touchAction,
            source: highestPriority.source,
            priority: highestPriority.priority,
            platform,
            isNative
          });
        }
      }
    }
    
    return priorityId;
  }, [platform, isNative, debugMode, respectCapacitorNative]);

  const removeTouchAction = useCallback((priorityId: string) => {
    const priority = activePriorities.current.get(priorityId);
    if (!priority) return;
    
    activePriorities.current.delete(priorityId);
    
    // Recalculate touch actions for the element
    const element = priority.element;
    if (!element) return;
    
    const remainingPriorities = Array.from(activePriorities.current.values())
      .filter(p => p.element === element)
      .sort((a, b) => b.priority - a.priority);
    
    if (remainingPriorities.length > 0) {
      // Apply next highest priority
      element.style.touchAction = remainingPriorities[0].touchAction;
    } else {
      // Restore original state
      const originalAction = elementStates.current.get(element);
      element.style.touchAction = originalAction || 'auto';
      elementStates.current.delete(element);
    }
    
    if (debugMode) {
      console.log('[TouchActionManager] Removed touch action:', {
        priorityId,
        element: element.tagName,
        remaining: remainingPriorities.length
      });
    }
  }, [debugMode]);

  const clearElementTouchActions = useCallback((element: HTMLElement) => {
    const elementPriorities = Array.from(activePriorities.current.entries())
      .filter(([_, priority]) => priority.element === element);
    
    elementPriorities.forEach(([id]) => {
      activePriorities.current.delete(id);
    });
    
    // Restore original state
    const originalAction = elementStates.current.get(element);
    element.style.touchAction = originalAction || 'auto';
    elementStates.current.delete(element);
    
    if (debugMode) {
      console.log('[TouchActionManager] Cleared all touch actions for element:', element.tagName);
    }
  }, [debugMode]);

  // Android Capacitor-specific keyboard optimizations
  const optimizeForAndroidKeyboard = useCallback((element: HTMLElement) => {
    if (platform !== 'android' || !isNative) return null;
    
    return setTouchAction(element, 'keyboard', 'manipulation', 'android-keyboard-opt');
  }, [platform, isNative, setTouchAction]);

  // iOS Capacitor-specific optimizations
  const optimizeForIOSKeyboard = useCallback((element: HTMLElement) => {
    if (platform !== 'ios' || !isNative) return null;
    
    return setTouchAction(element, 'keyboard', 'manipulation', 'ios-keyboard-opt');
  }, [platform, isNative, setTouchAction]);

  // Composition event optimizations
  const optimizeForComposition = useCallback((element: HTMLElement) => {
    const touchAction = platform === 'android' ? 'none' : 'manipulation';
    return setTouchAction(element, 'composition', touchAction, 'composition-opt');
  }, [platform, setTouchAction]);

  // Event listeners for automatic management
  useEffect(() => {
    const handleCompositionStart = (e: CustomEvent) => {
      const element = e.detail.element as HTMLElement;
      if (element) {
        optimizeForComposition(element);
      }
    };

    const handleCompositionEnd = (e: CustomEvent) => {
      removeTouchAction('composition-opt');
    };

    const handleKeyboardShow = (e: CustomEvent) => {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        if (platform === 'android') {
          optimizeForAndroidKeyboard(activeElement);
        } else if (platform === 'ios') {
          optimizeForIOSKeyboard(activeElement);
        }
      }
    };

    const handleKeyboardHide = () => {
      removeTouchAction('android-keyboard-opt');
      removeTouchAction('ios-keyboard-opt');
    };

    window.addEventListener('compositionStarted', handleCompositionStart as EventListener);
    window.addEventListener('compositionEnded', handleCompositionEnd as EventListener);
    window.addEventListener('keyboardOpen', handleKeyboardShow as EventListener);
    window.addEventListener('keyboardClose', handleKeyboardHide);

    return () => {
      window.removeEventListener('compositionStarted', handleCompositionStart as EventListener);
      window.removeEventListener('compositionEnded', handleCompositionEnd as EventListener);
      window.removeEventListener('keyboardOpen', handleKeyboardShow as EventListener);
      window.removeEventListener('keyboardClose', handleKeyboardHide);
    };
  }, [platform, optimizeForComposition, optimizeForAndroidKeyboard, optimizeForIOSKeyboard, removeTouchAction]);

  return {
    setTouchAction,
    removeTouchAction,
    clearElementTouchActions,
    optimizeForAndroidKeyboard,
    optimizeForIOSKeyboard,
    optimizeForComposition,
    platform,
    isNative
  };
};
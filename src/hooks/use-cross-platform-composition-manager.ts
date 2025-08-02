import { useCallback, useRef, useEffect } from 'react';
import { useCompositionEvents } from './use-composition-events';
import { useAndroidInputOptimization } from './use-android-input-optimization';
import { useEnhancedPlatformDetection } from './use-enhanced-platform-detection';

interface CompositionManagerOptions {
  enableConflictResolution?: boolean;
  prioritizeComposition?: boolean;
  enableSmartFallback?: boolean;
  debugMode?: boolean;
}

interface ConflictState {
  hasActiveConflict: boolean;
  conflictType: 'swipe' | 'input' | 'keyboard' | null;
  resolutionStrategy: 'block-input' | 'block-swipe' | 'allow-both' | null;
}

export const useCrossPlatformCompositionManager = (
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>,
  options: CompositionManagerOptions = {}
) => {
  const { platform, keyboardType, hasCompositionSupport } = useEnhancedPlatformDetection();
  const {
    enableConflictResolution = true,
    prioritizeComposition = true,
    enableSmartFallback = true,
    debugMode = false
  } = options;

  const conflictState = useRef<ConflictState>({
    hasActiveConflict: false,
    conflictType: null,
    resolutionStrategy: null
  });

  const compositionData = useCompositionEvents(inputRef, {
    enableDebugMode: debugMode,
    preventConflicts: prioritizeComposition,
    androidOptimized: platform === 'android'
  });

  const androidData = useAndroidInputOptimization(inputRef, {
    enableIMEOptimization: true,
    enableKeyboardHeightDetection: true,
    optimizeTouchActions: true,
    debugMode
  });

  // Smart conflict resolution
  const resolveConflict = useCallback((conflictType: 'swipe' | 'input' | 'keyboard') => {
    if (!enableConflictResolution) return;

    conflictState.current.hasActiveConflict = true;
    conflictState.current.conflictType = conflictType;

    // Determine resolution strategy based on platform and context
    let strategy: 'block-input' | 'block-swipe' | 'allow-both';

    if (compositionData.isComposing) {
      // Always prioritize composition when active
      strategy = conflictType === 'swipe' ? 'block-swipe' : 'block-input';
    } else if (platform === 'android' && (keyboardType === 'swype' || keyboardType === 'gboard')) {
      // Android swipe keyboards need special handling
      strategy = 'allow-both';
    } else if (platform === 'ios') {
      // iOS typically handles composition better
      strategy = prioritizeComposition ? 'block-swipe' : 'allow-both';
    } else {
      // Default fallback
      strategy = 'allow-both';
    }

    conflictState.current.resolutionStrategy = strategy;

    if (debugMode) {
      console.log('[CompositionManager] Conflict detected and resolved:', {
        type: conflictType,
        strategy,
        platform,
        keyboardType,
        isComposing: compositionData.isComposing
      });
    }

    // Apply resolution strategy
    switch (strategy) {
      case 'block-input':
        window.dispatchEvent(new CustomEvent('blockInputEvents', {
          detail: { source: 'composition-manager', reason: conflictType }
        }));
        break;
      case 'block-swipe':
        window.dispatchEvent(new CustomEvent('blockSwipeGestures', {
          detail: { source: 'composition-manager', reason: conflictType }
        }));
        break;
      case 'allow-both':
        // Coordinate both systems
        window.dispatchEvent(new CustomEvent('coordinateInputEvents', {
          detail: { source: 'composition-manager', strategy: 'cooperative' }
        }));
        break;
    }

    // Auto-resolve after timeout
    setTimeout(() => {
      conflictState.current.hasActiveConflict = false;
      conflictState.current.conflictType = null;
      conflictState.current.resolutionStrategy = null;

      window.dispatchEvent(new CustomEvent('conflictResolved', {
        detail: { previousStrategy: strategy }
      }));
    }, 3000);

  }, [
    enableConflictResolution,
    compositionData.isComposing,
    platform,
    keyboardType,
    prioritizeComposition,
    debugMode
  ]);

  // Smart fallback system
  const handleFallback = useCallback(() => {
    if (!enableSmartFallback || !inputRef.current) return;

    const element = inputRef.current;

    if (!hasCompositionSupport) {
      // Fallback for browsers without composition support
      if (debugMode) {
        console.log('[CompositionManager] Using fallback mode - no composition support');
      }

      // Use alternative input monitoring
      const handleInputFallback = (e: Event) => {
        // Simulate composition-like behavior
        const target = e.target as HTMLInputElement | HTMLTextAreaElement;
        
        // Detect rapid input changes that might be from swipe/prediction
        const currentTime = Date.now();
        const lastInputTime = parseInt(target.dataset.lastInputTime || '0', 10);
        const timeDiff = currentTime - lastInputTime;
        
        if (timeDiff < 50) {
          // Rapid input - likely from swipe/prediction
          window.dispatchEvent(new CustomEvent('simulatedComposition', {
            detail: { element: target, type: 'rapid-input' }
          }));
        }
        
        target.dataset.lastInputTime = currentTime.toString();
      };

      element.addEventListener('input', handleInputFallback);
      return () => element.removeEventListener('input', handleInputFallback);
    }
  }, [enableSmartFallback, hasCompositionSupport, inputRef, debugMode]);

  // Event listeners for conflict detection
  useEffect(() => {
    if (!enableConflictResolution) return;

    const handleSwipeStart = (e: CustomEvent) => {
      if (compositionData.isComposing) {
        resolveConflict('swipe');
      }
    };

    const handleInputStart = (e: CustomEvent) => {
      if (conflictState.current.hasActiveConflict) {
        resolveConflict('input');
      }
    };

    const handleKeyboardShow = (e: CustomEvent) => {
      if (conflictState.current.hasActiveConflict) {
        resolveConflict('keyboard');
      }
    };

    window.addEventListener('swipeGestureStart', handleSwipeStart as EventListener);
    window.addEventListener('enhancedInputFocus', handleInputStart as EventListener);
    window.addEventListener('androidKeyboardShow', handleKeyboardShow as EventListener);

    const cleanupFallback = handleFallback();

    return () => {
      window.removeEventListener('swipeGestureStart', handleSwipeStart as EventListener);
      window.removeEventListener('enhancedInputFocus', handleInputStart as EventListener);
      window.removeEventListener('androidKeyboardShow', handleKeyboardShow as EventListener);
      
      if (cleanupFallback) {
        cleanupFallback();
      }
    };
  }, [enableConflictResolution, compositionData.isComposing, resolveConflict, handleFallback]);

  // Performance monitoring
  useEffect(() => {
    if (!debugMode) return;

    let performanceCheckInterval: NodeJS.Timeout;

    const checkPerformance = () => {
      const entries = performance.getEntriesByType('measure');
      const inputEntries = entries.filter(entry => entry.name.includes('input'));
      
      if (inputEntries.length > 0) {
        const avgDuration = inputEntries.reduce((sum, entry) => sum + entry.duration, 0) / inputEntries.length;
        
        if (avgDuration > 16) { // More than one frame
          console.warn('[CompositionManager] Performance issue detected:', {
            averageInputDuration: avgDuration,
            platform,
            keyboardType,
            isComposing: compositionData.isComposing
          });
        }
      }
    };

    performanceCheckInterval = setInterval(checkPerformance, 5000);

    return () => {
      if (performanceCheckInterval) {
        clearInterval(performanceCheckInterval);
      }
    };
  }, [debugMode, platform, keyboardType, compositionData.isComposing]);

  return {
    // Composition data
    ...compositionData,
    
    // Android data (if applicable)
    ...androidData,
    
    // Conflict management
    hasActiveConflict: conflictState.current.hasActiveConflict,
    conflictType: conflictState.current.conflictType,
    resolutionStrategy: conflictState.current.resolutionStrategy,
    
    // Methods
    resolveConflict,
    
    // Platform info
    platform,
    keyboardType,
    hasCompositionSupport,
    
    // Add missing properties for compatibility
    isNative: platform !== 'web',
    isReady: true
  };
};
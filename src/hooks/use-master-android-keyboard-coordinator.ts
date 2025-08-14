/**
 * Master Android Keyboard Coordinator
 * Integrates all 5 phases of the Android keyboard optimization plan
 */

import { useCallback } from 'react';
import { useUnifiedTouchActionManager } from './use-unified-touch-action-manager';
import { useEnhancedAndroidComposition } from './use-enhanced-android-composition';
import { useCoordinatedSwipeInputDetection } from './use-coordinated-swipe-input-detection';
import { useCapacitorAndroidWebViewOptimization } from './use-capacitor-android-webview-optimization';
import { useAndroidKeyboardDebugAnalytics } from './use-android-keyboard-debug-analytics';
import { usePlatformDetection } from './use-platform-detection';

interface MasterCoordinatorOptions {
  enableTouchActionManagement?: boolean;
  enableCompositionOptimization?: boolean;
  enableSwipeCoordination?: boolean;
  enableCapacitorOptimization?: boolean;
  enableDebugAnalytics?: boolean;
  debugMode?: boolean;
}

interface SwipeCallbacks {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

export const useMasterAndroidKeyboardCoordinator = (
  elementRef: React.RefObject<HTMLElement>,
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>,
  swipeCallbacks: SwipeCallbacks,
  options: MasterCoordinatorOptions = {}
) => {
  const { platform, isNative } = usePlatformDetection();
  
  const {
    enableTouchActionManagement = true,
    enableCompositionOptimization = true,
    enableSwipeCoordination = true,
    enableCapacitorOptimization = true,
    enableDebugAnalytics = true,
    debugMode = false
  } = options;

  // Phase 1: Unified Touch Action Management
  const touchActionManager = useUnifiedTouchActionManager({
    debugMode,
    respectCapacitorNative: isNative && enableCapacitorOptimization
  });

  // Phase 2: Enhanced Android Composition Handling
  const androidComposition = useEnhancedAndroidComposition(inputRef, {
    enableGboardOptimization: true,
    enableSamsungOptimization: true,
    enableSwypeOptimization: true,
    enableCapacitorIntegration: enableCapacitorOptimization && isNative,
    debugMode
  });

  // Phase 3: Coordinated Swipe and Input Detection
  const coordinatedDetection = useCoordinatedSwipeInputDetection(
    elementRef,
    swipeCallbacks,
    {
      inputRef,
      enableSwipeDetection: enableSwipeCoordination,
      enableInputPriority: true,
      debugMode
    }
  );

  // Phase 4: Capacitor Android WebView Optimization
  const capacitorOptimization = useCapacitorAndroidWebViewOptimization(inputRef, {
    enableKeyboardPlugin: enableCapacitorOptimization && isNative,
    enableStatusBarAdjustment: enableCapacitorOptimization && isNative,
    enableWebViewWorkarounds: enableCapacitorOptimization,
    enablePerformanceOptimization: true,
    enableMemoryManagement: true,
    debugMode
  });

  // Phase 5: Debug and Analytics Integration
  const debugAnalytics = useAndroidKeyboardDebugAnalytics(inputRef, {
    enableConflictDetection: enableDebugAnalytics,
    enablePerformanceTracking: enableDebugAnalytics,
    enableErrorReporting: enableDebugAnalytics,
    enableUsageAnalytics: enableDebugAnalytics,
    debugMode
  });

  // Master coordination functions
  const optimizeForKeyboardInput = useCallback(() => {
    if (!inputRef.current || platform !== 'android') return;

    const element = inputRef.current;
    
    // Apply coordinated optimizations
    if (enableTouchActionManagement) {
      touchActionManager.optimizeForAndroidKeyboard(element);
    }

    if (debugMode) {
      console.log('[MasterCoordinator] Optimized for keyboard input');
    }
  }, [inputRef, platform, enableTouchActionManagement, touchActionManager, debugMode]);

  const handleCompositionConflict = useCallback((conflictType: string) => {
    if (debugMode) {
      console.log('[MasterCoordinator] Handling composition conflict:', conflictType);
    }

    // Record the conflict for analytics
    if (enableDebugAnalytics && inputRef.current) {
      debugAnalytics.recordConflict(
        conflictType as any,
        inputRef.current,
        'master-coordinator-resolution'
      );
    }

    // Apply coordinated resolution
    if (coordinatedDetection?.detectionState?.isComposing) {
      // Prioritize composition
      window.dispatchEvent(new CustomEvent('blockSwipeGestures', {
        detail: { source: 'master-coordinator', reason: 'composition-active' }
      }));
    }
  }, [debugMode, enableDebugAnalytics, debugAnalytics, inputRef, coordinatedDetection]);

  const generateSystemReport = useCallback(() => {
    if (!enableDebugAnalytics) return null;

    const report = debugAnalytics.generateReport();
    
    // Add master coordinator context
    const enhancedReport = {
      ...report,
      masterCoordinator: {
        platform,
        isNative,
        enabledFeatures: {
          touchActionManagement: enableTouchActionManagement,
          compositionOptimization: enableCompositionOptimization,
          swipeCoordination: enableSwipeCoordination,
          capacitorOptimization: enableCapacitorOptimization,
          debugAnalytics: enableDebugAnalytics
        },
        phases: {
          touchActionManager: touchActionManager.platform,
          androidComposition: androidComposition.isAndroid ? {
            keyboardBrand: androidComposition.keyboardBrand,
            hasSwipeGesture: androidComposition.hasSwipeGesture,
            isComposing: androidComposition.isComposing
          } : null,
          coordinatedDetection: {
            detectionState: coordinatedDetection?.detectionState || {}
          },
          capacitorOptimization: capacitorOptimization.isCapacitorAndroid ? {
            webViewInfo: capacitorOptimization.webViewInfo,
            keyboardInfo: capacitorOptimization.keyboardInfo
          } : null
        }
      }
    };

    if (debugMode) {
      console.log('[MasterCoordinator] Generated system report:', enhancedReport);
    }

    return enhancedReport;
  }, [
    enableDebugAnalytics,
    debugAnalytics,
    platform,
    isNative,
    enableTouchActionManagement,
    enableCompositionOptimization,
    enableSwipeCoordination,
    enableCapacitorOptimization,
    touchActionManager,
    androidComposition,
    coordinatedDetection,
    capacitorOptimization,
    debugMode
  ]);

  // Skip if not Android
  if (platform !== 'android') {
    return {
      isMasterCoordinator: false,
      platform,
      isNative: false,
      hasActiveSwipe: false,
      isComposing: false,
      keyboardHeight: 0,
      isKeyboardVisible: false,
      optimizeForKeyboardInput: () => {},
      handleCompositionConflict: () => {},
      generateSystemReport: () => null
    };
  }

  return {
    isMasterCoordinator: true,
    platform,
    isNative,
    
    // Phase data
    touchActionManager: enableTouchActionManagement ? touchActionManager : null,
    androidComposition: enableCompositionOptimization ? androidComposition : null,
    coordinatedDetection: enableSwipeCoordination ? coordinatedDetection : null,
    capacitorOptimization: enableCapacitorOptimization ? capacitorOptimization : null,
    debugAnalytics: enableDebugAnalytics ? debugAnalytics : null,
    
    // Master coordination functions
    optimizeForKeyboardInput,
    handleCompositionConflict,
    generateSystemReport,
    
    // Quick access to key states
    isComposing: androidComposition?.isComposing || false,
    hasActiveSwipe: coordinatedDetection?.detectionState?.hasActiveSwipe || false,
    keyboardHeight: capacitorOptimization?.keyboardInfo?.height || 0,
    isKeyboardVisible: capacitorOptimization?.keyboardInfo?.isVisible || false
  };
};
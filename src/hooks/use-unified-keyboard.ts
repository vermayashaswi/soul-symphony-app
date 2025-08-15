import { useEnvironmentDetection } from './use-environment-detection';
import { useCapacitorKeyboard } from './use-capacitor-keyboard';
import { useMobileBrowserKeyboard } from './use-mobile-browser-keyboard';

interface UnifiedKeyboardState {
  isKeyboardVisible: boolean;
  keyboardHeight: number;
  platform: 'ios' | 'android' | 'web';
  isNative: boolean;
  isMobileBrowser: boolean;
  isCapacitorWebView: boolean;
  isReady: boolean;
  hideKeyboard?: () => Promise<void>;
}

/**
 * Unified keyboard hook that routes to appropriate implementation
 * based on environment (Capacitor vs Mobile Browser vs Desktop)
 */
export const useUnifiedKeyboard = (): UnifiedKeyboardState => {
  const environment = useEnvironmentDetection();
  const capacitorKeyboard = useCapacitorKeyboard();
  const mobileBrowserKeyboard = useMobileBrowserKeyboard();

  // Route to appropriate keyboard implementation
  if (environment.isCapacitorWebView) {
    return {
      isKeyboardVisible: capacitorKeyboard.isKeyboardVisible,
      keyboardHeight: capacitorKeyboard.keyboardHeight,
      platform: environment.platform,
      isNative: environment.isNative,
      isMobileBrowser: environment.isMobileBrowser,
      isCapacitorWebView: environment.isCapacitorWebView,
      isReady: capacitorKeyboard.isReady,
      hideKeyboard: capacitorKeyboard.hideKeyboard
    };
  }

  if (environment.isMobileBrowser) {
    return {
      isKeyboardVisible: mobileBrowserKeyboard.isKeyboardVisible,
      keyboardHeight: mobileBrowserKeyboard.keyboardHeight,
      platform: environment.platform,
      isNative: environment.isNative,
      isMobileBrowser: environment.isMobileBrowser,
      isCapacitorWebView: environment.isCapacitorWebView,
      isReady: mobileBrowserKeyboard.isReady
    };
  }

  // Desktop fallback
  return {
    isKeyboardVisible: false,
    keyboardHeight: 0,
    platform: environment.platform,
    isNative: environment.isNative,
    isMobileBrowser: environment.isMobileBrowser,
    isCapacitorWebView: environment.isCapacitorWebView,
    isReady: true
  };
};